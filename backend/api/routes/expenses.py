import os
import shutil
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import Employee, Submission, LineItem, AuditLog, VerdictType, SubmissionStatus
from backend.models.schemas import (
    EmployeeCreate, EmployeeOut, SubmissionCreate, SubmissionOut,
    SubmissionUpdate, LineItemOut, OverrideCreate, AuditLogOut
)
from backend.pipeline.extractor import extract_receipt
from backend.pipeline.verdict import check_compliance

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOADS_DIR = os.getenv("UPLOADS_DIR", "/data/uploads")
Path(UPLOADS_DIR).mkdir(parents=True, exist_ok=True)

@router.get("/employees", response_model=List[EmployeeOut])
def list_employees(db: Session = Depends(get_db)):
    return db.query(Employee).all()

@router.post("/employees", response_model=EmployeeOut, status_code=201)
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    existing = db.query(Employee).filter(Employee.email == data.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Employee with this email already exists")
    emp = Employee(**data.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp

@router.get("/employees/{emp_id}", response_model=EmployeeOut)
def get_employee(emp_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp

@router.get("/submissions", response_model=List[SubmissionOut])
def list_submissions(
    employee_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(Submission)
    if employee_id:
        q = q.filter(Submission.employee_id == employee_id)
    if status:
        try:
            q = q.filter(Submission.status == SubmissionStatus(status))
        except ValueError:
            pass
    if date_from:
        try:
            q = q.filter(Submission.submitted_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            q = q.filter(Submission.submitted_at <= datetime.fromisoformat(date_to + "T23:59:59"))
        except ValueError:
            pass
    return q.order_by(Submission.submitted_at.desc()).all()

@router.post("/submissions", response_model=SubmissionOut, status_code=201)
def create_submission(data: SubmissionCreate, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    sub = Submission(**data.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub

@router.get("/submissions/{sub_id}", response_model=SubmissionOut)
def get_submission(sub_id: int, db: Session = Depends(get_db)):
    sub = db.query(Submission).filter(Submission.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return sub

@router.delete("/submissions/{sub_id}", status_code=204)
def delete_submission(sub_id: int, db: Session = Depends(get_db)):
    sub = db.query(Submission).filter(Submission.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    db.delete(sub)
    db.commit()

@router.patch("/submissions/{sub_id}", response_model=SubmissionOut)
def update_submission(sub_id: int, data: SubmissionUpdate, db: Session = Depends(get_db)):
    sub = db.query(Submission).filter(Submission.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if data.status is not None:
        sub.status = data.status
    sub.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(sub)
    return sub

@router.get("/submissions/{sub_id}/items", response_model=List[LineItemOut])
def get_submission_items(sub_id: int, db: Session = Depends(get_db)):
    sub = db.query(Submission).filter(Submission.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return sub.line_items

@router.post("/submissions/{sub_id}/receipts", response_model=LineItemOut, status_code=201)
async def upload_receipt(sub_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    sub = db.query(Submission).filter(Submission.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    emp = sub.employee
    upload_dir = Path(UPLOADS_DIR) / str(sub_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / file.filename
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    trip_context = {
        "employee_name": emp.name,
        "trip_purpose": sub.trip_purpose,
        "trip_destination": sub.trip_destination,
        "trip_start": sub.trip_start,
        "trip_end": sub.trip_end,
    }

    try:
        extracted = extract_receipt(str(file_path), trip_context)
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        extracted = {"vendor": None, "date": None, "amount_total": None, "currency": "USD",
                     "category": "other", "line_items": [], "confidence": 0.1}

    employee_context = {
        "name": emp.name,
        "grade": emp.grade,
        "title": emp.title,
        "department": emp.department,
    }

    try:
        verdict_result = check_compliance(extracted, employee_context, trip_context)
    except Exception as e:
        logger.error(f"Verdict failed: {e}")
        verdict_result = {
            "verdict": "needs_review",
            "reasoning": f"Automated review error: {e}",
            "policy_clauses": [],
            "confidence": 0.0,
            "flags": ["review_error"],
            "reimbursable_amount": None,
            "requires_approval": True,
        }

    verdict_str = verdict_result.get("verdict", "needs_review")
    try:
        verdict_enum = VerdictType(verdict_str)
    except ValueError:
        verdict_enum = VerdictType.needs_review

    item = LineItem(
        submission_id=sub_id,
        vendor=extracted.get("vendor"),
        amount=extracted.get("amount_total"),
        currency=extracted.get("currency", "USD"),
        date=extracted.get("date"),
        category=extracted.get("category"),
        description=extracted.get("notes"),
        receipt_filename=file.filename,
        receipt_path=str(file_path),
        verdict=verdict_enum,
        reasoning=verdict_result.get("reasoning"),
        confidence=float(verdict_result.get("confidence", 0.5)),
        policy_clauses=verdict_result.get("policy_clauses", []),
        extracted_data=extracted,
    )
    db.add(item)
    db.flush()

    # Update submission total
    total = sum(i.amount or 0 for i in sub.line_items if i.id != item.id)
    total += (extracted.get("amount_total") or 0)
    sub.total_amount = total
    sub.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(item)
    return item

@router.post("/items/{item_id}/override", response_model=LineItemOut)
def override_item(item_id: int, data: OverrideCreate, db: Session = Depends(get_db)):
    item = db.query(LineItem).filter(LineItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Line item not found")
    if not data.comment.strip():
        raise HTTPException(status_code=400, detail="Override comment is required")

    audit = AuditLog(
        line_item_id=item_id,
        submission_id=item.submission_id,
        action="override",
        old_value={"verdict": item.override_verdict.value if item.override_verdict else item.verdict.value},
        new_value={"verdict": data.verdict.value, "comment": data.comment, "reviewer": data.reviewer},
        actor=data.reviewer,
    )
    db.add(audit)

    item.override_verdict = data.verdict
    item.override_comment = data.comment
    item.override_by = data.reviewer
    item.override_at = datetime.utcnow()

    db.commit()
    db.refresh(item)
    return item

@router.get("/items/{item_id}/audit", response_model=List[AuditLogOut])
def get_audit_log(item_id: int, db: Session = Depends(get_db)):
    item = db.query(LineItem).filter(LineItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Line item not found")
    return item.audit_logs

@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(LineItem).filter(LineItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Line item not found")

    sub_id = item.submission_id

    audit = AuditLog(
        line_item_id=item_id,
        submission_id=sub_id,
        action="delete",
        old_value={"vendor": item.vendor, "amount": item.amount, "verdict": item.verdict.value},
        new_value={},
        actor="system",
    )
    db.add(audit)
    db.delete(item)

    # Recalculate submission total
    sub = db.query(Submission).filter(Submission.id == sub_id).first()
    if sub:
        total = sum(i.amount or 0 for i in sub.line_items if i.id != item_id)
        sub.total_amount = total
        sub.updated_at = datetime.utcnow()

    db.commit()
