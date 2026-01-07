from __future__ import annotations

import json
import os
import shutil
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.crud.scan import create_scan
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/estimate-field", tags=["estimate-field"])


def _require_pillow():
    try:
        from PIL import Image, ImageDraw, ImageFont  # type: ignore
    except Exception as e:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pillow is not installed. Install backend/requirements.txt to enable image annotation.",
        ) from e
    return Image, ImageDraw, ImageFont


_ULTRALYTICS_HEX = (
    "FF3838",
    "FF9D97",
    "FF701F",
    "FFB21D",
    "CFD231",
    "48F90A",
    "92CC17",
    "3DDB86",
    "1A9334",
    "00D4BB",
    "2C99A8",
    "00C2FF",
    "344593",
    "6473FF",
    "0018EC",
    "8438FF",
    "520085",
    "CB38FF",
    "FF95C8",
    "FF37C7",
)


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.strip().lstrip("#")
    if len(value) != 6:
        return (255, 255, 255)
    try:
        r = int(value[0:2], 16)
        g = int(value[2:4], 16)
        b = int(value[4:6], 16)
        return (r, g, b)
    except Exception:
        return (255, 255, 255)


def _class_color(class_name: Any) -> tuple[int, int, int]:
    if isinstance(class_name, int):
        idx = class_name
    else:
        idx = abs(hash(str(class_name)))
    return _hex_to_rgb(_ULTRALYTICS_HEX[idx % len(_ULTRALYTICS_HEX)])


def _xyxy_from_pred(pred: dict[str, Any]) -> tuple[float, float, float, float] | None:
    b = pred.get("bbox")
    if (
        isinstance(b, (list, tuple))
        and len(b) == 4
        and all(isinstance(v, (int, float)) for v in b)
    ):
        x1, y1, x2, y2 = (float(b[0]), float(b[1]), float(b[2]), float(b[3]))
        return (x1, y1, x2, y2)

    if all(k in pred for k in ("x1", "y1", "x2", "y2")):
        try:
            x1 = float(pred["x1"])
            y1 = float(pred["y1"])
            x2 = float(pred["x2"])
            y2 = float(pred["y2"])
            return (x1, y1, x2, y2)
        except Exception:
            return None

    if all(k in pred for k in ("x", "y", "width", "height")):
        try:
            x = float(pred["x"])
            y = float(pred["y"])
            w = float(pred["width"])
            h = float(pred["height"])
            return (x - w / 2.0, y - h / 2.0, x + w / 2.0, y + h / 2.0)
        except Exception:
            return None

    return None


def _render_bboxes_with_labels(*, image_path: str, predictions: list[dict[str, Any]], output_path: str) -> None:
    Image, ImageDraw, ImageFont = _require_pillow()

    base = Image.open(image_path).convert("RGB")
    draw = ImageDraw.Draw(base)
    font = ImageFont.load_default()

    w, h = base.size

    for p in predictions:
        if not isinstance(p, dict):
            continue

        xyxy = _xyxy_from_pred(p)
        if not xyxy:
            continue

        x1, y1, x2, y2 = xyxy
        x1 = max(0.0, min(float(w - 1), x1))
        y1 = max(0.0, min(float(h - 1), y1))
        x2 = max(0.0, min(float(w - 1), x2))
        y2 = max(0.0, min(float(h - 1), y2))

        label_cls = p.get("class") or p.get("class_name") or p.get("label") or "object"
        conf = p.get("confidence")
        try:
            conf_f = float(conf)
            label = f"{label_cls} {conf_f:.2f}"
        except Exception:
            label = str(label_cls)

        color = _class_color(label_cls)

        draw.rectangle([x1, y1, x2, y2], outline=color, width=3)

        try:
            bbox = draw.textbbox((0, 0), label, font=font)
            tw = float(bbox[2] - bbox[0])
            th = float(bbox[3] - bbox[1])
        except Exception:
            tw, th = draw.textsize(label, font=font)

        pad = 3
        tx0 = x1
        ty0 = max(0.0, y1 - (th + pad * 2))
        tx1 = min(float(w), tx0 + tw + pad * 2)
        ty1 = min(float(h), ty0 + th + pad * 2)

        draw.rectangle([tx0, ty0, tx1, ty1], fill=(color[0], color[1], color[2]))
        draw.text((tx0 + pad, ty0 + pad), label, fill=(255, 255, 255), font=font)

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    base.save(output_path)


