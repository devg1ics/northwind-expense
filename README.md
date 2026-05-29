# Northwind Logistics — AI Expense Review System

An end-to-end expense compliance platform: upload a receipt (PDF/image/text), get a structured verdict with policy citations in seconds. Built with FastAPI, React, SQLite, and Claude.

**Live deployment:** https://northwind-expense-production-128d.up.railway.app/

---

## What It Does

Finance submits expense receipts through a web UI. The system:

1. Extracts structured data from the receipt (vendor, date, amount, line items) using Claude Vision
2. Retrieves the most relevant policy chunks via hybrid TF-IDF + BM25 search
3. Runs a compliance verdict call — Claude reads the receipt + policy context and returns a verdict, reasoning, and verbatim policy citations
4. Stores everything in SQLite; a reviewer can approve, flag, reject, or override individual line items with a full audit trail

There's also a policy Q&A chat that answers questions grounded in the policy documents, with refusal logic for out-of-scope questions.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         BROWSER                             │
│  React + Vite + Tailwind                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  HomePage    │  │SubmissionPage│  │  PolicyQAPage    │  │
│  │ (list/create)│  │(upload+cards)│  │  (chat + RAG)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST /api/*
┌───────────────────────────▼─────────────────────────────────┐
│                     FastAPI  (backend/)                      │
│                                                             │
│  /api/submissions  /api/employees  /api/items  /api/policy  │
│         │                                   │               │
│  ┌──────▼──────┐                   ┌────────▼──────────┐   │
│  │  Extractor  │                   │  Policy Q&A       │   │
│  │  (Claude)   │                   │  (RAG + Claude)   │   │
│  └──────┬──────┘                   └────────┬──────────┘   │
│         │                                   │               │
│  ┌──────▼──────┐                   ┌────────▼──────────┐   │
│  │  Verdict    │                   │  TF-IDF store     │   │
│  │  (Claude +  │◄──── chunks ──────│  (policy index)   │   │
│  │   RAG)      │                   │  + BM25 rerank    │   │
│  └──────┬──────┘                   └───────────────────┘   │
│         │                                                    │
│  ┌──────▼──────────────────────────────────────────────┐   │
│  │              SQLite  (northwind.db)                  │   │
│  │   employees  submissions  line_items  audit_logs     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 20+

### 1. Clone and enter the project

```bash
cd northwind
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 4. Install and build frontend

```bash
cd frontend
npm install
npm run build   # produces frontend/dist/
cd ..
```

### 5. Run the backend

```bash
uvicorn backend.main:app --reload --port 8080
```

On first boot the server will:
- Create `northwind.db` with all tables
- Seed employees from `submissions/*/employee_info.json`
- Index all PDFs in `policies/` into the TF-IDF vector store (`chroma_db/`)

### 6. Open the app

Navigate to [http://localhost:8080](http://localhost:8080) (served from `frontend/dist/`), or run `npm run dev` in `frontend/` during development (proxies `/api` to `:8080`).

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **Required.** Claude API key |
| `DB_PATH` | `/data/northwind.db` | SQLite database path |
| `CHROMA_PATH` | `/data/chroma_db` | TF-IDF vector store persistence directory |
| `POLICIES_DIR` | `./policies` | Directory of policy PDFs to index |
| `SUBMISSIONS_DIR` | `./submissions` | Seed data directory |
| `UPLOADS_DIR` | `/data/uploads` | Where uploaded receipts are stored |

---

## Design Decisions & Tradeoffs

### 1. Schema-constrained JSON output (vs. free-text parsing)

**Decision:** Both the extractor and verdict calls instruct Claude to return *only* a valid JSON object matching a documented schema. The system prompt says: "Return ONLY valid JSON. No prose, no markdown fences." The raw response is then pulled out with `re.search(r'\{.*\}', raw, re.DOTALL)` as a fallback for any stray whitespace.

**Why:** Free-text responses require parsing logic that becomes a maintenance problem. When Claude returns `{"verdict": "flagged", "confidence": 0.82, ...}`, downstream code can access fields directly. When it returns a paragraph, you need a classifier on top of a classifier. Schema constraints also make failures predictable — if parsing fails, the error is in the JSON, not in the model's reasoning.

**Tradeoff:** You lose nuance. "Flagged with strong recommendation to reject" collapses to `flagged`. The four-state verdict model (`compliant / flagged / rejected / needs_review`) was chosen deliberately — broad enough to cover real cases, narrow enough to be actionable. `needs_review` is a confidence-gated escape hatch, not a model output.

**What can go wrong:** Claude occasionally wraps JSON in a markdown fence (` ```json `) despite the instruction. The regex handles this, but if the model returns partial JSON (streaming cut mid-object), parsing fails and the upload returns a 500. This is uncommon but not impossible with long receipts.

