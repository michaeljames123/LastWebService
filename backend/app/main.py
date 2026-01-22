from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.api_v1 import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine

import app.models


def create_app() -> FastAPI:
    app = FastAPI(title=settings.PROJECT_NAME)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

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
