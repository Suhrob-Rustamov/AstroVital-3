"""SQLite schema and connection factory."""
import sqlite3

from app.config import DB_PATH


SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  astro_id TEXT NOT NULL UNIQUE COLLATE NOCASE,
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, position TEXT NOT NULL,
  birth_date TEXT NOT NULL,                 -- YYYY-MM-DD; age is computed from it
  password_hash TEXT NOT NULL,
  must_change INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admins(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(
  token_hash TEXT PRIMARY KEY, kind TEXT NOT NULL, subject_id INTEGER NOT NULL,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS health_records(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  submitted_at TEXT NOT NULL,
  overall INTEGER NOT NULL,            -- 0 stable, 1 attention, 2 critical
  answers TEXT NOT NULL);              -- raw answers as JSON
CREATE INDEX IF NOT EXISTS ix_rec_user ON health_records(user_id, submitted_at);
CREATE TABLE IF NOT EXISTS health_metrics(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL REFERENCES health_records(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  category TEXT NOT NULL, key TEXT NOT NULL, label TEXT NOT NULL,
  value_num REAL, value_text TEXT, unit TEXT,
  status INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '',
  measured_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_met_user_key ON health_metrics(user_id, key, measured_at);
CREATE INDEX IF NOT EXISTS ix_met_rec ON health_metrics(record_id);
CREATE TABLE IF NOT EXISTS weekly_reports(       -- saved weekly chart: created when 7 questionnaires are collected
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  week_no INTEGER NOT NULL,
  started_at TEXT NOT NULL, ended_at TEXT NOT NULL,
  first_record_id INTEGER NOT NULL, last_record_id INTEGER NOT NULL,
  series TEXT NOT NULL,                -- JSON {metric_key: [{day,t,v,s}]}
  created_at TEXT NOT NULL,
  UNIQUE(user_id, week_no));
CREATE TABLE IF NOT EXISTS sos_requests(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN('new','in_progress','done')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, handled_by TEXT);
CREATE INDEX IF NOT EXISTS ix_sos_status ON sos_requests(status, created_at);
"""


def db():
    c = sqlite3.connect(DB_PATH, timeout=15, isolation_level=None)  # autocommit; explicit BEGIN where needed
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    c.execute("PRAGMA journal_mode=WAL")
    return c
