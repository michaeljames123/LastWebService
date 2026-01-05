from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.contact_message import ContactMessage


def create_contact_message(
    db: Session,
    *,
    name: str,
    email: str,
    subject: str,
    message: str,
) -> ContactMessage:
    cm = ContactMessage(name=name, email=email, subject=subject, message=message)
    db.add(cm)
    db.commit()
    db.refresh(cm)
    return cm
