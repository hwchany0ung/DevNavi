"""
/ai/qa 라우터 — 태스크별 AI Q&A SSE 스트리밍.

엔드포인트:
  POST /ai/qa — 인증 필수, slowapi 10/hour rate limit
"""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.core.constants import SSE_HEADERS
from app.core.limiter import limiter
from app.middleware.auth import optional_user, require_user
from app.models.qa_models import EventRequest, FeedbackRequest, QARequest
from app.services.analytics_service import log_event
from app.services.feedback_service import save_feedback
from app.services.qa_service import (
    increment_and_check_qa_usage,
    stream_qa_response,
    verify_task_ownership,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai-qa"])


async def _qa_stream(body: QARequest, user_id: str):
    """소유권 검증 → 사용량 체크 → SSE 스트리밍."""
    # Layer 3: task_id 소유권 검증 (roadmap_id 제공 시 해당 로드맵으로 한정)
    owned = await verify_task_ownership(user_id, body.task_id, body.roadmap_id)
    if not owned:
        yield f"data: {json.dumps({'type': 'error', 'code': 'ownership', 'message': '접근 권한이 없습니다.'})}\n\n"
        return

    # Layer 2: 사용량 체크 (daily 30, monthly 100)
    try:
        usage = await increment_and_check_qa_usage(user_id)
    except (RuntimeError, HTTPException) as e:
        logger.error("QA usage check 실패 (user=%s): %s", user_id, e)
        yield f"data: {json.dumps({'type': 'error', 'code': 'server_error', 'message': '사용량 확인 서비스에 일시적 문제가 있습니다. 잠시 후 다시 시도해 주세요.'}, ensure_ascii=False)}\n\n"
        return

    if not usage.get("allowed", True):
        daily = usage.get("daily_count", 0)
        monthly = usage.get("monthly_count", 0)
        daily_limit = usage.get("daily_limit", 30)
        monthly_limit = usage.get("monthly_limit", 100)

        msg = (
            f"현재 정식 배포 전 베타 운영 중으로 AI 질문은 하루 {daily_limit}회로 제한됩니다. "
            "내일 다시 이용해 주세요."
        )

        yield f"data: {json.dumps({'type': 'error', 'code': 'rate_limit', 'message': msg})}\n\n"
        return

    # Layer 5: Haiku 스트리밍 (max_tokens=120) + 팔로업 질문 생성
    async for chunk in stream_qa_response(body, user_id, roadmap_id=body.roadmap_id):
        yield chunk


@router.post("/qa")
@limiter.limit("10/hour")
async def ask_qa(
    request: Request,
    body: QARequest,
    user: dict = Depends(require_user),
):
    """태스크별 AI Q&A SSE 스트리밍 (로그인 필수).

    - 401: 미인증
    - 422: 입력 검증 실패 (question 200자 초과 등)
    - 429: slowapi rate limit 초과 (10/hour per IP)
    - 200 + SSE: 정상 스트리밍 (소유권/사용량 초과는 SSE error event로 전달)
    """
    return StreamingResponse(_qa_stream(body, user["id"]), headers=SSE_HEADERS)


@router.get("/qa/history")
@limiter.limit("30/minute")
async def get_qa_history(
    request: Request,
    roadmap_id: str | None = None,
    task_id: str | None = None,
    limit: int = 20,
    user: dict = Depends(require_user),
):
    """Q&A 이력 조회 (최신순). roadmap_id 또는 task_id로 필터 가능."""
    from app.core.supabase_client import get_supabase_client, sb_headers, sb_url
    from app.core.config import settings
    if not settings.supabase_ready:
        return {"history": []}

    client = get_supabase_client()
    params = {
        "user_id": f"eq.{user['id']}",
        "select": "id,task_id,roadmap_id,question,answer,created_at",
        "order": "created_at.desc",
        "limit": str(min(limit, 50)),
    }
    if roadmap_id:
        params["roadmap_id"] = f"eq.{roadmap_id}"
    if task_id:
        params["task_id"] = f"eq.{task_id}"

    resp = await client.get(sb_url("qa_history"), headers=sb_headers(), params=params)
    if resp.status_code != 200:
        return {"history": []}
    return {"history": resp.json()}


@router.post("/qa/feedback")
@limiter.limit("30/hour")
async def submit_feedback(
    request: Request,
    body: FeedbackRequest,
    user: dict = Depends(require_user),
):
    """Q&A 답변 피드백 저장 (로그인 필수).

    - 401: 미인증
    - 422: 입력 검증 실패
    - 429: rate limit 초과
    """
    saved = await save_feedback(
        user_id=user["id"],
        task_id=body.task_id,
        question=body.question,
        answer=body.answer,
        rating=body.rating,
    )
    return {"saved": saved}


@router.post("/qa/event")
@limiter.limit("60/hour")
async def log_qa_event(
    request: Request,
    body: EventRequest,
    user: dict | None = Depends(optional_user),
):
    """Q&A 이벤트 로깅 (비로그인 허용 — fire-and-forget).

    - 422: event_type 유효하지 않음
    - 429: rate limit 초과
    - 200: 항상 반환 (DB 실패 시에도)
    """
    user_id = user["id"] if user else None
    logged = await log_event(
        event_type=body.event_type,
        task_id=body.task_id,
        user_id=user_id,
        metadata=body.metadata,
    )
    return {"logged": logged}
