from __future__ import annotations

import json
import os
import shutil
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.crud.scan import create_scan, get_scan_by_id, list_scans_for_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.scan import ScanOut
from app.services.ai_service import ModelNotAvailableError, predict_image, render_polygons_only

router = APIRouter(prefix="/scans", tags=["scans"])


def _scan_to_out(scan, *, result: dict) -> ScanOut:
    return ScanOut(
        id=scan.id,
        image_filename=scan.image_filename,
        image_url=f"{settings.API_V1_STR}/scans/{scan.id}/image",
        result=result,
        created_at=scan.created_at,
    )


@router.get("/", response_model=list[ScanOut])
def list_my_scans(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> list[ScanOut]:
    scans = list_scans_for_user(db, user_id=current_user.id)
    out: list[ScanOut] = []
    for s in scans:
        try:
            result = json.loads(s.result_json)
        except Exception:
            result = {"raw": s.result_json}
        out.append(_scan_to_out(s, result=result))
    return out


@router.post("/", response_model=ScanOut)
async def create_my_scan(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    file: UploadFile = File(...),
) -> ScanOut:
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, filename)

    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        result = predict_image(path)
    except ModelNotAvailableError as e:
        result = {"status": "model_not_available", "reason": str(e)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI inference failed: {e}")

    scan = create_scan(
        db,
        user_id=current_user.id,
        image_filename=filename,
        result_json=json.dumps(result),
    )

    return _scan_to_out(scan, result=result)


@router.get("/{scan_id}/image")
def get_scan_image(
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    scan = get_scan_by_id(db, scan_id=scan_id)
    if scan is None or scan.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Scan not found")

    annotated_name = None
    detections: list[dict] = []
    try:
        parsed = json.loads(scan.result_json)
        if isinstance(parsed, dict):
            annotated_name = parsed.get("annotated_image_filename")
            det = parsed.get("detections")
            if isinstance(det, list):
                detections = [d for d in det if isinstance(d, dict)]
    except Exception:
        annotated_name = None

    original_name = os.path.basename(scan.image_filename)
    stem = os.path.splitext(original_name)[0]

    poly_path = os.path.join(settings.UPLOAD_DIR, f"{stem}_poly.jpg")
    if os.path.exists(poly_path):
        return FileResponse(poly_path)

    original_path = os.path.join(settings.UPLOAD_DIR, original_name)
    if os.path.exists(original_path) and detections:
        try:
            render_polygons_only(
                image_path=original_path,
                detections=detections,
                output_path=poly_path,
            )
        except Exception:
            pass
        if os.path.exists(poly_path):
            return FileResponse(poly_path)

    candidates: list[str] = []

    if isinstance(annotated_name, str) and annotated_name.strip():
        base = os.path.basename(annotated_name.strip())
        if base.endswith("_poly.jpg") or base.endswith("_poly.png"):
            candidates.append(os.path.join(settings.UPLOAD_DIR, base))

    candidates.append(original_path)

    path = next((p for p in candidates if os.path.exists(p)), None)
    if not path:
        raise HTTPException(status_code=404, detail="Image file missing")

    return FileResponse(path)
