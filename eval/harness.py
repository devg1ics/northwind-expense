#!/usr/bin/env python3
"""Northwind Expense Review System — Evaluation Harness

Usage:
    python eval/harness.py --cases eval/cases.json --base-url http://localhost:8000
"""
import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

import requests

def create_employee(base_url: str, emp_data: Dict) -> int:
    email = emp_data.get("email", f"eval_{int(time.time())}@test.northwind.com")
    payload = {
        "name": emp_data.get("name", "Eval Employee"),
        "email": email,
        "grade": emp_data.get("grade", 5),
        "title": emp_data.get("title"),
        "department": emp_data.get("department"),
    }
    r = requests.post(f"{base_url}/api/employees", json=payload)
    if r.status_code == 409:
        emps = requests.get(f"{base_url}/api/employees").json()
        for e in emps:
            if e["email"] == email:
                return e["id"]
        raise ValueError(f"Conflict but employee not found: {email}")
    r.raise_for_status()
    return r.json()["id"]

def create_submission(base_url: str, emp_id: int, trip: Dict) -> int:
    payload = {
        "employee_id": emp_id,
        "trip_purpose": trip.get("trip_purpose"),
        "trip_destination": trip.get("trip_destination"),
        "trip_start": trip.get("trip_start"),
        "trip_end": trip.get("trip_end"),
    }
    r = requests.post(f"{base_url}/api/submissions", json=payload)
    r.raise_for_status()
    return r.json()["id"]

def upload_text_receipt(base_url: str, sub_id: int, text: str, filename: str = "eval_receipt.txt") -> Dict:
    import tempfile, os
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="w") as f:
        f.write(text)
        tmp_path = f.name
    try:
        with open(tmp_path, "rb") as f:
            r = requests.post(
                f"{base_url}/api/submissions/{sub_id}/receipts",
                files={"file": (filename, f, "text/plain")},
                timeout=120,
            )
        r.raise_for_status()
        return r.json()
    finally:
        os.unlink(tmp_path)

def run_verdict_case(base_url: str, case: Dict) -> Dict[str, Any]:
    emp_data = case.get("employee", {})
    emp_data["email"] = f"eval_{case['id']}@test.northwind.com"
    try:
        emp_id = create_employee(base_url, emp_data)
        sub_id = create_submission(base_url, emp_id, case.get("trip", {}))
        item = upload_text_receipt(base_url, sub_id, case["receipt_text"])

        actual_verdict = item.get("verdict")
        expected_verdict = case.get("expected_verdict")
        expected_ids = case.get("expected_policy_ids", [])
        returned_ids = [c.get("id", "") for c in (item.get("policy_clauses") or [])]

        verdict_match = actual_verdict == expected_verdict
        policy_recall = 0.0
        if expected_ids:
            found = sum(1 for eid in expected_ids if any(eid in rid for rid in returned_ids))
            policy_recall = found / len(expected_ids)
        else:
            policy_recall = 1.0

        return {
            "case_id": case["id"],
            "type": "verdict",
            "passed": verdict_match,
            "expected_verdict": expected_verdict,
            "actual_verdict": actual_verdict,
            "confidence": item.get("confidence", 0),
            "policy_recall": policy_recall,
            "notes": case.get("notes", ""),
        }
    except Exception as e:
        return {
            "case_id": case["id"],
            "type": "verdict",
            "passed": False,
            "error": str(e),
            "notes": case.get("notes", ""),
        }

def run_qa_case(base_url: str, case: Dict) -> Dict[str, Any]:
    try:
        r = requests.post(f"{base_url}/api/policy/ask", json={"question": case["question"]}, timeout=60)
        r.raise_for_status()
        result = r.json()

        actual_refused = result.get("refused", False)
        expected_refused = case.get("expected_refused", False)
        refusal_correct = actual_refused == expected_refused

        return {
            "case_id": case["id"],
            "type": "qa",
            "passed": refusal_correct,
            "expected_refused": expected_refused,
            "actual_refused": actual_refused,
            "confidence": result.get("confidence", 0),
            "num_citations": len(result.get("citations") or []),
            "notes": case.get("notes", ""),
        }
    except Exception as e:
        return {
            "case_id": case["id"],
            "type": "qa",
            "passed": False,
            "error": str(e),
            "notes": case.get("notes", ""),
        }

def main():
    parser = argparse.ArgumentParser(description="Northwind Eval Harness")
    parser.add_argument("--cases", default="eval/cases.json")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--output", default="eval/results.json")
    args = parser.parse_args()

    with open(args.cases) as f:
        cases = json.load(f)

    print(f"\nNorthwind Expense Review — Evaluation Harness")
    print(f"Cases: {args.cases} ({len(cases)} cases)")
    print(f"Server: {args.base_url}\n")

    # Health check
    try:
        r = requests.get(f"{args.base_url}/api/health", timeout=5)
        r.raise_for_status()
        print("✓ Server healthy\n")
    except Exception as e:
        print(f"✗ Server not reachable: {e}")
        sys.exit(1)

    results = []
    for case in cases:
        print(f"Running [{case['id']}] {case.get('description', case['type'])}...", end=" ", flush=True)
        t0 = time.time()
        if case["type"] == "verdict":
            result = run_verdict_case(args.base_url, case)
        elif case["type"] == "qa":
            result = run_qa_case(args.base_url, case)
        else:
            result = {"case_id": case["id"], "passed": False, "error": f"Unknown type: {case['type']}"}
        elapsed = time.time() - t0
        result["elapsed_s"] = round(elapsed, 2)
        results.append(result)
        status = "✓ PASS" if result["passed"] else "✗ FAIL"
        print(f"{status} ({elapsed:.1f}s)")
        if not result["passed"]:
            detail = result.get("error") or f"expected={result.get('expected_verdict') or result.get('expected_refused')} actual={result.get('actual_verdict') or result.get('actual_refused')}"
            print(f"      {detail}")

    # Metrics
    verdict_cases = [r for r in results if r["type"] == "verdict"]
    qa_cases = [r for r in results if r["type"] == "qa"]

    verdict_accuracy = sum(r["passed"] for r in verdict_cases) / len(verdict_cases) if verdict_cases else 0
    refusal_accuracy = sum(r["passed"] for r in qa_cases) / len(qa_cases) if qa_cases else 0
    policy_recall = sum(r.get("policy_recall", 0) for r in verdict_cases) / len(verdict_cases) if verdict_cases else 0
    mean_confidence = sum(r.get("confidence", 0) for r in verdict_cases) / len(verdict_cases) if verdict_cases else 0
    pass_rate = sum(r["passed"] for r in results) / len(results) if results else 0

    print(f"""
{'='*50}
RESULTS SUMMARY
{'='*50}
Total cases:       {len(results)}
Pass rate:         {pass_rate:.1%}
Verdict accuracy:  {verdict_accuracy:.1%}  ({len(verdict_cases)} cases)
Policy recall:     {policy_recall:.1%}
Refusal accuracy:  {refusal_accuracy:.1%}  ({len(qa_cases)} cases)
Mean confidence:   {mean_confidence:.2f}
{'='*50}
""")

    output = {
        "summary": {
            "total": len(results),
            "pass_rate": round(pass_rate, 3),
            "verdict_accuracy": round(verdict_accuracy, 3),
            "policy_recall": round(policy_recall, 3),
            "refusal_accuracy": round(refusal_accuracy, 3),
            "mean_confidence": round(mean_confidence, 3),
        },
        "cases": results,
    }
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w") as f:
        json.dump(output, f, indent=2)
    print(f"Results written to {args.output}")

if __name__ == "__main__":
    main()
