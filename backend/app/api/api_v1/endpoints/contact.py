from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.crud.contact_message import create_contact_message
from app.db.session import get_db
from app.schemas.contact import ContactCreate, ContactOut

router = APIRouter(prefix="/contact", tags=["contact"])


@router.post("/", response_model=ContactOut)
def submit_contact(message_in: ContactCreate, db: Session = Depends(get_db)) -> ContactOut:
    cm = create_contact_message(
        db,
        name=message_in.name,
        email=message_in.email,
        subject=message_in.subject,
        message=message_in.message,
    )
    return cm
