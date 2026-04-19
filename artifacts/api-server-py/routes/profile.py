from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from db.database import get_db
from db.models import User, Interview, InterviewReport
from routes.auth import get_current_user

router = APIRouter()


@router.get("/profile/me")
async def get_profile(request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    db_user = db.query(User).filter(User.id == user["id"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_dict(db_user)


@router.patch("/profile/me")
async def update_profile(request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    db_user = db.query(User).filter(User.id == user["id"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    body = await request.json()
    for field in ["firstName", "lastName", "bio", "publicResume", "customProfileImage", "phone"]:
        snake = _to_snake(field)
        if field in body:
            setattr(db_user, snake, body[field])
    db.commit()
    db.refresh(db_user)
    return _user_to_dict(db_user)


@router.get("/profile/{user_id}/public")
async def get_public_profile(user_id: str, db: DBSession = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    interviews = db.query(Interview).filter(Interview.user_id == user_id).all()
    completed = [i for i in interviews if i.status == "completed"]
    recent = completed[-5:]
    reports = []
    for iv in recent:
        r = db.query(InterviewReport).filter(InterviewReport.interview_id == iv.id).first()
        if r:
            reports.append(r)

    avg_score = round(sum(r.overall_score for r in reports) / len(reports)) if reports else None

    result = _user_to_dict(db_user)
    result["completedInterviews"] = len(completed)
    result["avgScore"] = avg_score
    return result


def _to_snake(name: str) -> str:
    import re
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


def _user_to_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "profileImageUrl": user.profile_image_url,
        "customProfileImage": user.custom_profile_image,
        "phone": user.phone,
        "bio": user.bio,
        "publicResume": user.public_resume,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
        "updatedAt": user.updated_at.isoformat() if user.updated_at else None,
    }
