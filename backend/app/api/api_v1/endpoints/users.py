from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api import deps
from app.models.user import User
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(deps.get_current_active_user)) -> UserOut:
    return current_user
