import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session as DBSession
from db.models import Session, User

SESSION_COOKIE = "sid"
SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
ISSUER_URL = os.environ.get("ISSUER_URL", "https://replit.com/oidc")


def create_session(db: DBSession, user_data: dict, access_token: str, refresh_token: Optional[str] = None, expires_at: Optional[int] = None) -> str:
    sid = secrets.token_hex(32)
    sess_data = {
        "user": user_data,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": expires_at,
    }
    expire = datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)
    session = Session(sid=sid, sess=sess_data, expire=expire)
    db.add(session)
    db.commit()
    return sid


def get_session(db: DBSession, sid: str) -> Optional[dict]:
    session = db.query(Session).filter(Session.sid == sid).first()
    if not session:
        return None
    if session.expire < datetime.now(timezone.utc).replace(tzinfo=None):
        db.delete(session)
        db.commit()
        return None
    return session.sess


def delete_session(db: DBSession, sid: str) -> None:
    session = db.query(Session).filter(Session.sid == sid).first()
    if session:
        db.delete(session)
        db.commit()


def update_session(db: DBSession, sid: str, data: dict) -> None:
    session = db.query(Session).filter(Session.sid == sid).first()
    if session:
        session.sess = data
        session.expire = datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)
        db.commit()


def upsert_user(db: DBSession, claims: dict) -> User:
    user_id = claims.get("sub", "")
    existing = db.query(User).filter(User.id == user_id).first()
    if existing:
        existing.email = claims.get("email")
        existing.first_name = claims.get("first_name")
        existing.last_name = claims.get("last_name")
        existing.profile_image_url = claims.get("profile_image_url") or claims.get("picture")
        db.commit()
        db.refresh(existing)
        return existing
    else:
        user = User(
            id=user_id,
            email=claims.get("email"),
            first_name=claims.get("first_name"),
            last_name=claims.get("last_name"),
            profile_image_url=claims.get("profile_image_url") or claims.get("picture"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
