"""Time helpers."""
from datetime import datetime

from app.config import UTC


def now():
    return datetime.now(UTC).replace(microsecond=0)


def iso(t):
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse(s):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)


def calc_age(bd, today=None):
    """Full years since birth date; recalculated on every request, never stored."""
    t = today or now().date()
    return t.year - bd.year - ((t.month, t.day) < (bd.month, bd.day))
