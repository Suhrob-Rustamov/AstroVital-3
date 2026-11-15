"""Errors, security headers and request guards."""



import traceback

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class HttpError(Exception):
    def __init__(self, code, msg, **extra):
        self.code, self.msg, self.extra = code, msg, extra


SEC = [("X-Content-Type-Options", "nosniff"), ("X-Frame-Options", "DENY"), ("Referrer-Policy", "no-referrer"),
       ("Cache-Control", "no-store"),
       ("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; "
        "img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")]


def secure(resp):
    for k, v in SEC:
        resp.headers[k] = v
    return resp


def err(code, msg, **extra):
    return secure(JSONResponse(dict(error=msg, **extra), status_code=code))


def install(app: FastAPI):
    @app.middleware("http")
    async def guard(request: Request, call_next):
        if request.method == "POST":                                   # JSON-only POST, size limit
            if "application/json" not in request.headers.get("content-type", ""):
                return err(415, "Expected JSON.")
            try:
                n = int(request.headers.get("content-length") or 0)
            except ValueError:
                return err(400, "Invalid request.")
            if n > 65536:
                return err(413, "Request is too large.")
        return secure(await call_next(request))

    @app.exception_handler(HttpError)
    async def _http_error(_r, e):
        return err(e.code, e.msg, **e.extra)

    @app.exception_handler(RequestValidationError)
    async def _validation(_r, _e):
        return err(400, "Invalid request.")

    @app.exception_handler(StarletteHTTPException)
    async def _starlette(_r, e):
        return err(e.status_code, "Not found." if e.status_code == 404 else "Invalid request.")

    @app.exception_handler(Exception)
    async def _unhandled(_r, _e):
        traceback.print_exc()
        return err(500, "Internal server error.")
