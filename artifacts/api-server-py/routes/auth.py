import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from urllib.parse import urlencode, quote

import httpx
from fastapi import APIRouter, Request, Response, Depends, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session as DBSession

from db.database import get_db
from lib.auth import (
    SESSION_COOKIE, SESSION_TTL_SECONDS, ISSUER_URL,
    create_session, get_session, delete_session, update_session, upsert_user
)

router = APIRouter()

OIDC_CONFIG_CACHE: Optional[dict] = None
OIDC_COOKIE_TTL = 10 * 60


async def get_oidc_config() -> dict:
    global OIDC_CONFIG_CACHE
    if OIDC_CONFIG_CACHE:
        return OIDC_CONFIG_CACHE
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{ISSUER_URL}/.well-known/openid-configuration")
        OIDC_CONFIG_CACHE = resp.json()
    return OIDC_CONFIG_CACHE


def get_session_id(request: Request) -> Optional[str]:
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return request.cookies.get(SESSION_COOKIE)


def set_session_cookie(response: Response, sid: str):
    response.set_cookie(
        key=SESSION_COOKIE,
        value=sid,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
        max_age=SESSION_TTL_SECONDS,
    )


def get_origin(request: Request) -> str:
    replit_dev_domain = os.environ.get("REPLIT_DEV_DOMAIN")
    if replit_dev_domain:
        return f"https://{replit_dev_domain}"
    proto = request.headers.get("x-forwarded-proto", "https")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "localhost")
    return f"{proto}://{host}"


def safe_return_to(value: Optional[str]) -> str:
    if not value or not value.startswith("/") or value.startswith("//"):
        return "/"
    return value


async def get_current_user(request: Request, db: DBSession = Depends(get_db)) -> Optional[dict]:
    sid = get_session_id(request)
    if not sid:
        return None
    session = get_session(db, sid)
    if not session or not session.get("user", {}).get("id"):
        return None
    return session.get("user")


@router.get("/auth/user")
async def get_auth_user(request: Request, db: DBSession = Depends(get_db)):
    user = await get_current_user(request, db)
    return {"user": user}


@router.get("/login")
async def login(request: Request, returnTo: str = "/"):
    config = await get_oidc_config()
    callback_url = f"{get_origin(request)}/api/callback"
    return_to = safe_return_to(returnTo)

    state = secrets.token_hex(16)
    nonce = secrets.token_hex(16)
    code_verifier = secrets.token_urlsafe(64)

    import hashlib, base64
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()

    params = {
        "client_id": os.environ.get("REPL_ID", ""),
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid email profile offline_access",
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "prompt": "login consent",
        "state": state,
        "nonce": nonce,
    }

    auth_endpoint = config.get("authorization_endpoint", "")
    redirect_url = f"{auth_endpoint}?{urlencode(params)}"

    response = RedirectResponse(redirect_url)
    cookie_opts = {"httponly": True, "secure": True, "samesite": "lax", "path": "/", "max_age": OIDC_COOKIE_TTL}
    response.set_cookie("code_verifier", code_verifier, **cookie_opts)
    response.set_cookie("nonce", nonce, **cookie_opts)
    response.set_cookie("state", state, **cookie_opts)
    response.set_cookie("return_to", return_to, **cookie_opts)

    return response


