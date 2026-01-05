from __future__ import annotations

import os
import shutil
import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.core.config import settings
from app.services.ai_service import ModelNotAvailableError, model_status, predict_image

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/status")
def get_status() -> dict:
    return model_status()


@router.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict:
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"tmp_{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, filename)

    try:
        with open(path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        try:
            return predict_image(path)
        except ModelNotAvailableError as e:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    finally:
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass
