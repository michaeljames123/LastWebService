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


def list_all_scans(db: Session, *, limit: int = 200, offset: int = 0) -> list[Scan]:
    stmt = (
        select(Scan)
        .order_by(Scan.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())


def delete_scan(db: Session, *, scan_id: int) -> bool:
    scan = get_scan_by_id(db, scan_id=scan_id)
    if scan is None:
        return False
    db.delete(scan)
    db.commit()
    return True
