import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, JSON, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from backend.db.database import Base

class VerdictType(str, enum.Enum):
    compliant = "compliant"
    flagged = "flagged"
    rejected = "rejected"
    ambiguous = "ambiguous"
    needs_review = "needs_review"

class SubmissionStatus(str, enum.Enum):
    pending = "pending"
    reviewed = "reviewed"
    approved = "approved"
    rejected = "rejected"

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True)
    employee_id = Column(String, unique=True, nullable=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    grade = Column(Integer, default=5)
    title = Column(String, nullable=True)
    department = Column(String, nullable=True)
    manager_name = Column(String, nullable=True)
    manager_email = Column(String, nullable=True)
    home_base = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    submissions = relationship("Submission", back_populates="employee")

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    trip_purpose = Column(String, nullable=True)
    trip_destination = Column(String, nullable=True)
    trip_start = Column(String, nullable=True)
    trip_end = Column(String, nullable=True)
    status = Column(SAEnum(SubmissionStatus), default=SubmissionStatus.pending)
    total_amount = Column(Float, default=0.0)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    employee = relationship("Employee", back_populates="submissions")
    line_items = relationship("LineItem", back_populates="submission", cascade="all, delete-orphan")

    @property
    def receipt_count(self):
        return len(self.line_items)

    @property
    def flagged_count(self):
        flagged = {'flagged', 'rejected', 'needs_review', 'ambiguous'}
        return sum(1 for item in self.line_items
                   if (item.override_verdict or item.verdict).value in flagged)

class LineItem(Base):
    __tablename__ = "line_items"
    id = Column(Integer, primary_key=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    vendor = Column(String, nullable=True)
    amount = Column(Float, nullable=True)
    currency = Column(String, default="USD")
    date = Column(String, nullable=True)
    category = Column(String, nullable=True)
    description = Column(String, nullable=True)
    receipt_filename = Column(String, nullable=True)
    receipt_path = Column(String, nullable=True)
    verdict = Column(SAEnum(VerdictType), default=VerdictType.needs_review)
    reasoning = Column(Text, nullable=True)
    confidence = Column(Float, default=0.5)
    policy_clauses = Column(JSON, default=list)
    extracted_data = Column(JSON, default=dict)
    override_verdict = Column(SAEnum(VerdictType), nullable=True)
    override_comment = Column(Text, nullable=True)
    override_by = Column(String, nullable=True)
    override_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    submission = relationship("Submission", back_populates="line_items")
    audit_logs = relationship("AuditLog", back_populates="line_item", cascade="all, delete-orphan")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    line_item_id = Column(Integer, ForeignKey("line_items.id"), nullable=False)
    submission_id = Column(Integer, nullable=True)
    action = Column(String, nullable=False)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    actor = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    line_item = relationship("LineItem", back_populates="audit_logs")

class PolicyChunk(Base):
    __tablename__ = "policy_chunks"
    id = Column(Integer, primary_key=True)
    document_id = Column(String, nullable=False)
    document_title = Column(String, nullable=True)
    section = Column(String, nullable=True)
    text = Column(Text, nullable=False)
    page = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
