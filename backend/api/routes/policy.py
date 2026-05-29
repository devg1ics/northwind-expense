from fastapi import APIRouter
from backend.models.schemas import PolicyQARequest, PolicyQAResponse
from backend.pipeline.verdict import answer_policy_question

router = APIRouter()

@router.post("/policy/ask", response_model=PolicyQAResponse)
def ask_policy(req: PolicyQARequest):
    result = answer_policy_question(req.question)
    return PolicyQAResponse(**result)
