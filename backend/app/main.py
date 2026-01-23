from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.responses import Response

from app.api.api_v1 import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine

import app.models


def create_app() -> FastAPI:
    app = FastAPI(title=settings.PROJECT_NAME)

    @app.middleware("http")
    async def cors_middleware(request: Request, call_next):
        if request.method == "OPTIONS":
            response = Response(status_code=200)
        else:
            response = await call_next(request)

        origin = request.headers.get("origin")
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
        else:
            response.headers["Access-Control-Allow-Origin"] = "*"

        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        request_headers = request.headers.get("Access-Control-Request-Headers")
        if request_headers:
            response.headers["Access-Control-Allow-Headers"] = request_headers
        else:
            response.headers["Access-Control-Allow-Headers"] = "*"

        response.headers["Access-Control-Allow-Credentials"] = "false"
        return response

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    @app.on_event("startup")
    def on_startup() -> None:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        Base.metadata.create_all(bind=engine)

    app.include_router(api_router, prefix=settings.API_V1_STR)

    return app


app = create_app()
