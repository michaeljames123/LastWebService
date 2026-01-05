from __future__ import annotations

import json
import mimetypes
import os
from functools import lru_cache
from typing import Any

from app.core.config import settings


class ModelNotAvailableError(RuntimeError):
    pass


def _require_pillow():
    try:
        from PIL import Image, ImageDraw, ImageFont  # type: ignore
    except Exception as e:  # pragma: no cover
        raise ModelNotAvailableError(
            "Pillow is not installed. Install backend/requirements.txt to enable image annotation."
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


def _class_color(class_id: Any) -> tuple[int, int, int]:
    try:
        idx = int(class_id)
    except Exception:
        idx = 0
    return _hex_to_rgb(_ULTRALYTICS_HEX[idx % len(_ULTRALYTICS_HEX)])


def _poly_points_from_detection(
    det: dict[str, Any], *, image_w: int, image_h: int
) -> list[tuple[float, float]] | None:
    poly = det.get("polygon")
    if isinstance(poly, list) and poly:
        first = poly[0]
        if (
            isinstance(first, (list, tuple))
            and len(first) == 2
            and isinstance(first[0], (int, float))
            and isinstance(first[1], (int, float))
        ):
            out: list[tuple[float, float]] = []
            for p in poly:
                if (
                    isinstance(p, (list, tuple))
                    and len(p) == 2
                    and isinstance(p[0], (int, float))
                    and isinstance(p[1], (int, float))
                ):
                    out.append((float(p[0]), float(p[1])))
            return out or None

        if isinstance(first, list) and first:
            inner_first = first[0]
            if (
                isinstance(inner_first, (list, tuple))
                and len(inner_first) == 2
                and isinstance(inner_first[0], (int, float))
                and isinstance(inner_first[1], (int, float))
            ):
                out2: list[tuple[float, float]] = []
                for ring in poly:
                    if not isinstance(ring, list):
                        continue
                    for p in ring:
                        if (
                            isinstance(p, (list, tuple))
                            and len(p) == 2
                            and isinstance(p[0], (int, float))
                            and isinstance(p[1], (int, float))
                        ):
                            out2.append((float(p[0]), float(p[1])))
                return out2 or None

    polyn = det.get("polygon_normalized")
    if isinstance(polyn, list) and polyn:
        first_n = polyn[0]
        if (
            isinstance(first_n, (list, tuple))
            and len(first_n) == 2
            and isinstance(first_n[0], (int, float))
            and isinstance(first_n[1], (int, float))
        ):
            outn: list[tuple[float, float]] = []
            for p in polyn:
                if (
                    isinstance(p, (list, tuple))
                    and len(p) == 2
                    and isinstance(p[0], (int, float))
                    and isinstance(p[1], (int, float))
                ):
                    outn.append((float(p[0]) * image_w, float(p[1]) * image_h))
            return outn or None
    return None


def render_polygons_only(
    *,
    image_path: str,
    detections: list[dict[str, Any]],
    output_path: str,
) -> None:
    Image, ImageDraw, ImageFont = _require_pillow()

    base = Image.open(image_path).convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = ImageFont.load_default()

    w, h = base.size

    for det in detections:
        if not isinstance(det, dict):
            continue

        pts = _poly_points_from_detection(det, image_w=w, image_h=h)
        if not pts:
            continue

        color = _class_color(det.get("class_id"))
        fill = (color[0], color[1], color[2], 90)
        outline = (color[0], color[1], color[2], 255)

        try:
            draw.polygon(pts, fill=fill)
            if len(pts) >= 2:
                draw.line(pts + [pts[0]], fill=outline, width=3)
        except Exception:
            continue

        label = str(det.get("class_name") or det.get("class_id") or "")
        if not label:
            continue

        cx = sum(p[0] for p in pts) / float(len(pts))
        cy = sum(p[1] for p in pts) / float(len(pts))

        try:
            bbox = draw.textbbox((0, 0), label, font=font)
            tw = float(bbox[2] - bbox[0])
            th = float(bbox[3] - bbox[1])
        except Exception:
            tw, th = draw.textsize(label, font=font)

        pad = 3
        x0 = max(0.0, min(float(w - 1), cx - tw / 2.0))
        y0 = max(0.0, min(float(h - 1), cy - th / 2.0))
        x1 = max(0.0, min(float(w), x0 + tw + pad * 2))
        y1 = max(0.0, min(float(h), y0 + th + pad * 2))

        draw.rectangle([x0, y0, x1, y1], fill=(color[0], color[1], color[2], 220))
        draw.text((x0 + pad, y0 + pad), label, fill=(255, 255, 255, 255), font=font)

    out = Image.alpha_composite(base, overlay).convert("RGB")
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    out.save(output_path)


def _remote_base_url() -> str:
    return str(getattr(settings, "AI_REMOTE_BASE_URL", "") or "").strip().rstrip("/")


def _require_httpx():
    try:
        import httpx  # type: ignore
    except Exception as e:  # pragma: no cover
        raise ModelNotAvailableError(
            "httpx is not installed. Install backend/requirements.txt to enable remote AI inference."
        ) from e
    return httpx


@lru_cache(maxsize=1)
def _get_yolo_model():
    try:
        from ultralytics import YOLO  # type: ignore
    except Exception as e:  # pragma: no cover
        raise ModelNotAvailableError(
            "Ultralytics is not installed. Install backend/requirements-ai.txt to enable AI inference."
        ) from e

    model_path = settings.AI_MODEL_PATH
    if not os.path.exists(model_path):
        raise ModelNotAvailableError(f"Model file not found at: {model_path}")

    return YOLO(model_path)


def model_status() -> dict[str, Any]:
    base_url = _remote_base_url()
    if base_url:
        try:
            httpx = _require_httpx()
            res = httpx.get(
                f"{base_url}/health",
                params={"load_model": "true"},
                timeout=settings.AI_REMOTE_TIMEOUT_SECONDS,
            )
            res.raise_for_status()
            data = res.json()

            remote_model_path = data.get("model_path") if isinstance(data, dict) else None

            if isinstance(data, dict) and data.get("status") == "ok" and not data.get("model_error"):
                out: dict[str, Any] = {
                    "available": True,
                    "model_path": base_url,
                    "source": "remote",
                }
                if remote_model_path is not None:
                    out["remote_model_path"] = str(remote_model_path)
                return out

            reason = data.get("model_error") if isinstance(data, dict) else data
            out = {
                "available": False,
                "model_path": base_url,
                "reason": str(reason),
                "source": "remote",
            }
            if remote_model_path is not None:
                out["remote_model_path"] = str(remote_model_path)
            return out
        except ModelNotAvailableError as e:
            return {
                "available": False,
                "model_path": base_url,
                "reason": str(e),
                "source": "remote",
            }
        except Exception as e:
            return {
                "available": False,
                "model_path": base_url,
                "reason": f"Remote AI unavailable: {e}",
                "source": "remote",
            }

    try:
        _get_yolo_model()
        return {"available": True, "model_path": settings.AI_MODEL_PATH, "source": "local"}
    except ModelNotAvailableError as e:
        return {
            "available": False,
            "model_path": settings.AI_MODEL_PATH,
            "reason": str(e),
            "source": "local",
        }


def _safe_tensor_to_list(x: Any) -> Any:
    try:
        if hasattr(x, "cpu"):
            x = x.cpu()
        if hasattr(x, "tolist"):
            return x.tolist()
    except Exception:
        return None
    return x


def predict_image(image_path: str) -> dict[str, Any]:
    base_url = _remote_base_url()
    if base_url:
        httpx = _require_httpx()
        filename = os.path.basename(image_path)
        content_type = mimetypes.guess_type(filename)[0] or "image/jpeg"

        try:
            with open(image_path, "rb") as f:
                res = httpx.post(
                    f"{base_url}/predict",
                    params={
                        "conf": settings.AI_REMOTE_CONF,
                        "iou": settings.AI_REMOTE_IOU,
                        "return_image": "true",
                    },
                    files={"file": (filename, f, content_type)},
                    timeout=settings.AI_REMOTE_TIMEOUT_SECONDS,
                )

            if res.status_code >= 400:
                try:
                    detail = res.json()
                except Exception:
                    detail = res.text
                raise ModelNotAvailableError(f"Remote AI error ({res.status_code}): {detail}")

            data = res.json()
            predictions = data.get("predictions") if isinstance(data, dict) else None
            if not isinstance(predictions, list):
                predictions = []

            detections: list[dict[str, Any]] = []
            for p in predictions:
                if not isinstance(p, dict):
                    continue
                detections.append(
                    {
                        "bbox": p.get("box_xyxy"),
                        "confidence": p.get("confidence"),
                        "class_id": p.get("class_id"),
                        "class_name": p.get("class_name"),
                        "polygon": p.get("polygon"),
                        "polygon_normalized": p.get("polygon_normalized"),
                    }
                )

            meta = data.get("meta") if isinstance(data, dict) else None
            names = meta.get("model_names") if isinstance(meta, dict) else {}
            if not isinstance(names, dict):
                names = {}

            annotated_filename: str | None = None
            annotated_error: str | None = None
            stem = os.path.splitext(filename)[0]
            annotated_filename = f"{stem}_poly.jpg"
            annotated_path = os.path.join(os.path.dirname(image_path), annotated_filename)
            try:
                render_polygons_only(image_path=image_path, detections=detections, output_path=annotated_path)
            except Exception as e:
                annotated_error = str(e)
                annotated_filename = None

            out: dict[str, Any] = {"detections": detections, "names": names, "source": "remote"}
            if isinstance(data, dict) and "image" in data:
                out["image"] = data.get("image")
            if isinstance(meta, dict):
                out["meta"] = meta
            if annotated_filename:
                out["annotated_image_filename"] = annotated_filename
            if annotated_error:
                out["annotated_image_error"] = annotated_error
            return out
        except ModelNotAvailableError:
            raise
        except Exception as e:
            raise ModelNotAvailableError(f"Remote AI request failed: {e}") from e

    model = _get_yolo_model()
    results = model.predict(source=image_path, verbose=False)
    if not results:
        return {"detections": [], "names": {}}

    first = results[0]

    if hasattr(first, "tojson"):
        try:
            raw = first.tojson()
            try:
                detections = json.loads(raw)
            except Exception:
                detections = raw
            return {"detections": detections, "names": getattr(first, "names", {})}
        except Exception:
            pass

    detections: list[dict[str, Any]] = []
    names = getattr(first, "names", {})

    boxes = getattr(first, "boxes", None)
    if boxes is not None:
        xyxy = _safe_tensor_to_list(getattr(boxes, "xyxy", None))
        conf = _safe_tensor_to_list(getattr(boxes, "conf", None))
        cls = _safe_tensor_to_list(getattr(boxes, "cls", None))

        if isinstance(xyxy, list) and isinstance(conf, list) and isinstance(cls, list):
            for i in range(min(len(xyxy), len(conf), len(cls))):
                c = int(cls[i]) if cls[i] is not None else None
                detections.append(
                    {
                        "bbox": xyxy[i],
                        "confidence": conf[i],
                        "class_id": c,
                        "class_name": names.get(c) if isinstance(names, dict) else None,
                    }
                )

    return {"detections": detections, "names": names}
