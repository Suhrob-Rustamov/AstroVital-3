"""First-run initialisation: schema + default admin."""
import os

from app.database import SCHEMA, db
from app.security import hash_pw
from app.utils import iso, now

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "AstroVitalAdmin2026!"


def init():
    c = db()
    cols = [r[1] for r in c.execute("PRAGMA table_info(users)")]
    if cols and "birth_date" not in cols:
        c.close()
        raise SystemExit("An older database schema was found (the age field is present). Delete astrovital.db "
                         "(or set ASTROVITAL_DB to another path). The schema now uses birth_date and weekly charts.")
    c.executescript(SCHEMA)
    if not c.execute("SELECT 1 FROM admins").fetchone():
        name = os.environ.get("ADMIN_USERNAME", DEFAULT_ADMIN_USERNAME)
        pw = os.environ.get("ADMIN_PASSWORD") or DEFAULT_ADMIN_PASSWORD
        c.execute("INSERT INTO admins(username,password_hash,created_at) VALUES(?,?,?)", (name, hash_pw(pw), iso(now())))
        print("=" * 60)
        print(f"  Default administrator created. Username: {name}")
        if os.environ.get("ADMIN_PASSWORD"):
            print("  Password was provided through ADMIN_PASSWORD.")
        else:
            print(f"  Default password: {pw}")
        print("  Change this password before using the app outside development.")
        print("=" * 60)
    c.close()
