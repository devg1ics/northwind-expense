from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from backend.db.models import VerdictType, SubmissionStatus

class EmployeeCreate(BaseModel):
    name: str
    email: Optional[str] = None
    grade: int = 5
    title: Optional[str] = None
    department: Optional[str] = None
    manager_name: Optional[str] = None
    manager_email: Optional[str] = None
    home_base: Optional[str] = None
    employee_id: Optional[str] = None

class EmployeeOut(BaseModel):
    id: int
    name: str
    email: Optional[str]
    grade: int
    title: Optional[str]
    department: Optional[str]
    manager_name: Optional[str]
    manager_email: Optional[str]
    home_base: Optional[str]
    employee_id: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

class SubmissionCreate(BaseModel):
    employee_id: int
    trip_purpose: Optional[str] = None
    trip_destination: Optional[str] = None
    trip_start: Optional[str] = None
    trip_end: Optional[str] = None

class SubmissionOut(BaseModel):
    id: int
    employee_id: int
    trip_purpose: Optional[str]
    trip_destination: Optional[str]
    trip_start: Optional[str]
    trip_end: Optional[str]
    status: SubmissionStatus
    total_amount: float
    submitted_at: datetime
    updated_at: datetime
    employee: Optional[EmployeeOut]
    receipt_count: int = 0
    flagged_count: int = 0
    class Config:
        from_attributes = True

class SubmissionUpdate(BaseModel):
    status: Optional[SubmissionStatus] = None

class PolicyClause(BaseModel):
    id: str
    title: str
    quoted_text: str
    relevance: str

class LineItemOut(BaseModel):
    id: int
    submission_id: int
    vendor: Optional[str]
    amount: Optional[float]
    currency: str
    date: Optional[str]
    category: Optional[str]
    description: Optional[str]
    receipt_filename: Optional[str]
    verdict: VerdictType
    reasoning: Optional[str]
    confidence: float
    policy_clauses: List[Any]
    extracted_data: Any
    override_verdict: Optional[VerdictType]
    override_comment: Optional[str]
    override_by: Optional[str]
    override_at: Optional[datetime]
    created_at: datetime
    class Config:
        from_attributes = True

class OverrideCreate(BaseModel):
    verdict: VerdictType
    comment: str
    reviewer: str

class AuditLogOut(BaseModel):
    id: int
    action: str
    old_value: Any
    new_value: Any
    actor: Optional[str]
    timestamp: datetime
    class Config:
        from_attributes = True

class PolicyQARequest(BaseModel):
    question: str

class PolicyQAResponse(BaseModel):
    answer: str
    citations: List[Any]
    confidence: float
    refused: bool
    out_of_scope: bool