---

### 2. Claude for extraction AND verdict (vs. dedicated OCR + rules engine)

**Decision:** `claude-sonnet-4-20250514` handles receipt extraction (Vision API for images) and compliance verdict in two sequential calls.

**Why:** A traditional pipeline — Tesseract OCR → regex extraction → hard-coded rules — fails badly on varied receipt formats: handwritten totals, bundled charges, foreign currencies, receipts where "tip" appears as "gratuity" or "service charge". Claude handles all of these without special-casing. It can also reason about ambiguous situations ("is this a client dinner or a solo meal?") that rules can't.

**Tradeoff:** Cost. Each receipt costs ~$0.05–0.08 (800 in + 300 out for extraction, 2000 in + 500 out for verdict). At 10,000 submissions/day with 4 receipts each, that's ~$1,000/day in API costs. A fine-tuned smaller model (Haiku) after collecting 500+ examples would cut this 10×. The rules-engine alternative isn't cheaper in the long run because policy changes require engineering work; here they require re-indexing a PDF.

**Alternative rejected:** Tesseract + regex + rule engine. Brittle, requires constant maintenance as policies change, can't handle image quality variation or non-English receipts.

---

### 3. Hybrid retrieval: TF-IDF + BM25 (vs. neural embeddings)

**Decision:** Dense retrieval uses TF-IDF cosine similarity (scikit-learn, bigrams, sublinear TF, 30k features). Sparse re-ranking uses BM25Okapi. Final score: 65% TF-IDF + 35% BM25. Persisted as JSON + `.npy` so it survives restarts without re-fitting.

**Why TF-IDF instead of embeddings:** Policy documents use highly controlled vocabulary — specific identifiers like "TEP-002 §2.3", dollar thresholds like "$75/night", grade references like "Grade 7+". Neural embeddings (sentence-transformers) would generalize *too far* — "meal allowance" and "food budget" are semantically similar, but "TEP-002" and "TEP-005" are not, and conflating them is a compliance error. TF-IDF with bigrams captures exact-match patterns effectively for this domain.

**Why BM25 on top:** BM25 boosts recall for specific numeric tokens and policy IDs that TF-IDF might under-weight due to IDF smoothing. The 65/35 blend was chosen empirically — pure TF-IDF missed policy IDs when the query phrased them differently; pure BM25 was too sensitive to exact wording.

**Tradeoff:** TF-IDF won't generalize to semantic paraphrases the way neural encoders do. If a policy says "entertainment expenses" but a receipt says "client outing", TF-IDF may not connect them. Mitigation: the verdict prompt uses synonym-rich queries constructed from the extracted receipt data, which partially covers this gap.

**Alternative rejected:** ChromaDB with `chroma-hnswlib`. Requires C++ build tools (MSVC) on Windows — a significant friction point for local development. Would be the right choice for a production system with controlled infrastructure. SQLite + TF-IDF is zero-dependency by comparison.

---

### 4. Confidence threshold gating (< 0.55 → needs_review)

**Decision:** If Claude returns `confidence < 0.55` and the verdict is not `rejected`, the system downgrades it to `needs_review`.

**Why:** Low-confidence `compliant` verdicts on borderline cases (ambiguous alcohol + meal combos, receipts with missing dates) were getting approved in testing when they should have gone to a human reviewer. A compliance tool's false-positive cost (incorrectly approving non-compliant expenses) is higher than its false-negative cost (flagging something compliant for review). The 0.55 threshold was chosen to catch genuine uncertainty without flooding reviewers with trivial cases.

**Tradeoff:** Increases the volume of manual review. If the model is systematically uncertain about a common expense type (e.g., all team lunches), you get a lot of noise. The right long-term fix is better retrieval (more precise policy chunks) so confidence is higher on clear-cut cases.

---

### 5. Refusal logic in Policy Q&A (score < 0.30)

**Decision:** If the maximum retrieval score across all policy chunks is below 0.30, the Q&A endpoint returns `refused=True` with the closest policy sections it did find (as context, not as an answer).

