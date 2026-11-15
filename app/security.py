"""Passwords, login throttling, sessions, cookies and auth dependencies."""
import hashlib
import hmac
import secrets
import threading
import time

from app.config import SECURE, SESSION_TTL
from app.database import db
from app.errors import HttpError
from app.utils import iso, now


# ───────────────────────────── passwords ─────────────────────────────
def hash_pw(pw):
    salt = secrets.token_bytes(16)
    h = hashlib.scrypt(pw.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return f"scrypt$16384$8$1${salt.hex()}${h.hex()}"


def check_pw(pw, stored):
    try:
        _, n, r, p, salt, h = stored.split("$")
        calc = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(calc.hex(), h)
    except Exception:
        return False


DUMMY = hash_pw("dummy-password-for-timing")
FAILS, FAILS_LOCK = {}, threading.Lock()


def throttled(key):
    with FAILS_LOCK:
        ts = [t for t in FAILS.get(key, []) if time.time() - t < 300]
        FAILS[key] = ts
        return len(ts) >= 5


def note_fail(key):
    with FAILS_LOCK:
        FAILS.setdefault(key, []).append(time.time())




COOKIE = {"user": ("av_session", "/"), "admin": ("av_admin", "/admin")}


def set_cookie(resp, kind, tok, clear=False):
    name, path = COOKIE[kind]
    resp.set_cookie(name, "" if clear else tok, max_age=0 if clear else int(SESSION_TTL.total_seconds()),
                    path=path, httponly=True, samesite="strict", secure=SECURE)


def new_session(c, kind, sid):
    tok, t = secrets.token_urlsafe(32), now()
    c.execute("DELETE FROM sessions WHERE expires_at<?", (iso(t),))
    c.execute("INSERT INTO sessions VALUES(?,?,?,?,?)",
              (hashlib.sha256(tok.encode()).hexdigest(), kind, sid, iso(t), iso(t + SESSION_TTL)))
    return tok


def session(request, kind):
    tok = request.cookies.get(COOKIE[kind][0])
    if not tok:
        return None
    c = db()
    try:
        s = c.execute("SELECT subject_id FROM sessions WHERE token_hash=? AND kind=? AND expires_at>?",
                      (hashlib.sha256(tok.encode()).hexdigest(), kind, iso(now()))).fetchone()
        if not s:
            return None
        return c.execute("SELECT * FROM %s WHERE id=?" % ("users" if kind == "user" else "admins"), (s[0],)).fetchone()
    finally:
        c.close()


def need_user(request, allow_must_change=False):
    u = session(request, "user")
    if not u:
        raise HttpError(401, "Authentication required.")
    if u["must_change"] and not allow_must_change:
        raise HttpError(403, "You must change your temporary password.", must_change=True)
    return u


def need_admin(request):
    a = session(request, "admin")
    if not a:
        raise HttpError(401, "Administrator authentication required.")
    return a
