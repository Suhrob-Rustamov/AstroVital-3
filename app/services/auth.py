"""Shared auth logic for users and admins."""
import hashlib
from datetime import datetime

from app.database import db
from app.errors import HttpError
from app.security import COOKIE, DUMMY, check_pw, hash_pw, new_session, note_fail, set_cookie, throttled
from app.utils import calc_age


def user_out(r):
    bd = datetime.strptime(r["birth_date"], "%Y-%m-%d").date()
    return dict(id=r["id"], astro_id=r["astro_id"], first_name=r["first_name"], last_name=r["last_name"],
                position=r["position"], birth_date=r["birth_date"], age=calc_age(bd),
                must_change=bool(r["must_change"]), created_at=r["created_at"])


def do_login(request, response, d, kind, table, col):
    ident, pw = str(d.get(col, "")).strip(), str(d.get("password", ""))
    key = f"{kind}|{request.client.host if request.client else '-'}|{ident.lower()}"
    if throttled(key):
        raise HttpError(429, "Too many sign-in attempts. Try again in a few minutes.")
    c = db()
    try:
        row = c.execute(f"SELECT * FROM {table} WHERE {col}=?", (ident,)).fetchone()
        ok = check_pw(pw, row["password_hash"] if row else DUMMY)
        if not (row and ok):
            note_fail(key)
            raise HttpError(401, "Invalid ID or password." if kind == "user" else "Invalid username or password.")
        tok = new_session(c, kind, row["id"])
        out = dict(user=user_out(row)) if kind == "user" else dict(admin=dict(username=row["username"]))
    finally:
        c.close()
    set_cookie(response, kind, tok)
    return out


def do_logout(request, response, kind):
    tok = request.cookies.get(COOKIE[kind][0])
    if tok:
        c = db()
        c.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(tok.encode()).hexdigest(),))
        c.close()
    set_cookie(response, kind, "", clear=True)
    return dict(ok=True)


def change_pw(response, d, kind, table, row, lo, hi):
    old, new = str(d.get("old", "")), str(d.get("new", ""))
    if not check_pw(old, row["password_hash"]):
        raise HttpError(400, "Current password is incorrect.", fields=dict(opw="Incorrect password."))
    if not lo <= len(new) <= hi:
        raise HttpError(400, f"New password must be {lo}–{hi} characters long.",
                        fields=dict(npw=f"Use {lo}–{hi} characters."))
    if new == old:
        raise HttpError(400, "New password must differ from the current password.",
                        fields=dict(npw="Must differ from the current password."))
    c = db()
    try:
        c.execute(f"UPDATE {table} SET password_hash=?" + (", must_change=0" if kind == "user" else "") + " WHERE id=?",
                  (hash_pw(new), row["id"]))
        c.execute("DELETE FROM sessions WHERE kind=? AND subject_id=?", (kind, row["id"]))
        tok = new_session(c, kind, row["id"])
    finally:
        c.close()
    set_cookie(response, kind, tok)
    return dict(ok=True)
