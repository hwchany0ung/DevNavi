"""GitHub Actions 환경에서 os.environ으로 직접 읽는 스크립트 전용 설정."""
import os
from pathlib import Path

# 로컬 실행 시 backend/.env 자동 로드
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_path, override=False)
    except ImportError:
        pass  # python-dotenv 없으면 스킵 (GitHub Actions는 os.environ으로 직접 주입)


def require(key: str) -> str:
    v = os.environ.get(key)
    if not v:
        raise RuntimeError(f"환경변수 {key}가 설정되지 않았습니다.")
    return v


def optional(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


SUPABASE_URL         = require("SUPABASE_URL")
SUPABASE_SERVICE_KEY = require("SUPABASE_SERVICE_KEY")
ANTHROPIC_API_KEY    = require("ANTHROPIC_API_KEY")
WORKNET_API_KEY      = optional("WORKNET_API_KEY")
NOTIFY_EMAIL         = optional("NOTIFY_EMAIL")
SMTP_HOST            = optional("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT            = int(optional("SMTP_PORT", "587"))
SMTP_USER            = optional("SMTP_USER")
SMTP_PASSWORD        = optional("SMTP_PASSWORD")
