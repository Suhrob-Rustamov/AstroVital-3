"""Emergency (SOS) requests from astronauts."""
from fastapi import APIRouter, Body, Request

from app.database import db
from app.errors import HttpError
from app.questionnaire import SOS_REASONS
from app.security import need_user
from app.utils import iso, now


router = APIRouter()


@router.post("/api/sos")
def r_sos_new(request: Request, d: dict = Body(default={})):
    u = need_user(request)
    reason, desc = str(d.get("reason", "")), str(d.get("description", "")).strip()
    if reason not in SOS_REASONS:
        raise HttpError(400, "Select a reason for the request.")
    if not 10 <= len(desc) <= 2000:
        raise HttpError(400, "Describe the issue in more detail (10–2000 characters).")
    t = iso(now())
    c = db()
    try:
        rid = c.execute("INSERT INTO sos_requests(user_id,reason,description,status,created_at,updated_at) VALUES(?,?,?,'new',?,?)",
                        (u["id"], reason, desc, t, t)).lastrowid
        return dict(id=rid, created_at=t)
    finally:
        c.close()


@router.get("/api/sos")
def r_sos_mine(request: Request):
    u = need_user(request)
    c = db()
    try:
        rows = c.execute("SELECT id,reason,description,status,created_at,updated_at FROM sos_requests WHERE user_id=? ORDER BY created_at DESC, id DESC",
                         (u["id"],)).fetchall()
        return dict(requests=[dict(r) for r in rows])
    finally:
        c.close()
