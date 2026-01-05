from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.models.user import User


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.execute(select(User).where(User.email == email)).scalar_one_or_none()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.execute(select(User).where(User.username == username)).scalar_one_or_none()


def create_user(
    db: Session,
    *,
    email: str,
    username: str,
    password: str,
    full_name: Optional[str] = None,
) -> User:
    user = User(
        email=email,
        username=username,
        full_name=full_name,
        hashed_password=get_password_hash(password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, identifier: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, identifier)
    if user is None:
        user = get_user_by_username(db, identifier)
    if user is None:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