**Why:** Without a refusal gate, the model answers out-of-scope questions by hallucinating policy text that doesn't exist. The system prompt says "Never fabricate policy text. Only cite policies from retrieved chunks. Quote verbatim." — but without a hard gate, Claude will still synthesize plausible-sounding policy from general knowledge. A 0.30 score threshold means "nothing in the policy index is meaningfully related to this question."

**Tradeoff:** 0.30 is an empirically chosen threshold that works for the current policy set. A different policy corpus (more or less specific vocabulary) would need re-tuning. We return the nearby chunks on refusal so a user can see what the system *did* find, rather than just hitting a dead end.

---

### 6. Policy chunking by headings (vs. fixed-size windows)

**Decision:** Policy PDFs are split by detected section headings (regex patterns for numbered sections, ALL-CAPS headings, Title Case headings, Section/Article/Part/Appendix prefixes). Minimum chunk size: 50 characters. Fallback: whole document if no headings found.

**Why:** Fixed-size windows (e.g., 512 tokens) split policy clauses mid-sentence. A chunk that starts "...and therefore not reimbursable" with no preceding context is useless for retrieval — the model can't tell which expense type is not reimbursable. Heading-based chunks keep "Meal Allowances" rules together, which produces better retrieval precision.

**Tradeoff:** Variable chunk sizes. A long section (e.g., "International Travel") becomes one large chunk; a short policy point becomes a tiny one. Large chunks push toward the context limit; tiny chunks don't give enough context. The current policy documents are well-structured enough that this doesn't cause problems, but a poorly formatted PDF will fall back to whole-document indexing, degrading retrieval.

**What can go wrong:** The heading regex has false positives. A line like "TOTAL: $2,450.00" matches the ALL-CAPS pattern and gets treated as a section heading. This is mitigated by the 100-character length cap on headings, but edge cases exist.

---

### 7. Duplicate receipt detection (content hash vs. field match)

**Decision:** On every upload, after extraction, check existing line items in the same submission for matching vendor + amount (within $0.01) + date. Flag as `duplicate` rather than rejecting outright.

**Why flag instead of block:** The uploaded file might be a legitimate re-scan of a corrected receipt. Flagging puts it in the reviewer's queue rather than silently discarding it. The audit trail captures the duplicate detection event.

**Tradeoff:** This is field-level matching, not content hashing. Two different receipts from the same vendor for the same amount on the same day would both get flagged. File-content hashing would be more precise (SHA-256 of the raw bytes) but requires storing receipt content rather than just metadata. Added to the "What I'd Do Next" list.

---

### 8. Frontend: React + Vite + Tailwind (vs. Next.js or a heavier framework)

**Decision:** Single-page React app built with Vite, styled with Tailwind CSS utility classes. No component library (no shadcn/ui, no MUI). Client-side routing via React Router. All API calls go through a single `lib/api.js` module using axios with a `/api` base URL.

**Why Vite over Create React App or Next.js:** Vite's dev server starts in under 300ms (no webpack); HMR is near-instant. Next.js would have been over-engineering — there's no SSR requirement, no SEO concern, and no server components that would justify the complexity. Vite produces a static `dist/` bundle that FastAPI serves directly from disk, keeping the deployment to a single process.

**Why no component library:** Compliance UIs need precise visual hierarchy — a compliant receipt, a flagged one, and a rejected one need to be instantly distinguishable at a glance. Off-the-shelf libraries make that harder to control; every override fights the library's default styles. Tailwind lets the visual design be built from semantic intentions (e.g., `bg-emerald-50 text-emerald-700 ring-emerald-200` for compliant, `bg-rose-50 text-rose-700 ring-rose-200` for rejected) without fighting someone else's CSS specificity.

**Tradeoff:** More verbose JSX. Every card, badge, and button is hand-written. This is fine for a focused tool with a known page count; it would be a maintenance problem at large team scale.

---

### 9. Frontend state: local `useState` per page (vs. global state / React Query)

**Decision:** Each page manages its own state with `useState` and `useEffect`. There's no Redux, no Zustand, no React Query. When a receipt is uploaded, the response item is appended directly to the local `items` array and sorted in place.

**Why:** The app has three pages with minimal shared state. The only cross-page concern is "which submission is open" — handled by URL params via React Router (`/submissions/:id`). Global state management adds indirection and boilerplate for no concrete benefit at this scale.

**Tradeoff:** No cache invalidation. If two tabs are open showing the same submission, uploading a receipt in one tab won't update the other. For a single-user finance review tool, this is acceptable. React Query would be the right choice if real-time collaborative review were a requirement.

