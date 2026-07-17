import json
import logging
import re
from typing import Any, Dict, List, Optional

import anthropic
from dotenv import load_dotenv

from backend.pipeline.indexer import retrieve_policy_chunks

load_dotenv()

logger = logging.getLogger(__name__)
client = anthropic.Anthropic()

VERDICT_SYSTEM = """You are a compliance expert reviewing employee expense receipts against company policy.
Analyze the receipt and return ONLY a valid JSON verdict. Never fabricate policy text.
Only cite policies from the retrieved chunks provided. Be conservative — if uncertain, say so."""

VERDICT_SCHEMA = """{
  "verdict": "one of: compliant, flagged, rejected, ambiguous, needs_review",
  "reasoning": "clear explanation of verdict referencing specific policy clauses",
  "policy_clauses": [
    {"id": "policy doc ID", "title": "section title", "quoted_text": "exact quote from chunk", "relevance": "why this applies"}
  ],
  "confidence": "number 0-1",
  "flags": ["list of specific issues found"],
  "reimbursable_amount": "number or null — the amount that IS reimbursable under policy",
  "requires_approval": "boolean",
  "approval_type": "string or null"
}"""

QA_SYSTEM = """You are a policy assistant for ExpenseIQ. Answer questions ONLY using the provided policy chunks.
If the answer cannot be found in the chunks, you MUST refuse with refused=true. Never fabricate policy content.
Return ONLY valid JSON."""

QA_SCHEMA = """{
  "answer": "answer text or empty string if refused",
  "citations": [{"id": "doc id", "title": "section", "text": "exact quoted text"}],
  "confidence": "number 0-1",
  "refused": "boolean — true if question cannot be answered from provided policy",
  "out_of_scope": "boolean — true if question is about non-policy topics"
}"""

def _build_verdict_prompt(
    extracted: Dict[str, Any],
    employee: Dict[str, Any],
    trip: Dict[str, Any],
    chunks: List[Dict[str, Any]],
) -> str:
    chunks_text = "\n\n---\n\n".join(
        f"[Score: {c['score']:.2f}] {c['text']}" for c in chunks
    )
    return f"""Review this expense receipt for policy compliance.

EMPLOYEE:
- Name: {employee.get('name', 'Unknown')}
- Grade: {employee.get('grade', 5)} (1=junior, 10=executive)
- Title: {employee.get('title', 'N/A')}
- Department: {employee.get('department', 'N/A')}

TRIP CONTEXT:
- Purpose: {trip.get('trip_purpose', 'N/A')}
- Destination: {trip.get('trip_destination', 'N/A')}
- Dates: {trip.get('trip_start', 'N/A')} to {trip.get('trip_end', 'N/A')}

EXTRACTED RECEIPT DATA:
{json.dumps(extracted, indent=2)}

RELEVANT POLICY CHUNKS:
{chunks_text}

Return ONLY this JSON schema:
{VERDICT_SCHEMA}

Critical rules:
- Only cite clauses from the policy chunks above
- Quote policy text verbatim (do not paraphrase)
- If alcohol is present, apply alcohol policy strictly
- Consider employee grade for spending limits
- If meal is over per-diem limit, flag or reject based on policy"""

def check_compliance(
    extracted: Dict[str, Any],
    employee: Dict[str, Any],
    trip: Dict[str, Any],
) -> Dict[str, Any]:
    category = extracted.get("category", "other")
    amount = extracted.get("amount_total") or 0
    has_alcohol = (extracted.get("alcohol_amount") or 0) > 0
    destination = trip.get("trip_destination", "")

    query = f"{category} expense {amount} {destination} reimbursement policy"
    if has_alcohol:
        query += " alcohol"

    chunks = retrieve_policy_chunks(query, n_results=7, extra_alcohol=has_alcohol)

    prompt = _build_verdict_prompt(extracted, employee, trip, chunks)

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            system=VERDICT_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
        else:
            result = json.loads(raw)
    except Exception as e:
        logger.error(f"Verdict generation failed: {e}")
        return {
            "verdict": "needs_review",
            "reasoning": f"Automated review failed: {str(e)}. Manual review required.",
            "policy_clauses": [],
            "confidence": 0.0,
            "flags": ["review_error"],
            "reimbursable_amount": None,
            "requires_approval": True,
            "approval_type": "manual",
        }

    # Confidence threshold: if < 0.55 and not rejected, downgrade to needs_review
    confidence = float(result.get("confidence", 0.5))
    verdict = result.get("verdict", "needs_review")
    if confidence < 0.55 and verdict != "rejected":
        result["verdict"] = "needs_review"
        flags = result.get("flags", [])
        if "low_confidence" not in flags:
            flags.append("low_confidence")
        result["flags"] = flags

    return result

def answer_policy_question(question: str) -> Dict[str, Any]:
    chunks = retrieve_policy_chunks(question, n_results=5)

    if not chunks:
        return {
            "answer": "",
            "citations": [],
            "confidence": 0.0,
            "refused": True,
            "out_of_scope": True,
        }

    max_score = max(c["score"] for c in chunks)

    if max_score < 0.30:
        nearby = [
            {
                "id": c["metadata"].get("document_id", "DOC"),
                "title": c["metadata"].get("section", ""),
                "text": c["text"][:300] + ("…" if len(c["text"]) > 300 else ""),
            }
            for c in chunks[:3]
        ]
        return {
            "answer": "This question appears to be outside the scope of ExpenseIQ's expense policy documents. The policies cover travel expenses, meals, lodging, ground transport, flights, and reimbursement procedures. Please consult your HR or Finance team for questions outside these topics.",
            "citations": nearby,
            "confidence": max_score,
            "refused": True,
            "out_of_scope": True,
        }

    chunks_text = "\n\n---\n\n".join(
        f"[{c['metadata'].get('document_id', 'DOC')} — {c['metadata'].get('section', '')}]\n{c['text']}"
        for c in chunks
    )

    prompt = f"""Answer this question using ONLY the policy chunks below.
If the answer is not in the chunks, set refused=true.

Question: {question}

Policy chunks:
{chunks_text}

Return ONLY this JSON:
{QA_SCHEMA}"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=QA_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
        else:
            result = json.loads(raw)
        return result
    except Exception as e:
        logger.error(f"Policy Q&A failed: {e}")
        return {
            "answer": "",
            "citations": [],
            "confidence": 0.0,
            "refused": True,
            "out_of_scope": False,
        }
