from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ScanOut(BaseModel):
    id: int
    image_filename: str
    image_url: str
    result: dict
    created_at: datetime
