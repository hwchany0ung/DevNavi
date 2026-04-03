"""
보안 이벤트 저장 서비스.

Design Ref: security-monitoring-be.design.md §2
Plan SC: fire-and-forget으로 응답 지연 없이 security_events에 기록

save_error_log() 패턴과 동일:
  - 실패해도 예외 전파 안 함
  - return=minimal (응답 바디 불필요)
  - IP/path 길이 제한 (DB 과부하 방지)
"""
import logging
from typing import Optional

from app.core.config import settings
from app.core.supabase_client import get_supabase_client, sb_headers, sb_url

logger = logging.getLogger(__name__)


async def save_security_event(
    event_type: str,
    ip: str,
    path: str,
    method: str,
    status_code: int,
    user_id: Optional[str] = None,
) -> None:
    """security_events 테이블에 이벤트 저장. 실패해도 예외 전파하지 않음."""
    if not settings.supabase_ready:
        return
    try:
        client = get_supabase_client()
        payload = {
            "event_type":  event_type,
            "ip":          ip[:100],
            "path":        path[:500],
            "method":      method[:10],
            "status_code": status_code,
        }
        if user_id:
            payload["user_id"] = user_id
        await client.post(
            sb_url("security_events"),
            json=payload,
            headers=sb_headers(prefer="return=minimal"),
        )
    except Exception as e:
        # 보안 이벤트 저장 실패가 서비스에 영향 없어야 함
        logger.warning("[security] event 저장 실패: %s", e)
