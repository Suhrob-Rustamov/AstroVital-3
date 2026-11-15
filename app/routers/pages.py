"""HTML pages."""
import os
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.config import FRONTEND_DIR


router = APIRouter()


def page(name):
    with open(os.path.join(FRONTEND_DIR, name), "rb") as f:
        return HTMLResponse(f.read())


@router.get("/")
@router.get("/index.html")
def p_index():
    return page("index.html")


@router.get("/admin")
@router.get("/admin/")
def p_admin():
    return page("admin.html")