@router.get("/callback")
async def callback(request: Request, db: DBSession = Depends(get_db)):
    config = await get_oidc_config()
    callback_url = f"{get_origin(request)}/api/callback"

    code_verifier = request.cookies.get("code_verifier")
    expected_state = request.cookies.get("state")
    nonce = request.cookies.get("nonce")
    return_to = safe_return_to(request.cookies.get("return_to"))

    if not code_verifier or not expected_state:
        return RedirectResponse("/api/login")

    query_params = dict(request.query_params)
    code = query_params.get("code")
    state = query_params.get("state")

    if state != expected_state or not code:
        return RedirectResponse("/api/login")

    token_endpoint = config.get("token_endpoint", "")
    async with httpx.AsyncClient() as client:
        try:
            token_resp = await client.post(token_endpoint, data={
                "grant_type": "authorization_code",
                "client_id": os.environ.get("REPL_ID", ""),
                "code": code,
                "redirect_uri": callback_url,
                "code_verifier": code_verifier,
            })
            tokens = token_resp.json()
        except Exception:
            return RedirectResponse("/api/login")

    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    expires_in = tokens.get("expires_in")

    if not access_token:
        return RedirectResponse("/api/login")

    userinfo_endpoint = config.get("userinfo_endpoint", "")
    async with httpx.AsyncClient() as client:
        try:
            userinfo_resp = await client.get(userinfo_endpoint, headers={"Authorization": f"Bearer {access_token}"})
            claims = userinfo_resp.json()
        except Exception:
            return RedirectResponse("/api/login")

    db_user = upsert_user(db, claims)

    now = int(datetime.now(timezone.utc).timestamp())
    expires_at = now + expires_in if expires_in else None

    user_data = {
        "id": db_user.id,
        "email": db_user.email,
        "firstName": db_user.first_name,
        "lastName": db_user.last_name,
        "profileImageUrl": db_user.profile_image_url,
    }

    sid = create_session(db, user_data, access_token, refresh_token, expires_at)
    response = RedirectResponse(return_to)
    set_session_cookie(response, sid)

    for cookie_name in ["code_verifier", "nonce", "state", "return_to"]:
        response.delete_cookie(cookie_name, path="/")

    return response


@router.get("/logout")
async def logout(request: Request, db: DBSession = Depends(get_db)):
    config = await get_oidc_config()
    origin = get_origin(request)
    sid = get_session_id(request)

    if sid:
        delete_session(db, sid)

    end_session_endpoint = config.get("end_session_endpoint", "")
    params = {
        "client_id": os.environ.get("REPL_ID", ""),
        "post_logout_redirect_uri": origin,
    }
    logout_url = f"{end_session_endpoint}?{urlencode(params)}"

    response = RedirectResponse(logout_url)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


@router.post("/mobile-auth/token-exchange")
async def mobile_token_exchange(request: Request, db: DBSession = Depends(get_db)):
    body = await request.json()
    code = body.get("code")
    code_verifier = body.get("code_verifier")
    redirect_uri = body.get("redirect_uri")
    state = body.get("state")
    nonce = body.get("nonce")

    if not all([code, code_verifier, redirect_uri, state]):
        raise HTTPException(status_code=400, detail="Missing required parameters")

    config = await get_oidc_config()
    token_endpoint = config.get("token_endpoint", "")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(token_endpoint, data={
            "grant_type": "authorization_code",
            "client_id": os.environ.get("REPL_ID", ""),
            "code": code,
            "redirect_uri": redirect_uri,
            "code_verifier": code_verifier,
        })
        tokens = token_resp.json()

    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Token exchange failed")

    userinfo_endpoint = config.get("userinfo_endpoint", "")
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(userinfo_endpoint, headers={"Authorization": f"Bearer {access_token}"})
        claims = userinfo_resp.json()

    db_user = upsert_user(db, claims)
    now = int(datetime.now(timezone.utc).timestamp())
    expires_at = now + tokens.get("expires_in", 3600)

    user_data = {
        "id": db_user.id,
        "email": db_user.email,
        "firstName": db_user.first_name,
        "lastName": db_user.last_name,
        "profileImageUrl": db_user.profile_image_url,
    }

    sid = create_session(db, user_data, access_token, tokens.get("refresh_token"), expires_at)
    return {"token": sid}


@router.post("/mobile-auth/logout")
async def mobile_logout(request: Request, db: DBSession = Depends(get_db)):
    sid = get_session_id(request)
    if sid:
        delete_session(db, sid)
    return {"success": True}
