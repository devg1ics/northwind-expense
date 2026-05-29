import base64
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, Optional

import anthropic
import pdfplumber
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
client = anthropic.Anthropic()

EXTRACTION_SYSTEM = """You are a receipt data extraction assistant. Extract structured data from receipts.
Return ONLY valid JSON matching the schema exactly. Never fabricate amounts or dates. Use null for unknown fields.
Do not include any text outside the JSON object."""

EXTRACTION_SCHEMA = """{
  "vendor": "string or null",
  "date": "YYYY-MM-DD or null",
  "amount_total": "number or null",
  "currency": "ISO 4217 code, default USD",
  "category": "one of: meal_breakfast, meal_lunch, meal_dinner, meal_other, lodging, flight, ground_transport, conference_registration, other",
  "line_items": [{"description": "string", "amount": "number"}],
  "alcohol_amount": "number or null",
  "tip_amount": "number or null",
  "tax_amount": "number or null",
  "meal_type_guess": "string or null",
  "notes": "string or null",
  "confidence": "number between 0 and 1"
}"""

def _build_extraction_prompt(trip_context: Optional[Dict] = None) -> str:
    ctx = ""
    if trip_context:
        ctx = f"""
Trip context for inference:
- Employee: {trip_context.get('employee_name', 'Unknown')}
- Purpose: {trip_context.get('trip_purpose', 'N/A')}
- Destination: {trip_context.get('trip_destination', 'N/A')}
- Dates: {trip_context.get('trip_start', 'N/A')} to {trip_context.get('trip_end', 'N/A')}
"""
    return f"""Extract all data from this receipt into this exact JSON schema:
{EXTRACTION_SCHEMA}
{ctx}
Return ONLY the JSON object, no other text."""

def _parse_extraction_response(text: str) -> Dict[str, Any]:
    text = text.strip()
    # Extract JSON from response
    json_match = re.search(r'\{.*\}', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass
    try:
        return json.loads(text)
    except Exception:
        return {"vendor": None, "date": None, "amount_total": None, "currency": "USD",
                "category": "other", "line_items": [], "alcohol_amount": None,
                "tip_amount": None, "tax_amount": None, "meal_type_guess": None,
                "notes": "Extraction failed", "confidence": 0.1}

def extract_from_pdf(file_path: str, trip_context: Optional[Dict] = None) -> Dict[str, Any]:
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        logger.warning(f"pdfplumber failed for {file_path}: {e}")

    if text.strip():
        return _extract_from_text(text, trip_context)

    # Fallback: vision
    try:
        with open(file_path, "rb") as f:
            pdf_bytes = f.read()
        return _extract_from_image_bytes(pdf_bytes, "application/pdf", trip_context)
    except Exception as e:
        logger.error(f"Vision fallback failed: {e}")
        return {"vendor": None, "date": None, "amount_total": None, "currency": "USD",
                "category": "other", "line_items": [], "alcohol_amount": None,
                "tip_amount": None, "tax_amount": None, "confidence": 0.1}

def extract_from_image(file_path: str, trip_context: Optional[Dict] = None) -> Dict[str, Any]:
    suffix = Path(file_path).suffix.lower()
    media_type = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png"
    with open(file_path, "rb") as f:
        image_bytes = f.read()
    return _extract_from_image_bytes(image_bytes, media_type, trip_context)

def extract_from_text(file_path: str, trip_context: Optional[Dict] = None) -> Dict[str, Any]:
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()
    return _extract_from_text(text, trip_context)

def _extract_from_text(text: str, trip_context: Optional[Dict] = None) -> Dict[str, Any]:
    prompt = _build_extraction_prompt(trip_context)
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=EXTRACTION_SYSTEM,
            messages=[{"role": "user", "content": f"{prompt}\n\nReceipt text:\n{text[:4000]}"}],
        )
        return _parse_extraction_response(response.content[0].text)
    except Exception as e:
        logger.error(f"Text extraction failed: {e}")
        return {"vendor": None, "date": None, "amount_total": None, "currency": "USD",
                "category": "other", "line_items": [], "alcohol_amount": None,
                "tip_amount": None, "tax_amount": None, "confidence": 0.1}

def _extract_from_image_bytes(image_bytes: bytes, media_type: str, trip_context: Optional[Dict] = None) -> Dict[str, Any]:
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    prompt = _build_extraction_prompt(trip_context)
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=EXTRACTION_SYSTEM,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        return _parse_extraction_response(response.content[0].text)
    except Exception as e:
        logger.error(f"Vision extraction failed: {e}")
        return {"vendor": None, "date": None, "amount_total": None, "currency": "USD",
                "category": "other", "line_items": [], "alcohol_amount": None,
                "tip_amount": None, "tax_amount": None, "confidence": 0.1}

def extract_receipt(file_path: str, trip_context: Optional[Dict] = None) -> Dict[str, Any]:
    suffix = Path(file_path).suffix.lower()
    if suffix == ".pdf":
        return extract_from_pdf(file_path, trip_context)
    elif suffix in (".jpg", ".jpeg", ".png"):
        return extract_from_image(file_path, trip_context)
    elif suffix == ".txt":
        return extract_from_text(file_path, trip_context)
    else:
        logger.warning(f"Unknown file type: {suffix}, trying text")
        return extract_from_text(file_path, trip_context)
