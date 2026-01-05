from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


# Load backend/.env if it exists so local environment variables (e.g. ROBOFLOW_API_KEY)
# are available without needing to run `set` commands manually.
BASE_DIR = Path(__file__).resolve().parents[2]
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(env_path)


def _float_env(key: str, default: float) -> float:
    try:
        return float(os.getenv(key, str(default)))
    except Exception:
        return default


class Settings:
    PROJECT_NAME = "AgridroneScan API"
    API_V1_STR = "/api"

    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agridronescan.db")

    SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-prod")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    _cors_origins = os.getenv("CORS_ORIGINS", "*")

    # If wildcard is present, treat as allow-all for local development
    if "*" in _cors_origins:
        CORS_ORIGINS = ["*"]
    else:
        CORS_ORIGINS = [o.strip() for o in _cors_origins.split(",") if o.strip()]

    AI_MODEL_PATH = os.getenv("AI_MODEL_PATH", "./best.pt")
    AI_REMOTE_BASE_URL = os.getenv(
        "AI_REMOTE_BASE_URL",
        "https://relaxed-ofelia-synapseitgroup-02d34b22.koyeb.app",
    )
    AI_REMOTE_TIMEOUT_SECONDS = _float_env("AI_REMOTE_TIMEOUT_SECONDS", 30.0)
    AI_REMOTE_CONF = _float_env("AI_REMOTE_CONF", 0.25)
    AI_REMOTE_IOU = _float_env("AI_REMOTE_IOU", 0.7)
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")

    ROBOFLOW_API_URL = os.getenv("ROBOFLOW_API_URL", "https://serverless.roboflow.com")
    ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "")
    ROBOFLOW_MODEL_ID = os.getenv("ROBOFLOW_MODEL_ID", "corn-2xipv-uadpf/3")


settings = Settings()