def _compute_yield_estimate(predictions: list[dict[str, Any]]) -> dict[str, Any]:
    clean: list[dict[str, Any]] = [p for p in predictions if isinstance(p, dict)]
    total = len(clean)

    if total == 0:
        return {
            "kernel_development_score": 0,
            "discoloration_index": 0,
            "leaf_dryness_index": 0,
            "overall_yield_index": 0,
            "summary": (
                "No plants or ears were confidently detected in this frame, so yield "
                "cannot be estimated from this image alone."
            ),
            "counts": {
                "total_detections": 0,
                "kernel_like": 0,
                "discoloration_like": 0,
                "dryness_like": 0,
            },
        }

    kernel_keywords = (
        "ear",
        "cob",
        "kernel",
        "corn",
        "maize",
    )
    discolor_keywords = (
        "discolor",
        "yellow",
        "chlorosis",
        "spot",
        "blight",
        "rust",
        "lesion",
        "mold",
    )
    dryness_keywords = (
        "dry",
        "dryness",
        "wilt",
        "wilting",
        "drought",
        "senescent",
        "dead leaf",
        "necrosis",
    )

    kernel_like = 0
    discolor_like = 0
    dryness_like = 0

    for p in clean:
        raw_label = (
            p.get("class")
            or p.get("class_name")
            or p.get("label")
            or p.get("name")
            or ""
        )
        label = str(raw_label).lower()
        if not label:
            continue

        if any(k in label for k in kernel_keywords):
            kernel_like += 1
        if any(k in label for k in discolor_keywords):
            discolor_like += 1
        if any(k in label for k in dryness_keywords):
            dryness_like += 1

    non_stress = max(0, total - discolor_like - dryness_like)
    effective_kernel = kernel_like if kernel_like > 0 else non_stress

    def _pct(num: int, denom: int) -> int:
        if denom <= 0:
            return 0
        val = int(round(100 * num / denom))
        return max(0, min(100, val))

    kernel_score = _pct(effective_kernel, total)
    discolor_index = _pct(discolor_like, total)
    dryness_index = _pct(dryness_like, total)

    stress_ratio = (discolor_index + dryness_index) / 200.0
    health_factor = max(0.0, min(1.0, 1.0 - stress_ratio))
    overall_yield = int(round(kernel_score * health_factor))
    overall_yield = max(0, min(100, overall_yield))

    if overall_yield >= 80:
        level = "high"
        guidance = (
            "Plants in this frame appear generally healthy with good kernel development. "
            "Maintain current management and monitor for emerging stress."
        )
    elif overall_yield >= 50:
        level = "moderate"
        guidance = (
            "There is a mix of healthy and stressed plants. Targeted nutrient or pest "
            "management could help protect final yield."
        )
    else:
        level = "low"
        guidance = (
            "Stress indicators and limited kernel development suggest yield may be "
            "constrained in this area. Consider focused scouting and intervention."
        )

    summary = (
        f"Estimated {level} yield potential from this frame. "
        f"Kernel development score: {kernel_score}%, "
        f"discoloration index: {discolor_index}%, "
        f"leaf dryness index: {dryness_index}%. {guidance}"
    )

    return {
        "kernel_development_score": kernel_score,
        "discoloration_index": discolor_index,
        "leaf_dryness_index": dryness_index,
        "overall_yield_index": overall_yield,
        "summary": summary,
        "counts": {
            "total_detections": total,
            "kernel_like": kernel_like,
            "discoloration_like": discolor_like,
            "dryness_like": dryness_like,
        },
    }


@router.post("/")
async def estimate_field(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if not settings.ROBOFLOW_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ROBOFLOW_API_KEY is not set. Set it in your environment to enable Estimate Field.",
        )

    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    stem = uuid.uuid4().hex
    original_filename = f"{stem}{ext}"
    original_path = os.path.join(settings.UPLOAD_DIR, original_filename)

    with open(original_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # Call Roboflow directly over HTTP instead of relying on the inference-sdk client.
        url = f"{settings.ROBOFLOW_API_URL.rstrip('/')}/{settings.ROBOFLOW_MODEL_ID}"
        params = {"api_key": settings.ROBOFLOW_API_KEY}

        with open(original_path, "rb") as f:
            files = {"file": (original_filename, f, "application/octet-stream")}
            resp = httpx.post(url, params=params, files=files, timeout=60.0)

        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Roboflow HTTP error: {e.response.text}",
            ) from e

        raw = resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Roboflow inference failed: {e}")

    predictions = raw.get("predictions") if isinstance(raw, dict) else None
    if not isinstance(predictions, list):
        predictions = []

    yield_estimate = _compute_yield_estimate(predictions)

    annotated_filename = f"{stem}_rf.jpg"
    annotated_path = os.path.join(settings.UPLOAD_DIR, annotated_filename)

    try:
        _render_bboxes_with_labels(
            image_path=original_path,
            predictions=[p for p in predictions if isinstance(p, dict)],
            output_path=annotated_path,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render Roboflow annotations: {e}")

    out: dict[str, Any] = {
        "source": "roboflow",
        "model_id": settings.ROBOFLOW_MODEL_ID,
        "scan_type": "estimate_field",
        "predictions": predictions,
        "raw": raw,
        "yield_estimate": yield_estimate,
        "annotated_image_filename": annotated_filename,
        "annotated_image_url": f"{settings.API_V1_STR}/estimate-field/image/{annotated_filename}",
        "original_image_filename": original_filename,
        "original_image_url": f"{settings.API_V1_STR}/estimate-field/image/{original_filename}",
    }

    try:
        create_scan(
            db,
            user_id=current_user.id,
            image_filename=original_filename,
            result_json=json.dumps(out),
        )
    except Exception:
        # Persisting history should not break the main inference response.
        pass

    return out


@router.get("/image/{image_name}")
def get_estimate_image(
    image_name: str,
    current_user: User = Depends(deps.get_current_active_user),
):
    safe_name = os.path.basename(image_name)
    path = os.path.join(settings.UPLOAD_DIR, safe_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)
