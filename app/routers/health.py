"""Questionnaire, health records, charts."""
import json
from fastapi import APIRouter, Body, Request

from app.config import POSITIONS
from app.database import db
from app.errors import HttpError
from app.questionnaire import FBY, evaluate, public_schema
from app.security import need_user
from app.services.health import charts, cooldown_state, history, latest_record, record_detail, series, sync_weeks
from app.utils import iso, now


router = APIRouter()


@router.get("/api/questionnaire")
def r_schema():
    return dict(public_schema(), positions=POSITIONS)


@router.get("/api/health/status")
def r_status(request: Request):
    u = need_user(request)
    c = db()
    try:
        return cooldown_state(c, u["id"])
    finally:
        c.close()


@router.post("/api/health")
def r_submit(request: Request, d: dict = Body(default={})):
    u = need_user(request)
    ans = d.get("answers")
    if not isinstance(ans, dict):
        raise HttpError(400, "Questionnaire data is missing.")
    metrics, errs = evaluate(ans)
    if errs:
        raise HttpError(400, "Please check the questionnaire fields.", fields=errs)
    overall = max(m["status"] for m in metrics)
    clean = {k: ans[k] for k in FBY if k in ans}
    c = db()
    try:
        c.execute("BEGIN IMMEDIATE")          # serialises concurrent submissions: the 24 h rule cannot be raced
        try:
            st = cooldown_state(c, u["id"])
            if not st["can_submit"]:
                c.execute("ROLLBACK")
                raise HttpError(429, "You can submit a questionnaire only once every 24 hours.", **st)
            t = iso(now())
            rid = c.execute("INSERT INTO health_records(user_id,submitted_at,overall,answers) VALUES(?,?,?,?)",
                            (u["id"], t, overall, json.dumps(clean, ensure_ascii=False))).lastrowid
            c.executemany("INSERT INTO health_metrics(record_id,user_id,category,key,label,value_num,value_text,unit,status,note,measured_at)"
                          " VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                          [(rid, u["id"], m["category"], m["key"], m["label"], m["value_num"], m["value_text"],
                            m["unit"], m["status"], m["note"], t) for m in metrics])
            sync_weeks(c, u["id"])            # The 7th questionnaire saves the weekly chart.
            c.execute("COMMIT")
        except HttpError:
            raise
        except Exception:
            c.execute("ROLLBACK")
            raise
        return dict(record=record_detail(c, rid), status=cooldown_state(c, u["id"]))
    finally:
        c.close()


@router.get("/api/health/latest")
def r_latest(request: Request):
    u = need_user(request)
    c = db()
    try:
        return dict(record=latest_record(c, u["id"]))
    finally:
        c.close()


@router.get("/api/health/history")
def r_history(request: Request):
    u = need_user(request)
    c = db()
    try:
        return dict(records=history(c, u["id"]))
    finally:
        c.close()


@router.get("/api/health/record/{rid}")
def r_record(request: Request, rid: int):
    u = need_user(request)
    c = db()
    try:
        rec = record_detail(c, rid, u["id"])
        if not rec:
            raise HttpError(404, "Questionnaire not found.")
        return rec
    finally:
        c.close()


@router.get("/api/health/charts")
def r_charts(request: Request):
    """Daily chart of the current 7-questionnaire period + all saved weekly charts."""
    u = need_user(request)
    c = db()
    try:
        return charts(c, u["id"])
    finally:
        c.close()


@router.get("/api/health/series")
def r_series(request: Request, days: int = 7):
    u = need_user(request)
    c = db()
    try:
        return dict(series=series(c, u["id"], max(1, min(3650, days))))
    finally:
        c.close()
