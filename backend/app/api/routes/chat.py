# backend/app/api/routes/chat.py
import os
from datetime import datetime
from typing import AsyncIterator

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import func, select
from starlette.responses import StreamingResponse

from app.api.deps import CurrentUser, SessionDep, get_current_user
from app.core.ids import generate_ulid
from app.models import (
    ConversationThread,
    ConversationThreadPublic,
    ConversationThreadsPublic,
    ConversationThreadUpdate,
)

router = APIRouter(tags=["chat"])
AGENT_BASE_URL = os.getenv("AGENT_BASE_URL", "http://localhost:9001")

STATUS_ACTIVE = "active"
STATUS_ARCHIVED = "archived"
STATUS_DELETED = "deleted"


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


# TODO: 把sse迁移到agent服务中
# def sse(event: str, data: dict, event_id: int | None = None) -> str:
#     # SSE 格式：可选 id + event + data，每个事件以空行结束
#     msg = ""
#     if event_id is not None:
#         msg += f"id: {event_id}\n"
#     msg += f"event: {event}\n"
#     msg += f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
#     return msg

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

        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{AGENT_BASE_URL}/agent/chat",
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


@router.post("/threads", response_model=ConversationThreadPublic)
def create_thread(session: SessionDep, current_user: CurrentUser) -> ConversationThread:
    thread = ConversationThread(
        thread_id=generate_ulid(),
        user_id=current_user.id,
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
