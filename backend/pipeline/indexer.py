"""
Policy indexer — uses a TF-IDF vector store (scikit-learn) instead of ChromaDB so
the project runs on Windows without MSVC / hnswlib compilation. The public API
(index_pdf, index_all_policies, retrieve_policy_chunks) is identical to the
ChromaDB version; only the persistence layer differs.

Design rationale:
  Dense component: TF-IDF cosine similarity — captures term overlap, very effective
  for policy documents which use precise, controlled vocabulary (policy IDs, section refs).
  Sparse component: BM25Okapi (rank-bm25) — handles exact phrase and ID matches.
  Hybrid: 65% dense + 35% BM25, same weights as the original design.
  Persistence: JSON (metadata + raw text) + .npy (TF-IDF matrix) in CHROMA_PATH dir.
"""
import hashlib
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pdfplumber
from dotenv import load_dotenv
from rank_bm25 import BM25Okapi
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

load_dotenv()

logger = logging.getLogger(__name__)

CHROMA_PATH = os.getenv("CHROMA_PATH", "/data/chroma_db")
POLICIES_DIR = os.getenv("POLICIES_DIR", "./policies")

_STORE_JSON = os.path.join(CHROMA_PATH, "store.json")
_STORE_NPY  = os.path.join(CHROMA_PATH, "tfidf_matrix.npy")
_VOCAB_JSON = os.path.join(CHROMA_PATH, "vocab.json")

_store: Optional[Dict] = None
_tfidf_matrix: Optional[np.ndarray] = None
_vectorizer: Optional[TfidfVectorizer] = None


def _ensure_dir():
    Path(CHROMA_PATH).mkdir(parents=True, exist_ok=True)


def _load_store() -> Dict:
    global _store
    if _store is not None:
        return _store
    if Path(_STORE_JSON).exists():
        with open(_STORE_JSON, encoding="utf-8") as f:
            _store = json.load(f)
    else:
        _store = {"ids": [], "documents": [], "metadatas": []}
    return _store


