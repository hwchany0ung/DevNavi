from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
    title="CareerPath API",
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

app.include_router(roadmap_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# AWS Lambda 핸들러
handler = Mangum(app)
