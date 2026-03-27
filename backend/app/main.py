from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.limiter import limiter
from app.core.supabase_client import close_supabase_client
from app.api.roadmap import router as roadmap_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 라이프사이클 훅."""
    # startup: lazy-initialized 클라이언트들은 첫 요청 시 자동 생성
    yield
    # shutdown: Supabase httpx 클라이언트 정상 종료
    await close_supabase_client()


app = FastAPI(
    title="DevNavi API",
    version="0.1.0",
    docs_url="/docs" if settings.ENV == "development" else None,
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
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── CloudFront 시크릿 헤더 검증 미들웨어 ─────────────────────────────
# Lambda Function URL이 공개 접근 가능하므로, CloudFront를 통한 요청인지 확인.
# CLOUDFRONT_SECRET 환경변수가 설정된 경우에만 활성화.
_CF_SECRET = settings.CLOUDFRONT_SECRET if hasattr(settings, "CLOUDFRONT_SECRET") else None

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


app.include_router(roadmap_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# AWS Lambda 핸들러
# lifespan="on": startup/shutdown 훅 실행
# api_gateway_base_path: Lambda Function URL은 경로 prefix 없음
handler = Mangum(app, lifespan="on", api_gateway_base_path=None)
# x86_64 build - Fri Mar 27 13:12:55     2026
