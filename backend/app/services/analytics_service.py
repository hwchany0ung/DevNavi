"""
Q&A 이벤트 로깅 서비스 — fire-and-forget.
Design Ref: §6.2 — analytics_service: 실패 시 False 반환, 예외 전파 없음
Plan SC: SC-01(qa_opened), SC-02(task_checked)
"""
import logging
from typing import Optional

from app.core.config import settings
from app.core.supabase_client import get_supabase_client, sb_headers, sb_url

logger = logging.getLogger(__name__)


async def log_event(
    event_type: str,
    task_id: Optional[str],
    user_id: Optional[str],
    metadata: dict,
) -> bool:
    """
    qa_events 테이블에 INSERT.
    비로그인 시 user_id = None.
    실패 시 False 반환 (예외 전파 없음 — fire-and-forget).
    """
    if not settings.supabase_ready:
        return False
    try:
        client = get_supabase_client()
        row: dict = {
            "event_type": event_type,
            "metadata": metadata,
        }
        if task_id is not None:
            row["task_id"] = task_id
        if user_id is not None:
            row["user_id"] = user_id
        resp = await client.post(
            sb_url("qa_events"),
            json=row,
            headers=sb_headers(prefer="return=minimal"),
        )
        if resp.status_code >= 400:
            logger.warning("log_event HTTP 오류 (type=%s, user=%s, status=%d): %s", event_type, user_id, resp.status_code, resp.text[:200])
            return False
        return True
    except Exception as e:
        logger.warning("log_event 실패 (type=%s, user=%s): %s", event_type, user_id, e)
        return False
