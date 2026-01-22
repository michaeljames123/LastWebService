from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.crud.user import authenticate_user, create_user, get_user_by_email, get_user_by_username
from app.db.session import get_db
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> UserOut:
    if get_user_by_email(db, user_in.email) is not None:
        raise HTTPException(status_code=400, detail="Email is already registered")
    if get_user_by_username(db, user_in.username) is not None:
        raise HTTPException(status_code=400, detail="Username is already taken")

    user = create_user(
        db,
        email=user_in.email,
        username=user_in.username,
        password=user_in.password,
        full_name=user_in.full_name,
    )
    return user


@router.post("/register-simple", response_model=UserOut)
def register_simple(
    email: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    full_name: str | None = Form(None),
    db: Session = Depends(get_db),
) -> UserOut:
    if get_user_by_email(db, email) is not None:
        raise HTTPException(status_code=400, detail="Email is already registered")
    if get_user_by_username(db, username) is not None:
        raise HTTPException(status_code=400, detail="Username is already taken")

    user = create_user(
        db,
        email=email,
        username=username,
        password=password,
        full_name=full_name,
    )
    return user


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    user = authenticate_user(db, identifier=form_data.username, password=form_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=str(user.id))
    return Token(access_token=access_token, token_type="bearer")
