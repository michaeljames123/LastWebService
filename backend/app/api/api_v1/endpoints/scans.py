from __future__ import annotations

import base64
import json
import os
import shutil
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
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


def _compute_field_health(result: dict) -> dict:
    detections_raw = result.get("detections")
    detections = [d for d in detections_raw if isinstance(d, dict)] if isinstance(detections_raw, list) else []

    total = len(detections)
    disease_keywords = (
        "disease",
        "blight",
        "rust",
        "mold",
        "rot",
        "wilt",
        "pest",
        "infect",
    )

    disease_count = 0
    for d in detections:
        label = str(d.get("class_name") or d.get("class_id") or "").lower()
        if any(k in label for k in disease_keywords):
            disease_count += 1

    if total <= 0:
        health_percent = 100
    else:
        health_percent = max(0, min(100, round(100 * (1 - disease_count / total))))

    if disease_count == 0:
        recommendation = (
            "No disease indicators were found in this scan. Maintain regular scouting and record "
            "keeping, keep irrigation and fertilization on schedule, and avoid unnecessary "
            "chemical applications."
        )
    elif health_percent >= 70:
        recommendation = (
            "Early or mild disease pressure detected. Mark the affected spots from the scan, scout "
            "those rows on the ground, and consider targeted treatment only in hotspots. Monitor "
            "these areas over the next 3–7 days."
        )
    elif health_percent >= 40:
        recommendation = (
            "Moderate disease presence detected. Prioritise treatment of the affected blocks, "
            "following local agronomy or extension guidelines for product choice and rates. Improve "
            "airflow in the canopy where possible and avoid prolonged leaf wetness from irrigation."
        )
    else:
        recommendation = (
            "Severe disease indicators detected in this frame. Consult an agronomist or local "
            "extension officer as soon as possible, plan immediate treatment for the worst areas, "
            "and review crop rotation, residue management, and variety selection for future seasons."
        )

    return {
        "field_health_percent": health_percent,
        "disease_count": disease_count,
        "total_detections": total,
        "recommendation": recommendation,
    }


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
    drone_name: str = Form(...),
    flight_duration: str = Form(...),
    drone_altitude: str = Form(...),
    location: str = Form(...),
    field_size: str = Form(""),
    captured_at: str = Form(...),
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

    drone_info = {
        "name": drone_name,
        "flight_duration": flight_duration,
        "altitude": drone_altitude,
        "location": location,
        "field_size": field_size,
        "captured_at": captured_at,
    }

    field_health = _compute_field_health(result) if isinstance(result, dict) else None

    if isinstance(result, dict):
        result["drone"] = drone_info
        if field_health is not None:
            result["field_health"] = field_health
        if "scan_type" not in result:
            result["scan_type"] = "dashboard"

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
    image_b64: str | None = None
    try:
        parsed = json.loads(scan.result_json)
        if isinstance(parsed, dict):
            annotated_name = parsed.get("annotated_image_filename")
            det = parsed.get("detections")
            if isinstance(det, list):
                detections = [d for d in det if isinstance(d, dict)]
            img_val = parsed.get("image")
            if isinstance(img_val, str) and img_val.strip():
                image_b64 = img_val.strip()
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
        # As a fallback (e.g. after a redeploy where uploads/ was cleared), try to
        # decode a base64-encoded image stored in the result JSON.
        if image_b64:
            try:
                media_type = "image/jpeg"
                data_str = image_b64
                if data_str.startswith("data:"):
                    header, _, b64_data = data_str.partition(",")
                    if ";base64" in header:
                        mt = header.split(":", 1)[1].split(";", 1)[0]
                        if mt:
                            media_type = mt
                    data_str = b64_data or ""
                raw = base64.b64decode(data_str)
                return Response(content=raw, media_type=media_type)
            except Exception:
                pass

        raise HTTPException(status_code=404, detail="Image file missing")

    return FileResponse(path)


@router.get("/{scan_id}/original-image")
def get_scan_original_image(
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    scan = get_scan_by_id(db, scan_id=scan_id)
    if scan is None or scan.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Scan not found")

    original_name = os.path.basename(scan.image_filename)
    original_path = os.path.join(settings.UPLOAD_DIR, original_name)
    if os.path.exists(original_path):
        return FileResponse(original_path)

    image_b64: str | None = None
    try:
        parsed = json.loads(scan.result_json)
        if isinstance(parsed, dict):
            img_val = parsed.get("image")
            if isinstance(img_val, str) and img_val.strip():
                image_b64 = img_val.strip()
    except Exception:
        image_b64 = None

    if image_b64:
        try:
            media_type = "image/jpeg"
            data_str = image_b64
            if data_str.startswith("data:"):
                header, _, b64_data = data_str.partition(",")
                if ";base64" in header:
                    mt = header.split(":", 1)[1].split(";", 1)[0]
                    if mt:
                        media_type = mt
                data_str = b64_data or ""
            raw = base64.b64decode(data_str)
            return Response(content=raw, media_type=media_type)
        except Exception:
            pass

    raise HTTPException(status_code=404, detail="Original image missing")
