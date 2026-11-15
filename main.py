#!/usr/bin/env python3
"""Entry point:  python3 main.py   |   uvicorn main:app"""
from app.config import DB_PATH, HOST, PORT
from app.main import app  # noqa: F401  (exported for uvicorn)

if __name__ == "__main__":
    import uvicorn
    print(f"AstroVital: http://{HOST}:{PORT}   admin: http://{HOST}:{PORT}/admin   db: {DB_PATH}")
    uvicorn.run(app, host=HOST, port=PORT)
