"""Create or remove the disposable demo users and their health histories."""
import argparse
import json
import sqlite3
from datetime import timedelta

from app.database import SCHEMA, db
from app.questionnaire import FIELDS, evaluate
from app.security import hash_pw
from app.services.health import sync_weeks
from app.utils import iso, now


PASSWORD = "demo1234"
HISTORY_DAYS = 14
PROFILES = (
    dict(
        astro_id="DEMO-GOOD-01",
        first_name="Alex",
        last_name="Stable",
        position="Commander",
        birth_date="1988-04-12",
        statuses={},
    ),
    dict(
        astro_id="DEMO-NORMAL-01",
        first_name="Maya",
        last_name="Monitor",
        position="Mission Specialist",
        birth_date="1992-09-23",
        statuses={
            "hr_rest": 1, "bp_sys": 1, "bp_dia": 1, "exercise_min": 1,
            "back_pain": 1, "stress": 1, "sleep_hours": 1, "sleep_quality": 1,
        },
    ),
    dict(
        astro_id="DEMO-CRITICAL-01",
        first_name="Iris",
        last_name="Critical",
        position="Medical Officer",
        birth_date="1985-01-30",
        statuses={
            "hr_rest": 2, "bp_sys": 2, "bp_dia": 2, "spo2": 2, "temp": 2,
            "infection": 2, "back_pain": 2, "bone_pain": 2, "sleep_hours": 2,
            "dose_day": 2,
        },
    ),
)
PROFILE_NAMES = {p["astro_id"]: (p["first_name"], p["last_name"]) for p in PROFILES}


def _value_for_status(field, status):
    if field["type"] == "choice":
        option = next((o for o in field["options"] if o["status"] == status), None)
        if option is None:
            option = next(o for o in field["options"] if o["status"] == 0)
        return option["value"]

    if field["type"] == "num":
        bands = field["bands"]
        selected = next((b for b in bands if b[2] == status), None)
        if selected is None:
            selected = next(b for b in bands if b[2] == 0)
        lo = field["min"] if selected[0] is None else selected[0]
        hi = field["max"] if selected[1] is None else selected[1]
        value = (lo + hi) / 2
        step = field["step"]
        value = round(round(value / step) * step, 2)
        return min(field["max"], max(field["min"], value))

    return "Test questionnaire; synthetic data for interface testing."


def _answers(profile):
    return {
        field["key"]: _value_for_status(field, profile["statuses"].get(field["key"], 0))
        for field in FIELDS
    }


def seed():
    c = db()
    try:
        c.executescript(SCHEMA)
        c.execute("BEGIN IMMEDIATE")
        for profile in PROFILES:
            if c.execute("SELECT 1 FROM users WHERE astro_id=?", (profile["astro_id"],)).fetchone():
                raise ValueError(
                    f"ID {profile['astro_id']} already exists; remove or rename it before seeding."
                )
            uid = c.execute(
                """INSERT INTO users(astro_id,first_name,last_name,position,birth_date,
                   password_hash,must_change,created_at) VALUES(?,?,?,?,?,?,0,?)""",
                (
                    profile["astro_id"], profile["first_name"], profile["last_name"],
                    profile["position"], profile["birth_date"], hash_pw(PASSWORD), iso(now()),
                ),
            ).lastrowid
            answers = _answers(profile)
            metrics, errors = evaluate(answers)
            if errors:
                raise ValueError(f"Questionnaire for {profile['astro_id']} is incomplete or invalid: {errors}")

            for day in range(HISTORY_DAYS):
                submitted_at = iso(now() - timedelta(days=HISTORY_DAYS - day - 1))
                overall = max(metric["status"] for metric in metrics)
                record_id = c.execute(
                    "INSERT INTO health_records(user_id,submitted_at,overall,answers) VALUES(?,?,?,?)",
                    (uid, submitted_at, overall, json.dumps(answers, ensure_ascii=False)),
                ).lastrowid
                c.executemany(
                    """INSERT INTO health_metrics(record_id,user_id,category,key,label,value_num,
                       value_text,unit,status,note,measured_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
                    [
                        (
                            record_id, uid, metric["category"], metric["key"], metric["label"],
                            metric["value_num"], metric["value_text"], metric["unit"],
                            metric["status"], metric["note"], submitted_at,
                        )
                        for metric in metrics
                    ],
                )
            sync_weeks(c, uid)
        c.execute("COMMIT")
    except Exception:
        if c.in_transaction:
            c.execute("ROLLBACK")
        raise
    finally:
        c.close()

    print(f"Created {len(PROFILES)} demo users with {HISTORY_DAYS} questionnaires each.")
    print(f"Password for all demo users: {PASSWORD}")
    for profile in PROFILES:
        print(f"  {profile['astro_id']} — {profile['first_name']} {profile['last_name']}")


def remove():
    c = db()
    try:
        c.execute("BEGIN IMMEDIATE")
        for astro_id, (first_name, last_name) in PROFILE_NAMES.items():
            user = c.execute(
                "SELECT id,first_name,last_name FROM users WHERE astro_id=?", (astro_id,)
            ).fetchone()
            if user and (user["first_name"], user["last_name"]) != (first_name, last_name):
                raise ValueError(
                    f"ID {astro_id} belongs to a different user; removal aborted."
                )
            if not user:
                continue
            uid = user["id"]
            record_ids = [
                row[0] for row in c.execute("SELECT id FROM health_records WHERE user_id=?", (uid,))
            ]
            if record_ids:
                placeholders = ",".join("?" for _ in record_ids)
                c.execute(f"DELETE FROM health_metrics WHERE record_id IN ({placeholders})", record_ids)
            c.execute("DELETE FROM weekly_reports WHERE user_id=?", (uid,))
            c.execute("DELETE FROM health_records WHERE user_id=?", (uid,))
            c.execute("DELETE FROM sos_requests WHERE user_id=?", (uid,))
            c.execute("DELETE FROM sessions WHERE kind='user' AND subject_id=?", (uid,))
            c.execute("DELETE FROM users WHERE id=?", (uid,))
        c.execute("COMMIT")
    except Exception:
        if c.in_transaction:
            c.execute("ROLLBACK")
        raise
    finally:
        c.close()
    print("Demo users and their related data have been removed.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("seed", "remove"))
    args = parser.parse_args()
    if args.action == "seed":
        seed()
    else:
        remove()


if __name__ == "__main__":
    main()