def _save_store(store: Dict):
    _ensure_dir()
    with open(_STORE_JSON, "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False)


def _rebuild_tfidf(store: Dict):
    global _tfidf_matrix, _vectorizer
    docs = store["documents"]
    if not docs:
        _tfidf_matrix = None
        _vectorizer = None
        return
    _vectorizer = TfidfVectorizer(
        sublinear_tf=True,
        ngram_range=(1, 2),
        max_features=30_000,
        min_df=1,
    )
    _tfidf_matrix = _vectorizer.fit_transform(docs).toarray().astype(np.float32)
    _ensure_dir()
    np.save(_STORE_NPY, _tfidf_matrix)
    with open(_VOCAB_JSON, "w", encoding="utf-8") as f:
        json.dump({
            "vocabulary_": {k: int(v) for k, v in _vectorizer.vocabulary_.items()},
            "idf_": _vectorizer.idf_.tolist(),
        }, f)


def _load_tfidf(store: Dict):
    global _tfidf_matrix, _vectorizer
    if _tfidf_matrix is not None and _vectorizer is not None:
        return
    if Path(_STORE_NPY).exists() and Path(_VOCAB_JSON).exists():
        try:
            _tfidf_matrix = np.load(_STORE_NPY)
            with open(_VOCAB_JSON, encoding="utf-8") as f:
                vocab_data = json.load(f)
            _vectorizer = TfidfVectorizer(
                sublinear_tf=True,
                ngram_range=(1, 2),
                max_features=30_000,
                min_df=1,
                vocabulary=vocab_data["vocabulary_"],
            )
            _vectorizer.idf_ = np.array(vocab_data["idf_"])
            return
        except Exception as e:
            logger.warning(f"Failed to load TF-IDF index ({e}), rebuilding")
    _rebuild_tfidf(store)


# ── PDF parsing ───────────────────────────────────────────────────────────────

def _extract_text_from_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    pages = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                if text.strip():
                    pages.append({"page": i + 1, "text": text})
    except Exception as e:
        logger.error(f"Failed to extract text from {pdf_path}: {e}")
    return pages


HEADING_PATTERNS = [
    re.compile(r"^\d+(\.\d+)*\s+[A-Z]"),
    re.compile(r"^[A-Z][A-Z\s]{4,}$"),
    re.compile(r"^[A-Z][a-z]+(\s+[A-Z][a-z]+){0,5}$"),
    re.compile(r"^(Section|Article|Part|Appendix)\s+\w+", re.IGNORECASE),
]


def _is_heading(line: str) -> bool:
    line = line.strip()
    if not line or len(line) > 100:
        return False
    return any(p.match(line) for p in HEADING_PATTERNS)


def _chunk_by_headings(pages: List[Dict], doc_id: str) -> List[Dict]:
    chunks: List[Dict] = []
    current_section = "Introduction"
    current_lines: List[str] = []
    current_page = 1

    def flush():
        text = "\n".join(current_lines).strip()
        if len(text) > 50:
            chunks.append({
                "section": current_section,
                "text": f"[{doc_id} — {current_section}]\n{text}",
                "page": current_page,
            })

    for page_data in pages:
        for line in page_data["text"].split("\n"):
            stripped = line.strip()
            if _is_heading(stripped) and stripped != current_section:
                flush()
                current_section = stripped
                current_lines = []
                current_page = page_data["page"]
            else:
                current_lines.append(line)
    flush()
    return chunks


# ── Public indexing API ───────────────────────────────────────────────────────

def index_pdf(pdf_path: str, doc_id: str, doc_title: str) -> int:
    store = _load_store()

    pages = _extract_text_from_pdf(pdf_path)
    if not pages:
        logger.warning(f"No text from {pdf_path}")
        return 0

    chunks = _chunk_by_headings(pages, doc_id)
    if not chunks:
        all_text = "\n\n".join(p["text"] for p in pages)
        chunks = [{"section": "Full Document", "text": all_text, "page": 1}]

    existing_ids = set(store["ids"])
    added = 0
    for chunk in chunks:
        chunk_hash = hashlib.md5(
            f"{doc_id}:{chunk['section']}:{chunk['text'][:100]}".encode()
        ).hexdigest()
        chunk_id = f"{doc_id}_{chunk_hash}"
        meta = {
            "document_id": doc_id,
            "document_title": doc_title,
            "section": chunk["section"],
            "page": chunk.get("page", 1),
        }
        if chunk_id in existing_ids:
            idx = store["ids"].index(chunk_id)
            store["documents"][idx] = chunk["text"]
            store["metadatas"][idx] = meta
        else:
            store["ids"].append(chunk_id)
            store["documents"].append(chunk["text"])
            store["metadatas"].append(meta)
            existing_ids.add(chunk_id)
            added += 1

    _save_store(store)

    global _store, _tfidf_matrix, _vectorizer
    _store = store
    _tfidf_matrix = None
    _vectorizer = None
    _rebuild_tfidf(store)

    logger.info(f"Indexed {len(chunks)} chunks from {doc_id} ({added} new)")
    return len(chunks)


def index_all_policies(policies_dir: str = None) -> Dict[str, int]:
    policies_dir = policies_dir or POLICIES_DIR
    results: Dict[str, int] = {}
    for pdf_file in sorted(Path(policies_dir).glob("*.pdf")):
        doc_id = pdf_file.stem.upper()
        doc_title = pdf_file.stem.replace("_", " ").title()
        results[doc_id] = index_pdf(str(pdf_file), doc_id, doc_title)
    logger.info(f"Indexed {len(results)} policy docs: {results}")
    return results


# ── Retrieval ─────────────────────────────────────────────────────────────────

def retrieve_policy_chunks(
    query: str,
    n_results: int = 7,
    extra_alcohol: bool = False,
) -> List[Dict[str, Any]]:
    store = _load_store()
    docs = store["documents"]
    if not docs:
        return []

    _load_tfidf(store)
    if _vectorizer is None or _tfidf_matrix is None:
        return []

    q_vec = _vectorizer.transform([query]).toarray().astype(np.float32)
    dense_scores = cosine_similarity(q_vec, _tfidf_matrix)[0]

    if extra_alcohol:
        alc_vec = _vectorizer.transform(["alcohol reimbursement policy spirits beer wine"]).toarray().astype(np.float32)
        alc_scores = cosine_similarity(alc_vec, _tfidf_matrix)[0]
        dense_scores = np.maximum(dense_scores, alc_scores * 0.8)

    tokenized = [d.lower().split() for d in docs]
    bm25 = BM25Okapi(tokenized)
    bm25_raw = np.array(bm25.get_scores(query.lower().split()), dtype=np.float32)
    max_bm25 = float(bm25_raw.max())
    norm_bm25 = bm25_raw / max_bm25 if max_bm25 > 0 else bm25_raw

    combined = 0.65 * dense_scores + 0.35 * norm_bm25
    top_indices = np.argsort(combined)[::-1][:n_results]

    return [
        {
            "text": docs[i],
            "metadata": store["metadatas"][i],
            "score": float(combined[i]),
        }
        for i in top_indices
    ]
