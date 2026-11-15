"""Astronaut registration, login, password."""
import sqlite3
from datetime import datetime
from fastapi import APIRouter, Body, Request, Response

from app.config import IDRE, POSITIONS
from app.database import db
from app.errors import HttpError
from app.security import hash_pw, need_user, new_session, set_cookie
from app.services.auth import change_pw, do_login, do_logout, user_out
from app.utils import calc_age, iso, now


router = APIRouter()


@router.post("/api/register")
def r_register(request: Request, response: Response, d: dict = Body(default={})):
    errs = {}
    s = lambda k: str(d.get(k, "")).strip()
    first, last, pos, aid, pw = s("first_name"), s("last_name"), s("position"), s("astro_id"), str(d.get("password", ""))
    if not 3 <= len(first) <= 16: errs["first_name"] = "First name must be 3–16 characters."
    if not 3 <= len(last) <= 16: errs["last_name"] = "Last name must be 3–16 characters."
    if pos not in POSITIONS: errs["position"] = "Select a position from the list."
    bd = None
    try:
        bd = datetime.strptime(s("birth_date"), "%Y-%m-%d").date()
        if not 18 <= calc_age(bd) <= 90:
            errs["birth_date"] = "Age must be between 18 and 90."
    except ValueError:
        errs["birth_date"] = "Enter a valid date of birth."
    if not IDRE.match(aid): errs["astro_id"] = "ID must be 3–20 characters: letters, numbers, or hyphens."
    if not 3 <= len(pw) <= 8: errs["password"] = "Password must be 3–8 characters."
    elif pw.lower() == aid.lower(): errs["password"] = "Password must not match the ID."
    if errs:
        raise HttpError(400, "Please check the information you entered.", fields=errs)
    c = db()
    try:
        try:
            cur = c.execute("INSERT INTO users(astro_id,first_name,last_name,position,birth_date,password_hash,created_at) VALUES(?,?,?,?,?,?,?)",
                            (aid, first, last, pos, bd.isoformat(), hash_pw(pw), iso(now())))
        except sqlite3.IntegrityError:
            raise HttpError(409, "This ID is already registered.", fields=dict(astro_id="ID is already in use."))
        tok = new_session(c, "user", cur.lastrowid)
        u = c.execute("SELECT * FROM users WHERE id=?", (cur.lastrowid,)).fetchone()
    finally:
        c.close()
    set_cookie(response, "user", tok)
    return dict(user=user_out(u))


@router.post("/api/login")
def r_login(request: Request, response: Response, d: dict = Body(default={})):
    return do_login(request, response, d, "user", "users", "astro_id")


@router.post("/api/logout")
def r_logout(request: Request, response: Response, d: dict = Body(default={})):
    return do_logout(request, response, "user")


@router.get("/api/me")
def r_me(request: Request):
    return dict(user=user_out(need_user(request, allow_must_change=True)))


@router.post("/api/password")
def r_password(request: Request, response: Response, d: dict = Body(default={})):
    return change_pw(response, d, "user", "users", need_user(request, allow_must_change=True), 3, 8)