---

### 10. Upload flow: per-file optimistic status (vs. polling or websocket)

**Decision:** When a file is dropped, it immediately enters the upload queue UI with a status of `uploading`, then transitions to `analyzing` (while Claude processes), then `done` (with a 3-second auto-dismiss). There's no polling — the `await uploadReceipt(...)` call is synchronous from the frontend's perspective; the backend completes extraction + verdict before returning the response.

**Why:** The synchronous API response means the UI only needs to track in-flight requests, not remote job state. Each upload gets a local `uid` key (`Date.now() + Math.random()`) so multiple concurrent uploads can be tracked independently without collision.

**Tradeoff:** If the backend times out mid-processing (e.g., Claude API slow), the frontend shows "analyzing" indefinitely until the request errors. A proper websocket/SSE stream would let the backend push intermediate status. This is in the "What I'd Do Next" list — not worth the complexity for a tool processing one receipt at a time.

---

### 11. Verdict display: 3 states in UI, 4 in DB (collapsing `needs_review` and `ambiguous`)

**Decision:** The database stores four verdict states: `compliant`, `flagged`, `rejected`, `needs_review`. The UI renders `needs_review` and `ambiguous` as amber/flagged visual treatment — same icon, same badge color — but shows the raw state text in the audit trail.

**Why:** Reviewers don't need to distinguish "flagged by policy" from "flagged due to low confidence" at the list view level. Both need attention. The distinction matters in the detail view (where the reasoning text explains why it's needs_review) and in the audit trail. Collapsing them in the visual layer avoids a fourth color in the palette without losing information.

**Tradeoff:** A reviewer scanning the list can't immediately see which flagged items are AI-uncertain vs. policy-clear. If the system processes a lot of borderline receipts, the amber pile grows without distinction. The confidence bar inside the expanded card partially mitigates this.

---

### 12. Policy Q&A: chat-style interface with refusal display (vs. search-box results)

**Decision:** Policy Q&A is a chat thread. Out-of-scope responses are shown in an amber card with the nearest policy chunks shown as "most relevant policies found" — not as answers, but as pointers. Suggestion chips on the empty state are wired directly to the `send()` handler via an `onAsk` prop passed into the illustration component.

**Why chat vs. search:** The use case is "I have a question about my expense, what does policy say?" — a conversational intent, not a document search intent. Chat format also makes the citation-per-answer relationship clear: each response is explicitly tied to the policy sections that generated it.

**Why show near-miss chunks on refusal:** A bare "I can't answer that" is unhelpful. Showing the closest policy sections lets the user decide if their question was mis-phrased (and rephrase it) or genuinely outside scope (and go to HR). It also makes the retrieval system legible — the user can see what the system is searching against.

**Bug fixed during development:** The suggestion chips were initially in a separate `PolicyIllustration` component with no access to the `send()` handler. The buttons had `data-question` attributes but no `onClick` — clicking them did nothing. Fixed by adding an `onAsk` prop to `PolicyIllustration` and passing `onAsk={send}` from the parent. This is a good example of why prop-drilling beats implicit coupling for small component trees.

---

### 13. SQLite for persistence (vs. PostgreSQL)

**Decision:** SQLite with SQLAlchemy ORM.

**Tradeoff:** Zero infrastructure overhead, trivially portable, sufficient for < ~50 concurrent writes/second. Drawbacks: no concurrent write scaling, no native full-text search, no pg_vector for future embedding queries. For an internal compliance tool used by a Finance team processing dozens of submissions per day, SQLite is appropriate. The `DATABASE_URL` env var allows swapping to PostgreSQL without code changes.

---

### 14. Stateless per-upload pipeline (vs. async queue)

**Decision:** Each receipt upload triggers an immediate synchronous extraction + verdict call. No background queue.

**Why:** Simplicity and immediate feedback. The user sees their verdict in ~3–5 seconds. A background queue (Celery/Redis) would require a websocket for status updates, adding significant operational complexity.

**Tradeoff:** Above ~20 concurrent uploads, the server blocks. At 10,000 submissions/day the stateless model breaks. The right path at scale: accept upload → return job ID → poll `/api/jobs/{id}` → deliver result when ready. Not worth the complexity at current scale.

---

## Failure Modes

**Receipt extraction fails:** Claude returns malformed JSON, or `re.search` finds no JSON object. The upload returns HTTP 500 with a user-visible error. The receipt file is saved to disk but no line item is created. Retry works.

