"""Admin API (everything below requires an admin session)."""
import secrets
from datetime import datetime
from fastapi import APIRouter, Body, Request, Response

from app.database import db
from app.errors import HttpError
from app.questionnaire import SOS_STATUSES
from app.security import hash_pw, need_admin
from app.services.auth import change_pw, do_login, do_logout, user_out
from app.services.health import history, latest_record, record_detail, series
from app.utils import calc_age, iso, now


router = APIRouter()


@router.post("/admin/api/login")
def a_login(request: Request, response: Response, d: dict = Body(default={})):
    return do_login(request, response, d, "admin", "admins", "username")


@router.post("/admin/api/logout")
def a_logout(request: Request, response: Response, d: dict = Body(default={})):
    return do_logout(request, response, "admin")


@router.get("/admin/api/me")
def a_me(request: Request):
    return dict(admin=dict(username=need_admin(request)["username"]))


@router.post("/admin/api/password")
def a_password(request: Request, response: Response, d: dict = Body(default={})):
    return change_pw(response, d, "admin", "admins", need_admin(request), 8, 128)


@router.get("/admin/api/users")
def a_users(request: Request):
    need_admin(request)
    c = db()
    try:
        rows = c.execute("""SELECT u.id,u.astro_id,u.first_name,u.last_name,u.position,u.birth_date,u.created_at,
          (SELECT overall FROM health_records WHERE user_id=u.id ORDER BY submitted_at DESC,id DESC LIMIT 1) overall,
          (SELECT submitted_at FROM health_records WHERE user_id=u.id ORDER BY submitted_at DESC,id DESC LIMIT 1) last_at,
          (SELECT COUNT(*) FROM health_records WHERE user_id=u.id) n_records,
          (SELECT COUNT(*) FROM sos_requests WHERE user_id=u.id AND status!='done') open_sos
          FROM users u ORDER BY u.last_name COLLATE NOCASE, u.first_name COLLATE NOCASE""").fetchall()
        out = []
        for r in rows:
            o = dict(r)
            o["age"] = calc_age(datetime.strptime(o["birth_date"], "%Y-%m-%d").date())
            out.append(o)
        return dict(users=out)
    finally:
        c.close()


@router.get("/admin/api/users/{uid}")
def a_user(request: Request, uid: int):
    need_admin(request)
    c = db()
    try:
        u = c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        if not u:
            raise HttpError(404, "Astronaut not found.")
        sos = c.execute("SELECT id,reason,description,status,created_at FROM sos_requests WHERE user_id=? ORDER BY created_at DESC", (u["id"],)).fetchall()
        o = user_out(u)
        o.pop("must_change")                      # password material is never exposed
        return dict(user=o, latest=latest_record(c, u["id"]), sos=[dict(r) for r in sos])
    finally:
        c.close()


@router.get("/admin/api/users/{uid}/records")
def a_user_records(request: Request, uid: int):
    need_admin(request)
    c = db()
    try:
        return dict(records=history(c, uid))
    finally:
        c.close()


@router.get("/admin/api/users/{uid}/records/{rid}")
def a_user_record(request: Request, uid: int, rid: int):
    need_admin(request)
    c = db()
    try:
        rec = record_detail(c, rid, uid)
        if not rec:
            raise HttpError(404, "Questionnaire not found.")
        return rec
    finally:
        c.close()


@router.get("/admin/api/users/{uid}/series")
def a_user_series(request: Request, uid: int, days: int = 0):
    need_admin(request)
    c = db()
    try:
        return dict(series=series(c, uid, max(0, min(36500, days))))   # days=0 → entire history
    finally:
        c.close()


@router.post("/admin/api/users/{uid}/reset-password")
def a_reset(request: Request, uid: int, d: dict = Body(default={})):
    need_admin(request)
    temp = secrets.token_urlsafe(9)
    c = db()
    try:
        if not c.execute("SELECT 1 FROM users WHERE id=?", (uid,)).fetchone():
            raise HttpError(404, "Astronaut not found.")
        c.execute("UPDATE users SET password_hash=?, must_change=1 WHERE id=?", (hash_pw(temp), uid))
        c.execute("DELETE FROM sessions WHERE kind='user' AND subject_id=?", (uid,))
        return dict(temp_password=temp)
    finally:
        c.close()


@router.get("/admin/api/critical")
def a_critical(request: Request):
    need_admin(request)
    c = db()
    try:
        rows = c.execute("""SELECT u.id uid,u.astro_id,u.first_name,u.last_name,m.label,m.value_num,m.value_text,m.unit,m.note,m.measured_at
          FROM health_metrics m JOIN users u ON u.id=m.user_id
          WHERE m.status=2 AND m.record_id=(SELECT id FROM health_records r WHERE r.user_id=m.user_id ORDER BY submitted_at DESC,id DESC LIMIT 1)
          ORDER BY m.measured_at DESC, u.last_name""").fetchall()
        return dict(items=[dict(r) for r in rows])
    finally:
        c.close()


@router.get("/admin/api/sos")
def a_sos(request: Request, status: str = ""):
    need_admin(request)
    c = db()
    try:
        sql = """SELECT s.id,s.reason,s.description,s.status,s.created_at,s.updated_at,s.handled_by,
                 u.id uid,u.astro_id,u.first_name,u.last_name,u.position
                 FROM sos_requests s JOIN users u ON u.id=s.user_id"""
        args = []
        if status in SOS_STATUSES:
            sql += " WHERE s.status=?"
            args.append(status)
        sql += " ORDER BY CASE s.status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, s.created_at DESC"
        return dict(requests=[dict(r) for r in c.execute(sql, args)])
    finally:
        c.close()


@router.post("/admin/api/sos/{sid}")
def a_sos_set(request: Request, sid: int, d: dict = Body(default={})):
    a = need_admin(request)
    st = d.get("status")
    if st not in SOS_STATUSES:
        raise HttpError(400, "Invalid status.")
    c = db()
    try:
        n = c.execute("UPDATE sos_requests SET status=?, updated_at=?, handled_by=? WHERE id=?",
                      (st, iso(now()), a["username"], sid)).rowcount
        if not n:
            raise HttpError(404, "SOS request not found.")
        return dict(ok=True)
    finally:
        c.close()
