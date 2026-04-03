"""
보안 이벤트 감지 미들웨어 — Pure ASGI, SSE 스트리밍 안전.

Design Ref: security-monitoring-be.design.md §1
Plan SC: 429/401 이벤트 발생 시 security_events에 기록

429 (Rate Limit Exceeded) + 401 (Auth Failure) 감지 후
fire-and-forget으로 security_events 테이블에 비동기 저장.
"""
import asyncio
import logging

from starlette.types import ASGIApp, Receive, Scope, Send

from app.services.security_event_service import save_security_event

logger = logging.getLogger(__name__)


def _extract_client_ip(scope: Scope) -> str:
    """X-Forwarded-For 헤더 우선, 없으면 scope의 client IP.

    CloudFront/ALB 경유 시 X-Forwarded-For 첫 번째 값이 실제 클라이언트 IP.
    """
    headers = dict(scope.get("headers", []))
    xff = headers.get(b"x-forwarded-for", b"").decode("utf-8", errors="ignore")
    if xff:
        return xff.split(",")[0].strip()
    client = scope.get("client")
    return client[0] if client else ""


class SecurityEventMiddleware:
    """429·401 응답을 감지하여 security_events 테이블에 기록.

    Pure ASGI 패턴 — BaseHTTPMiddleware 미사용 (SSE 스트리밍 안전).
    ErrorLoggingMiddleware와 동일한 fire-and-forget + _pending_tasks 패턴.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        # BC-1 패턴: create_task 참조를 보관하여 GC에 의한 조기 수거 방지
        self._pending_tasks: set = set()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        status_ref: dict = {"code": 200}

        async def send_wrapper(message: dict) -> None:
            if message["type"] == "http.response.start":
                status_ref["code"] = message.get("status", 200)
            await send(message)

        await self.app(scope, receive, send_wrapper)

        code = status_ref["code"]
        if code in (401, 429):
            event_type = "rate_limit_exceeded" if code == 429 else "auth_failure"
            ip = _extract_client_ip(scope)
            path = scope.get("path", "")
            method = scope.get("method", "GET")

            task = asyncio.create_task(
                save_security_event(
                    event_type=event_type,
                    ip=ip,
                    path=path,
                    method=method,
                    status_code=code,
                )
            )
            self._pending_tasks.add(task)
            task.add_done_callback(self._pending_tasks.discard)
