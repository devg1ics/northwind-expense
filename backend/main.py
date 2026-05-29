import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()

# Ensure persistent data directories exist (used on Railway with /data volume)
os.makedirs(os.getenv("CHROMA_PATH", "/data/chroma_db"), exist_ok=True)
os.makedirs(os.getenv("UPLOADS_DIR", "/data/uploads"), exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)

SUBMISSIONS_DIR = os.getenv("SUBMISSIONS_DIR", "./submissions")
POLICIES_DIR = os.getenv("POLICIES_DIR", "./policies")

def seed_employees():
    from backend.db.database import SessionLocal
    from backend.db.models import Employee

    db = SessionLocal()
    seeded = 0
    try:
        for sub_dir in Path(SUBMISSIONS_DIR).iterdir():
            emp_file = sub_dir / "employee_info.json"
            if not emp_file.exists():
                continue
            with open(emp_file) as f:
                data = json.load(f)

            email = data.get("email") or f"{data.get('employee_id', sub_dir.name).lower()}@northwindlogistics.com"
            existing = db.query(Employee).filter(Employee.email == email).first()
            if existing:
                continue

            trip_dates = data.get("trip_dates", "")
            trip_start = trip_end = None
            if " to " in trip_dates:
                parts = trip_dates.split(" to ")
                trip_start, trip_end = parts[0].strip(), parts[1].strip()

            emp = Employee(
                employee_id=data.get("employee_id"),
                name=data.get("name", "Unknown"),
                email=email,
                grade=data.get("grade", 5),
                title=data.get("title"),
                department=data.get("department"),
                manager_name=data.get("manager_name") or data.get("manager_id"),
                home_base=data.get("home_base"),
            )
            db.add(emp)
            db.flush()

            # Pre-create submission from the seed data
            from backend.db.models import Submission
            sub = Submission(
                employee_id=emp.id,
                trip_purpose=data.get("trip_purpose"),
                trip_destination=data.get("trip_destination"),
                trip_start=trip_start,
                trip_end=trip_end,
            )
            db.add(sub)
            seeded += 1

        db.commit()
        logger.info(f"Seeded {seeded} new employees")
    except Exception as e:
        logger.error(f"Seed failed: {e}")
        db.rollback()
    finally:
        db.close()

def index_policies():
    from backend.pipeline.indexer import index_all_policies
    try:
        results = index_all_policies(POLICIES_DIR)
        total = sum(results.values())
        logger.info(f"Indexed {len(results)} policy docs, {total} chunks total")
    except Exception as e:
        logger.error(f"Policy indexing failed: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.db.database import init_db
    logger.info("Starting up — initializing DB")
    init_db()
    logger.info("Seeding employees")
    seed_employees()
    logger.info("Indexing policies")
    index_policies()
    logger.info("Startup complete")
    yield
    logger.info("Shutting down")

app = FastAPI(title="Northwind Expense Review", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.api.routes.expenses import router as expenses_router
from backend.api.routes.policy import router as policy_router

app.include_router(expenses_router, prefix="/api")
app.include_router(policy_router, prefix="/api")

@app.get("/api/health")
def health():
    return {"status": "ok"}

# Serve frontend static files (built by Vite)
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
