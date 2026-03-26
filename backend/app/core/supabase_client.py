"""
Supabase httpx 클라이언트 공유 모듈.

- 싱글턴 AsyncClient (연결 풀 재사용 — 매 요청마다 TCP 핸드셰이크 방지)
- 공통 헤더 / URL 생성 헬퍼 (roadmap_service + auth 중복 제거)
"""
import httpx
from app.core.config import settings

_client: httpx.AsyncClient | None = None


def get_supabase_client() -> httpx.AsyncClient:
    """싱글턴 httpx 클라이언트 반환."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(30.0))
    return _client


async def close_supabase_client() -> None:
    """앱 종료 시 클라이언트 닫기 (lifespan shutdown 훅에서 호출)."""
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


def sb_headers(*, prefer: str = "return=representation") -> dict:
    """Supabase REST API 공통 헤더 (Service-role key, RLS 우회)."""
    return {
        "apikey":        settings.SUPABASE_SERVICE_KEY or "",
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY or ''}",
        "Content-Type":  "application/json",
        "Prefer":        prefer,
    }


def sb_url(table: str) -> str:
    """Supabase REST 엔드포인트 URL 생성."""
    return f"{settings.SUPABASE_URL}/rest/v1/{table}"
