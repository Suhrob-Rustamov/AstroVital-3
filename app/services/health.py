"""Health-record queries, chart building and weekly reports."""
import json
from datetime import timedelta

from app.config import COOLDOWN, WEEK
from app.utils import iso, now, parse


def met_out(r):
    return {k: r[k] for k in ("key", "category", "label", "value_num", "value_text", "unit", "status", "note")}


def record_detail(c, rid, uid=None):
    r = c.execute("SELECT * FROM health_records WHERE id=?" + (" AND user_id=?" if uid else ""),
                  (rid, uid) if uid else (rid,)).fetchone()
    if not r:
        return None
    ms = c.execute("SELECT * FROM health_metrics WHERE record_id=? ORDER BY id", (rid,)).fetchall()
    return dict(id=r["id"], user_id=r["user_id"], submitted_at=r["submitted_at"], overall=r["overall"],
                metrics=[met_out(m) for m in ms])


def latest_record(c, uid):
    r = c.execute("SELECT id FROM health_records WHERE user_id=? ORDER BY submitted_at DESC, id DESC LIMIT 1", (uid,)).fetchone()
    return record_detail(c, r[0]) if r else None


def history(c, uid):
    rows = c.execute("""SELECT r.id, r.submitted_at, r.overall,
        (SELECT COUNT(*) FROM health_metrics m WHERE m.record_id=r.id AND m.status=1) n_attention,
        (SELECT COUNT(*) FROM health_metrics m WHERE m.record_id=r.id AND m.status=2) n_critical
        FROM health_records r WHERE r.user_id=? ORDER BY r.submitted_at DESC, r.id DESC LIMIT 5000""", (uid,)).fetchall()
    return [dict(r) for r in rows]


def series(c, uid, days):
    """Time-based series (admin view). days=0 -> whole history."""
    sql, args = "SELECT key, measured_at, value_num, status FROM health_metrics WHERE user_id=? AND value_num IS NOT NULL", [uid]
    if days > 0:
        sql += " AND measured_at>=?"
        args.append(iso(now() - timedelta(days=days)))
    out = {}
    for r in c.execute(sql + " ORDER BY measured_at, id", args):
        out.setdefault(r["key"], []).append(dict(t=r["measured_at"], v=r["value_num"], s=r["status"]))
    return out


def record_ids(c, uid):
    return [r[0] for r in c.execute("SELECT id FROM health_records WHERE user_id=? ORDER BY submitted_at, id", (uid,))]


def build_series(c, uid, rids):
    """Chart series built ONLY from submitted questionnaires; day = position of the questionnaire in the week (1..7).
    A skipped calendar day produces no point and no fake value."""
    out = {}
    if not rids:
        return out
    pos = {r: i + 1 for i, r in enumerate(rids)}
    q = ",".join("?" * len(rids))
    for r in c.execute(f"SELECT record_id,key,measured_at,value_num,status FROM health_metrics "
                       f"WHERE user_id=? AND value_num IS NOT NULL AND record_id IN ({q}) ORDER BY record_id, id", [uid, *rids]):
        out.setdefault(r["key"], []).append(dict(day=pos[r["record_id"]], t=r["measured_at"], v=r["value_num"], s=r["status"]))
    return out


def sync_weeks(c, uid):
    """Persist a weekly chart for every full block of 7 questionnaires (called inside the submit transaction)."""
    ids = record_ids(c, uid)
    for w in range(1, len(ids) // WEEK + 1):
        if c.execute("SELECT 1 FROM weekly_reports WHERE user_id=? AND week_no=?", (uid, w)).fetchone():
            continue
        blk = ids[(w - 1) * WEEK: w * WEEK]
        t0 = c.execute("SELECT submitted_at FROM health_records WHERE id=?", (blk[0],)).fetchone()[0]
        t1 = c.execute("SELECT submitted_at FROM health_records WHERE id=?", (blk[-1],)).fetchone()[0]
        c.execute("INSERT INTO weekly_reports(user_id,week_no,started_at,ended_at,first_record_id,last_record_id,series,created_at)"
                  " VALUES(?,?,?,?,?,?,?,?)", (uid, w, t0, t1, blk[0], blk[-1], json.dumps(build_series(c, uid, blk)), iso(now())))


def charts(c, uid):
    ids = record_ids(c, uid)
    done = len(ids) // WEEK
    cur = ids[done * WEEK:]
    weeks = [dict(week_no=r["week_no"], started_at=r["started_at"], ended_at=r["ended_at"], series=json.loads(r["series"]))
             for r in c.execute("SELECT * FROM weekly_reports WHERE user_id=? ORDER BY week_no DESC", (uid,))]
    return dict(cycle=dict(week_no=done + 1, day_count=len(cur), series=build_series(c, uid, cur)),
                weeks=weeks, total_records=len(ids))


def cooldown_state(c, uid):
    r = c.execute("SELECT submitted_at FROM health_records WHERE user_id=? ORDER BY submitted_at DESC, id DESC LIMIT 1", (uid,)).fetchone()
    t = now()
    if not r:
        return dict(server_time=iso(t), last_submitted_at=None, next_available_at=None, can_submit=True)
    nxt = parse(r[0]) + COOLDOWN
    return dict(server_time=iso(t), last_submitted_at=r[0], next_available_at=iso(nxt), can_submit=t >= nxt)
