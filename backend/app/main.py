import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

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

# ── CORS ─────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # 실제 사용하는 메서드만 허용
    allow_headers=["*"],
)

# ── CloudFront 시크릿 헤더 검증 미들웨어 ─────────────────────────────
# Lambda Function URL이 공개 접근 가능하므로, CloudFront를 통한 요청인지 확인.
# CLOUDFRONT_SECRET 환경변수가 설정된 경우에만 활성화.
_CF_SECRET = settings.CLOUDFRONT_SECRET  # Optional[str] — None이면 검증 비활성화

@app.middleware("http")
async def verify_cloudfront_secret(request: Request, call_next):
    if _CF_SECRET and settings.ENV == "production":
        # health check는 제외 (ALB/Lambda 상태 확인용)
        if request.url.path != "/health":
            if request.headers.get("X-CF-Secret") != _CF_SECRET:
                return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    return await call_next(request)


# ── 보안 응답 헤더 미들웨어 ─────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


# ── 5xx 에러 자동 로깅 미들웨어 ──────────────────────────────────────────
# 발생한 서버 에러를 DB error_logs 테이블에 저장 (관리자 대시보드 표시용).
# 응답 지연 없이 fire-and-forget 방식으로 저장.
_LOG_SKIP_PATHS = {"/health"}

@app.middleware("http")
async def log_server_errors(request: Request, call_next):
    response = await call_next(request)
    if response.status_code >= 500 and request.url.path not in _LOG_SKIP_PATHS:
        asyncio.create_task(
            save_error_log(
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                error_msg=f"HTTP {response.status_code}",
            )
        )
    return response


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
# x86_64 build - Fri Mar 27 13:12:55     2026
