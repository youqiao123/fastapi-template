# backend/app/api/routes/chat.py
import os
from datetime import datetime
from typing import AsyncIterator

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import func, select
from starlette.responses import StreamingResponse

from app.api.deps import CurrentUser, SessionDep, get_current_user
from app.core.ids import generate_ulid
from app.models import (
    ConversationThread,
    ConversationThreadCreate,
    ConversationThreadPublic,
    ConversationThreadsPublic,
    ConversationThreadUpdate,
)

router = APIRouter(tags=["chat"])
AGENT_BASE_URL = os.getenv("AGENT_BASE_URL", None) # for deployment
# AGENT_BASE_URL = "http://localhost:9001"  # for local testing
if not AGENT_BASE_URL:
    raise RuntimeError("AGENT_BASE_URL is not set")

STATUS_ACTIVE = "active"
STATUS_ARCHIVED = "archived"
STATUS_DELETED = "deleted"

timeout = httpx.Timeout(
    connect=10.0,
    read=None,
    write=10.0,
    pool=10.0,
)

class MessageItem(BaseModel):
    role: str
    content: str


def _get_thread(
    session: SessionDep,
    current_user: CurrentUser,
    thread_id: str,
    *,
    include_deleted: bool = False,
) -> ConversationThread:
    statement = select(ConversationThread).where(
        ConversationThread.thread_id == thread_id,
        ConversationThread.user_id == current_user.id,
    )
    if not include_deleted:
        statement = statement.where(ConversationThread.status != STATUS_DELETED)
    thread = session.exec(statement).one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread


@router.get("/chat/stream", dependencies=[Depends(get_current_user)])
async def chat_stream(
    session: SessionDep,
    current_user: CurrentUser,
    q: str = Query(default="hello"),
    thread_id: str = Query(..., min_length=1),
):
    _get_thread(session, current_user, thread_id)

    async def gen() -> AsyncIterator[bytes]:
        # payload 的字段要和 agent 服务的 /agent/chat 接口保持一致
        payload = {
            "message": q,
            "user_id": str(current_user.id),
            "thread_id": thread_id,
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                # f"{AGENT_BASE_URL}/agent/chat",
                f"{AGENT_BASE_URL}/agent/fake-chat", # for testing
                json=payload,
            ) as resp:
                resp.raise_for_status()

                async for chunk in resp.aiter_bytes():
                    if chunk:
                        yield chunk

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/messages",
    response_model=list[MessageItem],
    dependencies=[Depends(get_current_user)],
)
async def get_messages(
    session: SessionDep,
    current_user: CurrentUser,
    thread_id: str = Query(..., min_length=1),
) -> list[MessageItem]:
    _get_thread(session, current_user, thread_id)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(
            f"{AGENT_BASE_URL}/agent/get_messages",
            params={"thread_id": thread_id},
        )
        resp.raise_for_status()
        data = resp.json()

    return [MessageItem.model_validate(item) for item in data]


@router.post("/threads", response_model=ConversationThreadPublic)
def create_thread(
    session: SessionDep,
    current_user: CurrentUser,
    thread_in: ConversationThreadCreate,
) -> ConversationThread:
    thread = ConversationThread(
        thread_id=generate_ulid(),
        user_id=current_user.id,
        title=thread_in.title,
        status=STATUS_ACTIVE,
    )
    session.add(thread)
    session.commit()
    session.refresh(thread)
    return thread


@router.get("/threads", response_model=ConversationThreadsPublic)
def list_threads(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> ConversationThreadsPublic:
    count_statement = (
        select(func.count())
        .select_from(ConversationThread)
        .where(
            ConversationThread.user_id == current_user.id,
            ConversationThread.status != STATUS_DELETED,
        )
    )
    count = session.exec(count_statement).one()
    statement = (
        select(ConversationThread)
        .where(
            ConversationThread.user_id == current_user.id,
            ConversationThread.status != STATUS_DELETED,
        )
        .offset(skip)
        .limit(limit)
        .order_by(ConversationThread.updated_at.desc())
    )
    threads = session.exec(statement).all()
    return ConversationThreadsPublic(data=threads, count=count)


@router.get("/threads/{thread_id}", response_model=ConversationThreadPublic)
def get_thread(
    session: SessionDep, current_user: CurrentUser, thread_id: str
) -> ConversationThread:
    return _get_thread(session, current_user, thread_id)


@router.patch("/threads/{thread_id}", response_model=ConversationThreadPublic)
def update_thread(
    session: SessionDep,
    current_user: CurrentUser,
    thread_id: str,
    thread_in: ConversationThreadUpdate,
) -> ConversationThread:
    thread = _get_thread(session, current_user, thread_id)
    update_data = thread_in.model_dump(exclude_unset=True)
    if update_data:
        thread.sqlmodel_update(update_data)
        thread.updated_at = datetime.now()
        session.add(thread)
        session.commit()
        session.refresh(thread)
    return thread


@router.post("/threads/{thread_id}/archive", response_model=ConversationThreadPublic)
def archive_thread(
    session: SessionDep, current_user: CurrentUser, thread_id: str
) -> ConversationThread:
    thread = _get_thread(session, current_user, thread_id, include_deleted=True)
    if thread.status != STATUS_ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Thread is not active",
        )
    thread.status = STATUS_ARCHIVED
    thread.updated_at = datetime.now()
    session.add(thread)
    session.commit()
    session.refresh(thread)
    return thread


@router.post("/threads/{thread_id}/restore", response_model=ConversationThreadPublic)
def restore_thread(
    session: SessionDep, current_user: CurrentUser, thread_id: str
) -> ConversationThread:
    thread = _get_thread(session, current_user, thread_id, include_deleted=True)
    if thread.status != STATUS_ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Thread is not archived",
        )
    thread.status = STATUS_ACTIVE
    thread.updated_at = datetime.now()
    session.add(thread)
    session.commit()
    session.refresh(thread)
    return thread


@router.delete("/threads/{thread_id}", response_model=ConversationThreadPublic)
def delete_thread(
    session: SessionDep, current_user: CurrentUser, thread_id: str
) -> ConversationThread:
    thread = _get_thread(session, current_user, thread_id, include_deleted=True)
    if thread.status == STATUS_DELETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Thread is already deleted",
        )
    thread.status = STATUS_DELETED
    thread.updated_at = datetime.now()
    session.add(thread)
    session.commit()
    session.refresh(thread)
    return thread
