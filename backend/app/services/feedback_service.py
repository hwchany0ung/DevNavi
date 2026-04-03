"""
Q&A 피드백 저장 서비스.
Design Ref: §6.1 — feedback_service: upsert 기반 중복 방지
"""
import logging

from app.core.config import settings
from app.core.supabase_client import get_supabase_client, sb_headers, sb_url

logger = logging.getLogger(__name__)


async def save_feedback(
    user_id: str,
    task_id: str,
    question: str,
    answer: str,
    rating: str,
) -> bool:
    """
    qa_feedback 테이블에 upsert.
    (user_id, task_id, question) 중복 시 rating + updated_at UPDATE.
    실패 시 False 반환 (예외 전파 없음).
    """
    if not settings.supabase_ready:
        return False
    try:
        client = get_supabase_client()
        payload = {
            "user_id": user_id,
            "task_id": task_id,
            "question": question,
            "answer": answer,
            "rating": rating,
        }
        resp = await client.post(
            sb_url("qa_feedback"),
            json=payload,
            headers=sb_headers(prefer="resolution=merge-duplicates,return=minimal"),
        )
        if resp.status_code >= 400:
            logger.warning("save_feedback HTTP 오류 (user=%s, status=%d): %s", user_id, resp.status_code, resp.text[:200])
            return False
        return True
    except Exception as e:
        logger.warning("save_feedback 실패 (user=%s): %s", user_id, e)
        return False
