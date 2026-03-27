import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.types import ASGIApp, Receive, Scope, Send
from starlette.datastructures import MutableHeaders

from app.core.config import settings
from app.core.limiter import limiter
from app.core.supabase_client import close_supabase_client, get_supabase_client, sb_headers, sb_url
from app.api.roadmap import router as roadmap_router
from app.api.admin import router as admin_router, save_error_log

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 라이프사이클 훅."""
    # startup: lazy-initialized 클라이언트들은 첫 요청 시 자동 생성
    yield
    # shutdown: Supabase httpx 클라이언트 정상 종료
    await close_supabase_client()


_is_dev = settings.ENV == "development"
app = FastAPI(
    title="DevNavi API",
    version="0.1.0",
    docs_url="/docs" if _is_dev else None,
    redoc_url="/redoc" if _is_dev else None,
    openapi_url="/openapi.json" if _is_dev else None,  # 프로덕션에서 API 스키마 노출 차단
    lifespan=lifespan,
)

# ── Rate Limiter 등록 ────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ─────────────────────────────────────────────────────────────────────
# Pure ASGI 미들웨어 (BaseHTTPMiddleware 미사용)
#
# BaseHTTPMiddleware는 응답을 내부 비동기 채널로 감싸기 때문에
# Mangum RESPONSE_STREAM 모드와 충돌하여 SSE 스트림이 빈 채로 전달됨.
# Pure ASGI 방식은 send() 함수만 래핑하여 스트리밍을 방해하지 않음.
# ─────────────────────────────────────────────────────────────────────

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
}

_LOG_SKIP_PATHS = {"/health"}


class SecurityHeadersMiddleware:
    """보안 응답 헤더 추가 — Pure ASGI, SSE 스트리밍 안전."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_security_headers(message: dict) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in _SECURITY_HEADERS.items():
                    headers[name] = value
            await send(message)

        await self.app(scope, receive, send_with_security_headers)


class ErrorLoggingMiddleware:
    """5xx 에러 자동 로깅 — Pure ASGI, SSE 스트리밍 안전."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path   = scope.get("path", "")
        method = scope.get("method", "GET")
        status_ref: dict = {"code": 200}

        async def send_wrapper(message: dict) -> None:
            if message["type"] == "http.response.start":
                status_ref["code"] = message.get("status", 200)
            await send(message)

        await self.app(scope, receive, send_wrapper)

        if status_ref["code"] >= 500 and path not in _LOG_SKIP_PATHS:
            asyncio.create_task(
                save_error_log(
                    method=method,
                    path=path,
                    status_code=status_ref["code"],
                    error_msg=f"HTTP {status_ref['code']}",
                )
            )


# ── 미들웨어 등록 순서 (add_middleware: 나중에 추가할수록 outermost) ──
# 실행 순서 (안→밖): FastAPI → ErrorLogging → SecurityHeaders → CORS
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ErrorLoggingMiddleware)

# ── CORS ──────────────────────────────────────────────────────────────
# Production: Lambda Function URL CORS 블록이 단일 처리
#   - OPTIONS preflight: Lambda URL이 자동 응답 (Lambda 도달 안 함)
#   - 실제 요청(GET/POST): Lambda URL이 Access-Control-Allow-Origin 추가
#   → FastAPI CORSMiddleware 동시 적용 시 헤더 중복 → 브라우저 거부
# Development: 로컬 FastAPI 직접 실행 시 CORSMiddleware 필요
if settings.ENV != "production":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

app.include_router(roadmap_router)
app.include_router(admin_router)


@app.get("/health")
async def health():
    """헬스체크 + Supabase 자동 정지 방지용 DB 핑.

    GitHub Actions 스케줄러가 5일마다 호출하여
    Supabase 7일 무활동 자동 정지를 방지.
    """
    db_ok = False
    if settings.supabase_ready:
        try:
            client = get_supabase_client()
            r = await client.get(
                sb_url("users"),
                params={"select": "id", "limit": "1"},
                headers=sb_headers(),
            )
            db_ok = r.status_code == 200
        except Exception:
            db_ok = False
    return {"status": "ok", "db": "ok" if db_ok else "skip"}


# AWS Lambda 핸들러
# lifespan="on": startup/shutdown 훅 실행
# api_gateway_base_path: Lambda Function URL은 경로 prefix 없음
handler = Mangum(app, lifespan="on", api_gateway_base_path=None)
# x86_64 build - Sat Mar 28 2026 (pure-asgi, BUFFERED, LambdaURL CORS, max_tokens=8000)
