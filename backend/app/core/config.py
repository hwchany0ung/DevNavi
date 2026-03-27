"""
환경 설정 모듈.

로컬: .env 파일에서 로드
Lambda (production): AWS SSM Parameter Store에서 로드
  → /devnavi/prod/ANTHROPIC_API_KEY 등
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings


def _load_ssm_params() -> None:
    """
    Lambda 환경(production)에서 SSM Parameter Store 값을 os.environ에 주입.
    boto3가 없거나 SSM 접근 실패 시 조용히 무시 (로컬 .env로 폴백).
    """
    if os.getenv("ENV") != "production":
        return
    try:
        import boto3  # Lambda 런타임에 기본 포함
        ssm = boto3.client("ssm", region_name="ap-northeast-2")
        prefix = "/devnavi/prod/"
        param_names = [
            f"{prefix}ANTHROPIC_API_KEY",
            f"{prefix}SUPABASE_URL",
            f"{prefix}SUPABASE_SERVICE_KEY",
            f"{prefix}SUPABASE_ANON_KEY",
            f"{prefix}SUPABASE_JWT_SECRET",
            f"{prefix}CORS_ORIGINS",
            f"{prefix}FREE_DAILY_LIMIT",
        ]
        response = ssm.get_parameters(Names=param_names, WithDecryption=True)
        for param in response["Parameters"]:
            key = param["Name"].replace(prefix, "")
            os.environ.setdefault(key, param["Value"])
    except Exception:
        pass  # 로컬/테스트 환경에서는 무시


# 모듈 임포트 시 1회 실행 (Lambda 컨테이너 재사용으로 이후 호출은 스킵됨)
_load_ssm_params()


class Settings(BaseSettings):
    ENV: str = "development"

    # ── Claude API (필수) ──────────────────────────────────────────
    ANTHROPIC_API_KEY: str

    # ── Supabase (없으면 인증/DB 기능 비활성) ─────────────────────
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_KEY: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
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
