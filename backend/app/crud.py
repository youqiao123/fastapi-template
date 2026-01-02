import logging
import uuid
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models import Item, ItemCreate, User, UserCreate, UserUpdate

logger = logging.getLogger(__name__)


def _ensure_user_storage(user_id: uuid.UUID) -> None:
    if not settings.ARTIFACTS_STORAGE_DIR:
        return
    root = Path(settings.ARTIFACTS_STORAGE_DIR).resolve()
    target = root / str(user_id)
    target.mkdir(parents=True, exist_ok=True)
    logger.info("Ensured artifact directory for user %s at %s", user_id, target)


def create_user(
    *, session: Session, user_create: UserCreate, is_verified: bool = True
) -> User:
    db_obj = User.model_validate(
        user_create,
        update={
            "hashed_password": get_password_hash(user_create.password),
            "is_verified": is_verified,
        },
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    _ensure_user_storage(db_obj.id)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        return None
    if not verify_password(password, db_user.hashed_password):
        return None
    return db_user


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    db_item = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item
