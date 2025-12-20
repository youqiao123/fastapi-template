# backend/app/api/routes/chat.py
import asyncio
import json
from typing import AsyncIterator

from fastapi import APIRouter, Query, Depends
from starlette.responses import StreamingResponse

from app.api.deps import get_current_user, CurrentUser

router = APIRouter(prefix="/chat", tags=["chat"])

def sse(event: str, data: dict, event_id: int | None = None) -> str:
    # SSE 格式：可选 id + event + data，每个事件以空行结束
    msg = ""
    if event_id is not None:
        msg += f"id: {event_id}\n"
    msg += f"event: {event}\n"
    msg += f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
    return msg

@router.get("/stream", dependencies=[Depends(get_current_user)])
async def chat_stream(_current_user: CurrentUser, q: str = Query(default="hello")):
    async def gen() -> AsyncIterator[str]:
        yield sse("status", {"phase": "start", "query": q}, event_id=0)

        tokens = ["这是", " 一个", " SSE", " mock", " 流式", " 输出", "。"]
        for i, t in enumerate(tokens, start=1):
            yield sse("token", {"delta": t, "seq": i}, event_id=i)
            await asyncio.sleep(0.2)

        yield sse("done", {"final": "".join(tokens)}, event_id=len(tokens) + 1)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            # 某些反向代理会缓冲；这个头对部分代理有用（本地开发先加上不亏）
            "X-Accel-Buffering": "no",
        },
    )
