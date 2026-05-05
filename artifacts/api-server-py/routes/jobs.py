from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from db.database import get_db
from db.models import Job
from routes.auth import get_current_user
from lib.ai import get_openai_client, parse_json_response

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


@router.post("/jobs/{job_id}/generate-questions")
async def generate_job_questions(job_id: int, request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == user["id"]).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    skills = job.skills or []
    skill_names = [s["name"] for s in skills if isinstance(s, dict) and s.get("name")]
    skill_levels = {s["name"]: s.get("requiredLevel", 7) for s in skills if isinstance(s, dict)}

    skill_section = ""
    if skill_names:
        skill_section = "\n".join(
            f"- {name} (proficiency required: {skill_levels.get(name, 7)}/10)"
            for name in skill_names
        )
    else:
        skill_section = "General software engineering skills"

    prompt = f"""You are an expert technical interviewer. Generate exactly 50 high-quality interview questions for the following job role.

Role: {job.role}
Job Title: {job.title}
Job Description: {job.description[:800] if job.description else ""}

Required Skills:
{skill_section}

Generate exactly 50 questions spread across these categories (use all if applicable):
- Behavioral (7 questions): Situational, STAR-method, soft skills
- Technical Theory (10 questions): Concepts, design, architecture
- Skill-Specific (20 questions): Directly test the required skills, 2-3 questions per skill
- Problem Solving (8 questions): Algorithms, logic, system design thinking
- Role-Specific (5 questions): Specific to the job title/domain

Return ONLY valid JSON with this structure (no markdown, no extra text):
{{
  "questions": [
    {{
      "id": 1,
      "category": "Behavioral|Technical Theory|Skill-Specific|Problem Solving|Role-Specific",
      "skill": "skill name if skill-specific, else null",
      "difficulty": "Easy|Medium|Hard",
      "question": "The full question text"
    }}
  ]
}}"""

    client = get_openai_client()
    resp = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_completion_tokens=4000,
        temperature=0.7,
    )
    raw = resp.choices[0].message.content or ""
    data = parse_json_response(raw)
    questions = data.get("questions", []) if data else []
    return {"jobId": job_id, "role": job.role, "title": job.title, "questions": questions}


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
