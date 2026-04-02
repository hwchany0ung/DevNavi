"""
Supabase httpx 클라이언트 공유 모듈.

- 싱글턴 AsyncClient (연결 풀 재사용 — 매 요청마다 TCP 핸드셰이크 방지)
- 공통 헤더 / URL 생성 헬퍼 (roadmap_service + auth 중복 제거)

[Thread-safety 주의사항]
AWS Lambda는 단일 이벤트 루프에서 단일 요청을 처리하므로
동일 인스턴스 내에서는 thread-safe하다.
단, Lambda Concurrent Invocations(동시 실행)는 별도 컨테이너 인스턴스를
각각 생성하므로 싱글턴이 공유되지 않는다 — 인스턴스 간 상태 공유는 없음.
콜드 스타트 시 _client=None에서 초기화되며, 웜 인스턴스 재사용 시
기존 연결 풀을 그대로 활용한다.
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
    """앱 종료 시 클라이언트 닫기 (lifespan shutdown 훅에서 호출).

    try/finally로 aclose() 실패와 무관하게 _client=None 보장.
    종료 중 예외는 무시 — 이미 프로세스가 종료 중이므로 로그만으로 충분.
    """
    global _client
    if _client and not _client.is_closed:
        try:
            await _client.aclose()
        except Exception:
            pass  # 종료 중 에러는 무시
        finally:
            _client = None


def sb_headers(*, prefer: str = "return=representation") -> dict:
    """Supabase REST API 공통 헤더 (Service-role key, RLS 우회).

    supabase_ready 가드를 통과한 후에만 호출돼야 함.
    """
    key = settings.SUPABASE_SERVICE_KEY
    if not key:
        raise RuntimeError(
            "SUPABASE_SERVICE_KEY가 설정되지 않았습니다. "
            "sb_headers() 호출 전 settings.supabase_ready를 확인하세요."
        )
    return {
        "apikey":        key,
        "Authorization": f"Bearer {key}",
        "Content-Type":  "application/json",
        "Prefer":        prefer,
    }


def sb_url(table: str) -> str:
    """Supabase REST 엔드포인트 URL 생성.

    SUPABASE_URL이 설정되지 않은 상태에서 호출되면 즉시 RuntimeError.
    (각 서비스 함수의 supabase_ready 가드를 통과한 후에만 호출돼야 함)
    """
    if not settings.SUPABASE_URL:
        raise RuntimeError(
            "SUPABASE_URL이 설정되지 않았습니다. "
            "sb_url() 호출 전 settings.supabase_ready를 확인하세요."
        )
    return f"{settings.SUPABASE_URL}/rest/v1/{table}"
