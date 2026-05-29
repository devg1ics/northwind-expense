# Northwind Logistics — AI Expense Review System

An end-to-end expense compliance platform that extracts structured data from receipts (PDF/image/text), evaluates each line item against company policy using RAG + Claude, and surfaces a verdict with policy citations directly in a React UI.

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
uvicorn backend.main:app --reload --port 8000
```

On first boot the server will:
- Create `northwind.db` with all tables
- Seed employees from `submissions/*/employee_info.json`
- Index all PDFs in `policies/` into the TF-IDF vector store (`chroma_db/`)

### 6. Open the app

Navigate to [http://localhost:8000](http://localhost:8000) (served from `frontend/dist/`), or run `npm run dev` in `frontend/` during development (proxies `/api` to `:8000`).

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **Required.** Claude API key |
| `DB_PATH` | `./northwind.db` | SQLite database path |
| `CHROMA_PATH` | `./chroma_db` | TF-IDF vector store persistence directory |
| `POLICIES_DIR` | `./policies` | Directory of policy PDFs to index |
| `SUBMISSIONS_DIR` | `./submissions` | Seed data directory |
| `UPLOADS_DIR` | `./uploads` | Where uploaded receipts are stored |

---

## Running the Eval Harness

Start the server first, then:

```bash
python eval/harness.py --cases eval/cases.json --base-url http://localhost:8000
```

Results are written to `eval/results.json`.

---

## Eval Metrics (target)

| Metric | Target | Notes |
|---|---|---|
| Verdict accuracy | ≥ 80% | Exact match on 3 verdict cases |
| Policy recall | ≥ 75% | Citation doc IDs that match expected |
| Refusal accuracy | 100% | Out-of-scope questions correctly refused |
| Mean confidence | ≥ 0.60 | Average model confidence on verdict cases |
| Pass rate | ≥ 83% | 5/6 cases passing |

---

## Design Decisions & Tradeoffs

### 1. Claude for both extraction and verdict (vs. dedicated OCR + rules engine)
**Decision:** Use Claude claude-sonnet-4-20250514 for receipt extraction AND compliance verdict in two sequential calls.

**Tradeoff:** Higher per-receipt cost (~$0.05–0.08 per receipt) vs. dedicated OCR (Tesseract/AWS Textract at ~$0.002). The benefit is dramatically better handling of varied receipt formats—handwritten totals, ambiguous line items, foreign-language receipts—without maintaining a fragile rules engine. Claude can also reason about edge cases ("is this a client dinner or a personal meal?") that rules would miss.

**Alternative considered:** Tesseract OCR + regex extraction + hard-coded policy rules. Rejected because it fails on unusual receipt formats and requires constant maintenance as policies change.

### 2. Hybrid retrieval: TF-IDF (dense) + BM25 (sparse) re-ranking
**Decision:** Use TF-IDF cosine similarity (scikit-learn, bigrams, sublinear TF) as the dense component, then re-rank with BM25Okapi using a 65/35 dense/sparse blend. Persisted to disk as JSON + .npy so it survives restarts.

**Why TF-IDF instead of embedding-based dense search:** Policy documents use highly controlled vocabulary — specific policy IDs like "TEP-002 §2.3", dollar amounts, grade references. Neural embeddings (ChromaDB / sentence-transformers) add deployment complexity (hnswlib requires MSVC on Windows, heavy PyTorch) with diminishing returns for this domain. TF-IDF with bigrams captures these exact-match patterns effectively, and BM25 further boosts recall for specific numeric and ID tokens.

**Tradeoff:** TF-IDF won't generalise to *semantic paraphrases* the way a neural encoder would (e.g., "food expenses" vs. "meal allowances"). Mitigation: BM25 + synonym-rich queries in the verdict engine cover most of this gap for policy text.

**Alternative considered:** ChromaDB with `chroma-hnswlib`. Ideal for semantic retrieval but requires C++ build tools on Windows. Would add it for production (or use Chroma Cloud) where infrastructure is controlled.

### 3. SQLite for persistence (vs. PostgreSQL)
**Decision:** SQLite with SQLAlchemy ORM.

**Tradeoff:** Zero infrastructure overhead, trivially portable, sufficient for < ~50 concurrent writes/second. Tradeoff is no concurrent write scaling beyond that, and no native full-text search. For a compliance review tool used by a Finance team, SQLite is appropriate; swap `DATABASE_URL` to PostgreSQL for production at scale.

### 4. Confidence threshold gating (< 0.55 → needs_review)
**Decision:** If Claude returns confidence < 0.55 and verdict is not `rejected`, downgrade to `needs_review`.

**Tradeoff:** Increases false-negative rate (more items flagged for human review) but reduces false positives (incorrectly approving borderline claims). For an expense compliance tool, false positives (approving non-compliant expenses) are more costly than false negatives.

**Alternative considered:** Pass all Claude verdicts through as-is. Rejected because low-confidence `compliant` verdicts on ambiguous alcohol + meal combos led to incorrect approvals in testing.

### 5. Stateless pipeline (extract → verdict per upload, no batch)
**Decision:** Each receipt upload triggers an immediate extraction + verdict call; no background queue.

**Tradeoff:** Simplicity and immediate feedback vs. throughput. A background queue (Celery/Redis) would be needed above ~20 concurrent uploads. For the scale of this system (dozens of submissions/day), synchronous processing is appropriate and avoids operational complexity.

**Alternative considered:** Async task queue with websocket status updates. Better UX at scale, but adds Redis dependency and significant complexity.

### 6. Policy chunking by headings vs. fixed-size windows
**Decision:** Chunk policy PDFs by detected section headings, with a 50-character minimum chunk size and fallback to whole-document if no headings found.

**Tradeoff:** Heading-based chunks preserve semantic coherence (a "Meal Allowances" section stays together) at the cost of variable chunk sizes. Fixed windows (e.g., 512 tokens) are simpler but split mid-policy, losing context. The heading approach produces better retrieval precision because the retrieved chunk corresponds to a complete policy rule.

**Alternative considered:** Recursive character text splitter (LangChain default). Produces consistent sizes but splits policy clauses mid-sentence, degrading retrieval quality.

### 7. Override + audit trail in the same DB (vs. separate audit service)
**Decision:** Store overrides directly on `LineItem` and log each change in `AuditLog`, both in SQLite.

**Tradeoff:** Simplest possible implementation. Drawback is that audit logs could be modified if someone has direct DB access; a separate append-only audit service (or signed log) would be more secure. For an internal compliance tool where DB access is restricted, this tradeoff is acceptable.

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
| ChromaDB | local file | Chroma Cloud or Weaviate (~$200/mo) |
| Database | SQLite | PostgreSQL on Railway/Render (~$25/mo) |
| Compute | single process | 3–5 uvicorn workers + Celery queue |
| Storage (receipts) | local disk | S3/R2 (~$5/mo for 50GB) |

**Key optimization at scale:** Add prompt caching for policy chunks (reuse across receipts in the same session) to reduce extraction token cost by ~60%.

---

## What I'd Do Next

1. **Prompt caching** — The policy chunk context is the same for every verdict call; cache it with Anthropic's prompt caching API to cut costs by ~40–60%.
2. **Batch processing endpoint** — Accept a ZIP of receipts and process asynchronously with a Celery/Redis queue; return status via websocket.
3. **Submission-level roll-up verdict** — Aggregate line item verdicts into a submission status (`approved`/`requires_review`/`rejected`) with manager notification.
4. **Manager approval workflow** — Add a `/submissions/{id}/approve` endpoint with role-based access; integrate with email via SendGrid.
5. **Fine-tuned extraction model** — After collecting 500+ extraction examples, fine-tune a smaller model (Haiku) for receipt extraction to cut cost 10×.
6. **PostgreSQL + pgvector** — Replace SQLite + ChromaDB with a single PostgreSQL instance using pgvector for embeddings; reduces operational surface area.
7. **Better heading detection** — Current regex-based heading detection misses some policy structures. A layout-aware parser (pdfminer with LTPage) would improve chunk quality.
8. **Receipt deduplication** — Hash file content on upload to prevent double-submission of the same receipt.

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
