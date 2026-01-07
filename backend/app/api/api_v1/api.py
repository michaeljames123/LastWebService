from __future__ import annotations

from fastapi import APIRouter

from app.api.api_v1.endpoints import ai, admin, auth, contact, estimate_field, scans, users

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(contact.router)
api_router.include_router(scans.router)
api_router.include_router(ai.router)
api_router.include_router(estimate_field.router)
api_router.include_router(admin.router)
