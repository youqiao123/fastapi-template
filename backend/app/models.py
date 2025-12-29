import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from pydantic import ConfigDict, EmailStr
from sqlmodel import Field, Relationship, SQLModel


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    is_verified: bool = Field(default=True)
    email_verification_sent_at: datetime | None = Field(
        default=None,
        sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True),
    )
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)
    conversation_threads: list["ConversationThread"] = Relationship(
        back_populates="user", cascade_delete=True
    )


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Shared properties
class ConversationThreadBase(SQLModel):
    status: str = Field(default="active", max_length=32)
    title: str | None = Field(default=None, max_length=255)
    metadata_: dict[str, Any] | None = Field(
        default=None,
        sa_column=sa.Column("metadata", sa.JSON),
        alias="metadata",
    )

    model_config = SQLModel.model_config | ConfigDict(populate_by_name=True)


# Properties to receive on thread creation
class ConversationThreadCreate(SQLModel):
    title: str = Field(min_length=1, max_length=255)


# Properties to receive on thread update
class ConversationThreadUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)


# Database model, database table inferred from class name
class ConversationThread(ConversationThreadBase, table=True):
    __tablename__ = "conversation_thread"

    thread_id: str = Field(primary_key=True, max_length=26)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    user: User | None = Relationship(back_populates="conversation_threads")


# Properties to return via API, thread_id is always required
class ConversationThreadPublic(ConversationThreadBase):
    thread_id: str
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ConversationThreadsPublic(SQLModel):
    data: list[ConversationThreadPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class EmailVerification(SQLModel):
    token: str
