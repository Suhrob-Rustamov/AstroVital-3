"""Application factory."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import errors
from app.bootstrap import init
from app.config import FRONTEND_DIR
from app.routers import admin, auth, health, pages, sos


@asynccontextmanager
async def lifespan(_app):
    init()
    yield


def create_app() -> FastAPI:
    # Swagger/ReDoc/OpenAPI are disabled: the CSP forbids them and the API is internal.
    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    errors.install(app)
    app.mount("/static", StaticFiles(directory=f"{FRONTEND_DIR}/static"), name="static")
    for r in (pages, auth, health, sos, admin):
        app.include_router(r.router)
    return app


app = create_app()
