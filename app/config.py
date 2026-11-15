"""Settings and constants."""



import os, re
from datetime import timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(ROOT, "frontend")
DB_PATH = os.environ.get("ASTROVITAL_DB", os.path.join(ROOT, "astrovital.db"))
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
SECURE = os.environ.get("SECURE_COOKIES") == "1"      # set to 1 when served over HTTPS
COOLDOWN = timedelta(hours=24)                         # one questionnaire per 24 h
SESSION_TTL = timedelta(days=7)
WEEK = 7                                               # questionnaires per weekly chart
IDRE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]{2,19}$")
UTC = timezone.utc
POSITIONS = ["Commander", "Pilot", "Mission Specialist", "Flight Engineer", "Payload Specialist", "Medical Officer"]
