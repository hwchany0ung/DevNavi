"""
프로젝트 전역 상수.
"""

# SSE (Server-Sent Events) 공통 응답 헤더
SSE_HEADERS: dict[str, str] = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}
