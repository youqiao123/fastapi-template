# backend/app/api/routes/chat.py
import os
from typing import AsyncIterator
import httpx

from fastapi import APIRouter, Query, Depends
from starlette.responses import StreamingResponse

from app.api.deps import get_current_user, CurrentUser

router = APIRouter(prefix="/chat", tags=["chat"])
AGENT_BASE_URL = os.getenv("AGENT_BASE_URL", "http://localhost:9001")

# TODO: 把sse迁移到agent服务中
# def sse(event: str, data: dict, event_id: int | None = None) -> str:
#     # SSE 格式：可选 id + event + data，每个事件以空行结束
#     msg = ""
#     if event_id is not None:
#         msg += f"id: {event_id}\n"
#     msg += f"event: {event}\n"
#     msg += f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
#     return msg

@router.get("/stream", dependencies=[Depends(get_current_user)])
async def chat_stream(
    _current_user: CurrentUser,
    q: str = Query(default="hello"),
):
    async def gen() -> AsyncIterator[bytes]:
        # payload 的字段要和 agent 服务的 /agent/chat 接口保持一致
        payload = {
            "message": q,
            # 后续你可以在这里加入 user_id / session_id
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