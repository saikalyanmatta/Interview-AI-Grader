from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from db.database import get_db
from db.models import Job
from routes.auth import get_current_user

router = APIRouter()


@router.get("/jobs")
async def list_jobs(request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    jobs = db.query(Job).filter(Job.user_id == user["id"]).all()
    return [_job_to_dict(j) for j in jobs]


@router.post("/jobs", status_code=201)
async def create_job(request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    body = await request.json()
    title = body.get("title")
    description = body.get("description")
    if not title or not description:
        raise HTTPException(status_code=400, detail="title and description are required")
    job = Job(
        user_id=user["id"],
        title=title,
        role=body.get("role", "Software Engineer"),
        description=description,
        skills=body.get("skills", []),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_to_dict(job)


@router.get("/jobs/{job_id}")
async def get_job(job_id: int, request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == user["id"]).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_dict(job)


@router.put("/jobs/{job_id}")
async def update_job(job_id: int, request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == user["id"]).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    body = await request.json()
    if "title" in body:
        job.title = body["title"]
    if "role" in body:
        job.role = body["role"]
    if "description" in body:
        job.description = body["description"]
    if "skills" in body:
        job.skills = body["skills"]
    db.commit()
    db.refresh(job)
    return _job_to_dict(job)


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_job(job_id: int, request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == user["id"]).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return None


def _job_to_dict(job: Job) -> dict:
    return {
        "id": job.id,
        "userId": job.user_id,
        "title": job.title,
        "role": job.role,
        "description": job.description,
        "skills": job.skills or [],
        "createdAt": job.created_at.isoformat() if job.created_at else None,
    }