**Verdict confidence is always low:** Usually indicates retrieval is broken (vector store not indexed, or corrupted). Check that `chroma_db/store.json` and `tfidf_matrix.npy` exist and are non-empty. Re-indexing is triggered automatically on startup if policies are present.

**Policy recall is low on eval:** The most common cause is `expected_policy_ids` using filenames (`POLICY1`) instead of the TEP IDs embedded in chunk text (`TEP-002`). The system indexes by filename but the model reads TEP IDs from within the document text. Use the TEP IDs in `expected_policy_ids`.

**Out-of-scope questions answered confidently:** If retrieval scores are inflated (e.g., the index contains non-policy documents), the 0.30 refusal threshold may not trigger. Keep the `policies/` directory clean.

**Duplicate detection false positives:** Same vendor, same amount, different employee on a shared expense. Currently treated as duplicate because the check is within a single submission. True deduplication would require cross-submission comparison with employee context.

---

## Debugging & Observability

The system has two complementary debug trails, deliberately layered to cover different failure modes.

### 1. Structured application log (stdout)

`main.py` sets up Python's standard logging at INFO level with timestamps and module names:

```
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
```

Every meaningful operation emits a log line. This was the primary tool during development for tracing exactly what happened on each request:

| Event | What gets logged |
|---|---|
| Startup | Each phase: DB init → employee seed count → policy index (N docs, M chunks total) |
| Receipt upload | Extraction failures (malformed JSON, API errors) with full exception |
| Verdict | Failures with exception; successful calls are implicit (no result log, just the stored item) |
| Policy indexing | Per-PDF chunk count + total new chunks added |
| Duplicate detection | Implicit in the verdict reasoning stored in the DB |

On Railway this log streams to the deployment dashboard in real time. Locally it writes to stdout — pipe to a file to keep a session record:

```bash
uvicorn backend.main:app --port 8080 2>&1 | tee session.log
```

This was used extensively during eval debugging: when verdict accuracy was 10% (before the numpy int64 fix), the logs showed `Failed to load TF-IDF index` on every request, which immediately pointed to the corrupted vocab.json as the root cause.

### 2. Per-item audit trail in SQLite

The `AuditLog` table records every manual override with full before/after state:

```python
AuditLog(
    line_item_id = item_id,
    submission_id = item.submission_id,
    action        = "override",
    old_value     = {"verdict": previous_verdict},
    new_value     = {"verdict": new_verdict, "comment": comment, "reviewer": reviewer},
    actor         = reviewer,
    timestamp     = datetime.utcnow(),
)
```

Accessible via `GET /api/items/{item_id}/audit` and rendered in the UI as a collapsible "Audit Trail" panel on each line item card. This answers "who changed this, from what to what, and why" without needing to reconstruct history from logs.

### 3. Full extraction output stored per receipt

`LineItem.extracted_data` (JSON column) stores the complete Claude extraction response for every receipt — not just the fields that were used for the verdict, but everything including `alcohol_amount`, `tip_amount`, `tax_amount`, `meal_type_guess`, and raw `line_items`. This means if a verdict looks wrong, you can inspect exactly what Claude extracted without re-running the receipt, and distinguish between an extraction error and a verdict error.

`LineItem.policy_clauses` stores the verbatim policy citations alongside each verdict, including the quoted text and relevance note. If a verdict cites the wrong policy section, this is immediately visible without re-running retrieval.

---

## Running the Eval Harness

Start the server first, then:

```bash
# Against local server
python eval/harness.py --cases eval/cases.json --base-url http://localhost:8080

# Against the live deployment
python eval/harness.py --cases YOUR_HELD_OUT_SET.json --base-url https://northwind-production.up.railway.app
```

Results are written to `eval/results.json`.

### Eval Metrics

| Metric | What it measures |
|---|---|
| **Verdict accuracy** | Exact match: compliant / flagged / rejected / needs_review |
| **Policy recall** | Fraction of expected TEP doc IDs present in returned citations |
| **Refusal accuracy** | Correct refused/answered on QA cases |
| **Mean confidence** | Average model confidence on verdict cases |
| **Overall pass rate** | All checks passed / total cases |

### Held-out test set format

The harness accepts any JSON file matching this schema:

