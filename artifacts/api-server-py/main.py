import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, interviews, jobs, scheduled_interviews, profile, health
from db.database import engine
from db.models import Base

Base.metadata.create_all(engine)

def _run_migrations():
    from sqlalchemy import text
    new_columns = [
        ("scheduled_interviews", "interview_type", "TEXT DEFAULT 'Mixed'"),
        ("scheduled_interviews", "coding_language", "TEXT DEFAULT 'Candidate''s Choice'"),
        ("scheduled_interviews", "question_complexity", "TEXT DEFAULT 'Moderate'"),
        ("interview_reports", "coding_score", "INTEGER"),
        ("interview_reports", "technical_score", "INTEGER"),
        ("interview_reports", "strengths", "JSONB DEFAULT '[]'"),
        ("interview_reports", "red_flags", "JSONB DEFAULT '[]'"),
        ("interview_reports", "growth_areas", "JSONB DEFAULT '[]'"),
        ("interview_reports", "hiring_rationale", "JSONB DEFAULT '{}'"),
        ("interview_reports", "interview_pacing", "JSONB DEFAULT '{}'"),
        ("interviews", "coding_questions_count", "INTEGER DEFAULT 1"),
    ]
    with engine.connect() as conn:
        for table, col, col_def in new_columns:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}"))
                conn.commit()
            except Exception:
                pass

_run_migrations()

app = FastAPI(title="Vocalize.ai API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(interviews.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(scheduled_interviews.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(health.router, prefix="/api")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
