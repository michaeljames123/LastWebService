from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.crud.scan import delete_scan, list_all_scans
from app.crud.user import delete_user, list_users, set_user_active
from app.db.session import get_db
from app.models.user import User
from app.schemas.scan import AdminScanOut
from app.schemas.user import UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview")
def admin_overview(
    db: Session = Depends(get_db),
    current_admin: User = Depends(deps.get_current_admin_user),
) -> dict[str, Any]:
    users = list_users(db, limit=1000)
    scans = list_all_scans(db, limit=1000)

    total_users = len(users)
    total_active_users = sum(1 for u in users if u.is_active)
    total_scans = len(scans)

    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=6)
    buckets: dict[str, int] = {}
    for i in range(7):
        d = start_date + timedelta(days=i)
        buckets[d.isoformat()] = 0

    scans_by_type = {"dashboard": 0, "estimate_field": 0, "other": 0}

    for s in scans:
        created_date = (s.created_at.date() if isinstance(s.created_at, datetime) else s.created_at)
        if start_date <= created_date <= today:
            buckets[created_date.isoformat()] = buckets.get(created_date.isoformat(), 0) + 1

        scan_type = None
        try:
            data = json.loads(s.result_json)
            if isinstance(data, dict):
                scan_type = data.get("scan_type")
        except Exception:
            scan_type = None

        if scan_type == "dashboard":
            scans_by_type["dashboard"] += 1
        elif scan_type == "estimate_field":
            scans_by_type["estimate_field"] += 1
        else:
            scans_by_type["other"] += 1

    scans_last_7_days = [
        {"date": d, "count": buckets.get(d, 0)} for d in sorted(buckets.keys())
    ]

    return {
        "total_users": total_users,
        "total_active_users": total_active_users,
        "total_scans": total_scans,
        "scans_last_7_days": scans_last_7_days,
        "scans_by_type": scans_by_type,
        "admin_email": current_admin.email,
        "model_path": settings.AI_MODEL_PATH,
    }


@router.get("/users", response_model=list[UserOut])
def admin_list_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(deps.get_current_admin_user),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[UserOut]:
    return list_users(db, limit=limit, offset=offset)


class _ToggleActiveBody(dict):
    is_active: bool  # type: ignore[assignment]


@router.patch("/users/{user_id}/active", response_model=UserOut)
def admin_set_user_active(
    user_id: int,
    body: _ToggleActiveBody,
    db: Session = Depends(get_db),
    current_admin: User = Depends(deps.get_current_admin_user),
) -> UserOut:
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot change your own active status")

    is_active = bool(body.get("is_active"))
    user = set_user_active(db, user_id=user_id, is_active=is_active)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/users/{user_id}")
def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(deps.get_current_admin_user),
) -> dict[str, bool]:
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    ok = delete_user(db, user_id=user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


@router.get("/scans", response_model=list[AdminScanOut])
def admin_list_scans(
    db: Session = Depends(get_db),
    current_admin: User = Depends(deps.get_current_admin_user),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[AdminScanOut]:
    scans = list_all_scans(db, limit=limit, offset=offset)
    out: list[AdminScanOut] = []

    for s in scans:
        try:
            result = json.loads(s.result_json)
        except Exception:
            result = {"raw": s.result_json}

        image_url = f"{settings.API_V1_STR}/scans/{s.id}/image"
        out.append(
            AdminScanOut(
                id=s.id,
                user_id=s.user_id,
                image_filename=s.image_filename,
                image_url=image_url,
                result=result,
                created_at=s.created_at,
            )
        )

    return out


@router.delete("/scans/{scan_id}")
def admin_delete_scan(
    scan_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(deps.get_current_admin_user),
) -> dict[str, bool]:
    ok = delete_scan(db, scan_id=scan_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Scan not found")
    return {"ok": True}