```json
[
  {
    "id": "unique_id",
    "type": "verdict",
    "description": "human label",
    "receipt_text": "raw receipt text",
    "employee": {"name": "...", "grade": 5, "title": "...", "department": "..."},
    "trip": {"trip_purpose": "...", "trip_destination": "...", "trip_start": "YYYY-MM-DD", "trip_end": "YYYY-MM-DD"},
    "expected_verdict": "compliant|flagged|rejected|needs_review",
    "expected_policy_ids": ["TEP-002"]
  },
  {
    "id": "unique_id",
    "type": "qa",
    "question": "...",
    "expected_refused": false
  }
]
```

### Honest limitations of the included dev set

The included `eval/cases.json` (50 cases) was built during development to cover known policy scenarios — not as a ground-truth benchmark. **It should not be the primary evaluation signal.** Specific caveats:

- All receipt texts are synthetic and written to clearly match specific policy clauses. Real receipts will be messier: missing dates, bundled charges ("dinner + bar tab"), foreign currencies, varying vendor name formats.
- `expected_policy_ids` requires the model to cite the exact TEP document ID. If retrieval surfaces a correct-but-differently-labelled chunk (e.g., same section from a later page), policy recall will undercount.
- The `flagged` / `rejected` boundary is genuinely ambiguous for some scenarios. This system interprets "not reimbursable" language in policy as `rejected` and "requires approval" language as `flagged`. A different reading is defensible.
- QA refusal cases are sensitive to retrieval score thresholds. The 0.30 threshold was tuned on this policy set; a different corpus may need adjustment.

The included dev set achieves ~82% overall pass rate. The meaningful test is a held-out set the system has never seen.

---

## Cost Breakdown

### Per submission (~3–5 receipts)

| Step | Model | Tokens (est.) | Cost |
|---|---|---|---|
| Receipt extraction (×4 receipts) | claude-sonnet-4-20250514 | ~800 in + ~300 out each | ~$0.04 |
| Compliance verdict (×4 receipts) | claude-sonnet-4-20250514 | ~2000 in + ~500 out each | ~$0.07 |
| Policy Q&A (optional, per question) | claude-sonnet-4-20250514 | ~1500 in + ~400 out | ~$0.02 |
| **Total per submission** | | | **~$0.09–0.12** |

### Scaling to 10,000 submissions/day

| Component | Current | At 10k/day |
|---|---|---|
| Claude API cost | $0.10/sub | ~$1,000/day |
| Vector store | local TF-IDF file | Same (re-index on deploy) or Chroma Cloud |
| Database | SQLite | PostgreSQL on Railway (~$25/mo) |
| Compute | single uvicorn process | 3–5 workers + Celery queue |
| Storage (receipts) | local disk | S3/R2 (~$5/mo for 50GB) |

Key optimization at scale: Anthropic's prompt caching API for the policy chunk context, which is identical across all verdict calls in a session. Estimated 40–60% token cost reduction.

---

## What I'd Do Next

1. **Prompt caching** — The policy chunk context is the same for every verdict call; cache it with Anthropic's prompt caching API to cut costs by ~40–60%.
2. **File-content deduplication** — Hash the raw receipt bytes (SHA-256) on upload; block exact duplicates before extraction rather than detecting them post-hoc via field matching.
3. **Batch processing endpoint** — Accept a ZIP of receipts and process asynchronously with a Celery/Redis queue; return status via websocket.
4. **Submission-level verdict roll-up** — Aggregate line item verdicts into a submission status (`approved` / `requires_review` / `rejected`) with manager email notification.
5. **Manager approval workflow** — Add `/submissions/{id}/approve` with role-based access; integrate with email via SendGrid.
6. **Fine-tuned extraction model** — After 500+ extraction examples, fine-tune Haiku for receipt extraction to cut cost 10×.
7. **PostgreSQL + pgvector** — Replace SQLite + TF-IDF with a single PostgreSQL instance; pgvector for embeddings reduces operational surface area and enables semantic search.
8. **Better heading detection** — Current regex misses some policy structures (e.g., bold text, indented sub-sections). A layout-aware parser (pdfminer LTPage) would improve chunk quality and retrieval precision.

---

## Deployment (Railway)

```bash
# Set environment variables in Railway dashboard:
# ANTHROPIC_API_KEY, DB_PATH, CHROMA_PATH, etc.

railway up
```

The `railway.toml` + `nixpacks.toml` handle:
1. Installing Python 3.11 + Node 20
2. `pip install -r requirements.txt`
3. `cd frontend && npm install && npm run build`
4. Starting uvicorn on `$PORT`

A Railway volume mounted at `/data` provides persistent storage for the SQLite database, TF-IDF index, and uploaded receipts across deploys.
