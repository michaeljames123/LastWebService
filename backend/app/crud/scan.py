from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.scan import Scan


def create_scan(
    db: Session,
    *,
    user_id: int,
    image_filename: str,
    result_json: str,
) -> Scan:
    scan = Scan(user_id=user_id, image_filename=image_filename, result_json=result_json)
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return scan


def list_scans_for_user(db: Session, *, user_id: int, limit: int = 50) -> list[Scan]:
    stmt = (
        select(Scan)
        .where(Scan.user_id == user_id)
        .order_by(Scan.created_at.desc())
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())


def get_scan_by_id(db: Session, *, scan_id: int) -> Optional[Scan]:
    return db.execute(select(Scan).where(Scan.id == scan_id)).scalar_one_or_none()
