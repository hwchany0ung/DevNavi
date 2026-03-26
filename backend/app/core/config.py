from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENV: str = "development"

    # ── Claude API (필수) ──────────────────────────────────────────
    ANTHROPIC_API_KEY: str

    # ── Supabase (없으면 인증/DB 기능 비활성) ─────────────────────
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_KEY: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None

    # ── 토스페이먼츠 (없으면 결제 기능 비활성) ────────────────────
    TOSS_SECRET_KEY: Optional[str] = None
    TOSS_WEBHOOK_SECRET: Optional[str] = None

    # ── CORS ──────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # ── 무료 사용자 일일 생성 한도 ───────────────────────────────
    FREE_DAILY_LIMIT: int = 3

    @property
    def supabase_ready(self) -> bool:
        return bool(self.SUPABASE_URL and self.SUPABASE_SERVICE_KEY)

    @property
    def toss_ready(self) -> bool:
        return bool(self.TOSS_SECRET_KEY)

    class Config:
        env_file = ".env"


settings = Settings()
