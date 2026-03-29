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
    - 로컬/개발: .env 파일로 폴백
    - 프로덕션: SSM 로드 실패 시 앱 시작 중단 (시크릿 없이 실행 방지)
    """
    import logging
    _logger = logging.getLogger(__name__)

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
            f"{prefix}CLOUDFRONT_SECRET",
            f"{prefix}DEV_BYPASS_USERS",
        ]
        response = ssm.get_parameters(Names=param_names, WithDecryption=True)
        # 누락된 파라미터 경고 (InvalidParameters 배열)
        missing = response.get("InvalidParameters", [])
        if missing:
            _logger.warning("SSM 누락 파라미터: %s", missing)
        for param in response["Parameters"]:
            key = param["Name"].replace(prefix, "")
            os.environ[key] = param["Value"]  # SSM이 최우선 (기존 환경변수 덮어씀)
        _logger.info("SSM 파라미터 로드 완료 (%d개)", len(response["Parameters"]))
    except Exception as e:
        # 프로덕션에서 SSM 로드 실패 → 앱 시작 중단 (시크릿 없이 실행 방지)
        _logger.critical("SSM 파라미터 로드 실패: %s", e, exc_info=True)
        raise RuntimeError("프로덕션 시크릿 로드 실패. CloudWatch 로그를 확인하세요.") from e


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

    # ── CloudFront 직접 접근 차단 시크릿 ────────────────────────
    # CloudFront → Lambda 요청 시 X-CF-Secret 헤더에 이 값을 포함시켜야 함
    # 미설정 시 검증 비활성화 (로컬 개발 환경)
    CLOUDFRONT_SECRET: Optional[str] = None

    # ── 무료 사용자 일일 생성 한도 ───────────────────────────────
    FREE_DAILY_LIMIT: int = 3

    # ── 개발/테스트 계정 일일 한도 제외 (쉼표 구분 UUID 문자열) ──
    # 예: DEV_BYPASS_USERS=uuid1,uuid2
    DEV_BYPASS_USERS: str = ""

    @property
    def supabase_ready(self) -> bool:
        return bool(self.SUPABASE_URL and self.SUPABASE_SERVICE_KEY)

    @property
    def toss_ready(self) -> bool:
        return bool(self.TOSS_SECRET_KEY)

    model_config = {
        "env_file": ".env",
        "env_ignore_empty": True,  # 빈 환경변수는 무시하고 .env 파일 값 우선 사용
    }


settings = Settings()
