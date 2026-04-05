"""
QA 서비스 — 사용량 체크, 소유권 검증, Haiku 스트리밍, 이력 저장.
"""
import asyncio
import json
import logging
import unicodedata
from typing import AsyncGenerator, Optional

import anthropic

from fastapi import HTTPException

from app.core.config import settings
from app.core.supabase_client import get_supabase_client, sb_headers, sb_url
from app.models.qa_models import QARequest, QATaskContext
from app.services.claude_service import HAIKU as _QA_MODEL, _get_client

logger = logging.getLogger(__name__)

_pending_tasks: set = set()

_MAX_TOKENS = 120  # 1~2문장 안전망
_FOLLOWUP_MAX_TOKENS = 200

_SYSTEM_PROMPT_TEMPLATE = """DevNavi 코치. {job_type} 취업 준비생의 태스크 질문에 답합니다.
현재: {month}개월차 {week}주차 | 카테고리: {category} | 태스크: {task_name}

[답변 형식 — {job_type} 맥락 기준]
- 1~2문장으로만 답할 것. 이보다 길면 안 됨.
- 마크다운 헤더(## ###) 사용 금지
- 불릿 목록 사용 금지
- 예시 코드 사용 금지
- 마무리 질문·격려 문장 금지
"""

_FOLLOWUP_SYSTEM = (
    "당신은 취업 준비 코치입니다. 다음 질문과 답변을 읽고, "
    "{job_type} 취업 준비생이 자연스럽게 이어서 물어볼 법한 궁금증 3개를 "
    'JSON 배열로만 출력하세요. 형식: ["질문1", "질문2", "질문3"]. '
    "각 질문은 8자 이상 20자 이내 한국어. 다른 텍스트 없이 JSON 배열만."
)

def _sanitize_prompt_input(value: str) -> str:
    """프롬프트 인젝션 방어: 중괄호·제어 문자(Cc/Cf)·개행 제거."""
    s = str(value).replace("{", "").replace("}", "")
    # 유니코드 제어 문자(Cc: 제어문자, Cf: 형식문자) 및 개행 제거
    s = "".join(ch for ch in s if unicodedata.category(ch) not in ("Cc", "Cf"))
    return s.strip()


def build_system_prompt(task_context: QATaskContext) -> str:
    """태스크 컨텍스트를 시스템 프롬프트에 주입.

    사용자 입력값은 sanitize하여 프롬프트 인젝션을 방어한다.
    """
    return _SYSTEM_PROMPT_TEMPLATE.format(
        job_type=_sanitize_prompt_input(task_context.job_type),
        month=task_context.month,
        week=task_context.week,
        category=_sanitize_prompt_input(task_context.category),
        task_name=_sanitize_prompt_input(task_context.task_name),
    )


async def increment_and_check_qa_usage(user_id: str) -> dict:
    """Supabase RPC로 사용량 증가 + 한도 확인.

    Returns dict with 'allowed' key (True/False).
    Raises RuntimeError if Supabase not configured.
    """
    if not settings.supabase_ready:
        raise RuntimeError("Supabase 미설정")

    client = get_supabase_client()
    resp = await client.post(
        f"{settings.SUPABASE_URL}/rest/v1/rpc/increment_and_check_qa_usage",
        headers=sb_headers(prefer="return=representation"),
        json={
            "p_user_id":       user_id,
            "p_daily_limit":   30,
            "p_monthly_limit": 100,
        },
    )

    if resp.status_code not in (200, 201):
        logger.error(
            "increment_and_check_qa_usage RPC 실패 (user=%s, status=%d): %s",
            user_id, resp.status_code, resp.text[:200],
        )
        # RPC 실패 시 차단 (비용 보호 우선 — usage_service.py와 동일 정책)
        raise HTTPException(
            status_code=503,
            detail={
                "code": "QA_USAGE_SERVICE_UNAVAILABLE",
                "message": "사용량 확인 서비스에 일시적 문제가 있습니다. 잠시 후 다시 시도해 주세요.",
            },
        )

    return resp.json()


async def verify_task_ownership(
    user_id: str, task_id: str, roadmap_id: Optional[str] = None
) -> bool:
    """사용자의 활성 로드맵에 해당 task_id가 존재하는지 검증.

    task_id 형식: "{month}-{week}-{task_index}"
    user의 active roadmap JSON에서 해당 월/주 태스크 존재 여부 확인.

    Args:
        user_id:    JWT에서 추출한 사용자 UUID
        task_id:    "{month}-{week}-{task_index}" 형식 태스크 위치 ID
        roadmap_id: 특정 로드맵 UUID (제공 시 해당 로드맵에서만 검증, 미제공 시 최신 active 로드맵 사용)
    """
    if not settings.supabase_ready:
        return True  # dev 환경: Supabase 미설정 시 접근 허용

    try:
        month_str, week_str, idx_str = task_id.split("-")
        month = int(month_str)
        week = int(week_str)
        task_index = int(idx_str)
    except (ValueError, AttributeError):
        return False

    client = get_supabase_client()

    if roadmap_id:
        # 특정 roadmap UUID로 조회 — user_id와 id 모두 검증하여 타인 로드맵 접근 차단
        params = {
            "id":      f"eq.{roadmap_id}",
            "user_id": f"eq.{user_id}",
            "select":  "data",
            "limit":   "1",
        }
    else:
        # 기존 동작: 사용자의 최신 활성 로드맵 사용 (하위 호환)
        params = {
            "user_id": f"eq.{user_id}",
            "status":  "eq.active",
            "select":  "data",
            "limit":   "1",
        }

    resp = await client.get(
        sb_url("roadmaps"),
        headers=sb_headers(),
        params=params,
    )

    if resp.status_code != 200:
        logger.warning(
            "verify_task_ownership 조회 실패 (user=%s, roadmap_id=%s, status=%d)",
            user_id, roadmap_id, resp.status_code,
        )
        return False

    rows = resp.json()
    if not rows:
        return False

    roadmap_data = rows[0].get("data", {})

    # roadmap_data 구조: {"months": [{"month": 1, "weeks": [{"week": 1, "tasks": [...]}]}]}
    months = roadmap_data.get("months", [])
    for m in months:
        if m.get("month") != month:
            continue
        for w in m.get("weeks", []):
            if w.get("week") != week:
                continue
            tasks = w.get("tasks", [])
            if 0 <= task_index < len(tasks):
                return True

    return False


async def save_qa_history(
    user_id: str,
    roadmap_id: Optional[str],
    task_id: str,
    question: str,
    answer: str,
) -> None:
    """Q&A 이력을 DB에 fire-and-forget으로 저장."""
    if not settings.supabase_ready:
        return
    try:
        client = get_supabase_client()
        await client.post(
            sb_url("qa_history"),
            headers=sb_headers(),
            json={
                "user_id":    user_id,
                "roadmap_id": roadmap_id,
                "task_id":    task_id,
                "question":   question,
                "answer":     answer,
            },
        )
    except Exception as e:
        logger.warning("qa_history 저장 실패: %s", e)


async def generate_followup_questions(
    question: str,
    answer: str,
    task_context: QATaskContext,
) -> list[str]:
    """메인 답변 기반 팔로업 질문 3개 생성 (비스트리밍)."""
    client = _get_client()
    try:
        resp = await client.messages.create(
            model=_QA_MODEL,
            max_tokens=_FOLLOWUP_MAX_TOKENS,
            system=_FOLLOWUP_SYSTEM.format(job_type=_sanitize_prompt_input(task_context.job_type)),
            messages=[{
                "role": "user",
                "content": f"질문: {question}\n답변: {answer}",
            }],
        )
        raw = resp.content[0].text.strip()
        data = json.loads(raw)
        if not isinstance(data, list):
            return []
        return [q for q in data if isinstance(q, str)][:3]
    except Exception as e:
        logger.warning("generate_followup_questions 실패: %s", e)
        return []


_ALLOWED_ROLES = {"user", "assistant"}


async def stream_qa_response(
    request: QARequest,
    user_id: str,
    roadmap_id: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Haiku를 SSE 스트리밍으로 호출하여 QA 응답 생성."""
    # 대화 이력 role 검증 — "user"/"assistant"만 허용
    for msg in request.messages:
        if msg.role not in _ALLOWED_ROLES:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_MESSAGE_ROLE",
                    "message": f"허용되지 않는 메시지 role입니다: {msg.role}",
                },
            )

    system_prompt = build_system_prompt(request.task_context)

    # 대화 이력 + 현재 질문 구성
    conversation: list[dict] = [
        {"role": msg.role, "content": msg.content}
        for msg in request.messages
    ]
    conversation.append({"role": "user", "content": request.question})

    client = _get_client()
    full_answer: list[str] = []
    try:
        async with client.messages.stream(
            model=_QA_MODEL,
            max_tokens=_MAX_TOKENS,
            system=system_prompt,
            messages=conversation,
        ) as stream:
            async for text in stream.text_stream:
                full_answer.append(text)
                yield f"data: {json.dumps({'chunk': text}, ensure_ascii=False)}\n\n"
    except anthropic.RateLimitError:
        logger.warning("Anthropic rate limit (user=%s)", user_id)
        yield f"data: {json.dumps({'type': 'error', 'code': 'api_limit', 'message': 'AI 서비스가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.'})}\n\n"
        return
    except Exception as e:
        logger.error("stream_qa_response 오류 (user=%s): %s", user_id, e, exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'code': 'server_error', 'message': 'AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'})}\n\n"
        return

    # 이력 저장 (fire-and-forget — 실패해도 스트리밍 영향 없음)
    if full_answer:
        _task = asyncio.create_task(save_qa_history(
            user_id=user_id,
            roadmap_id=roadmap_id,
            task_id=request.task_id,
            question=request.question,
            answer="".join(full_answer),
        ))
        _pending_tasks.add(_task)
        _task.add_done_callback(_pending_tasks.discard)

    # 팔로업 질문 생성 (실패 시 조용히 건너뜀)
    followups = await generate_followup_questions(
        request.question, "".join(full_answer), request.task_context,
    )
    if followups:
        yield f"data: {json.dumps({'followups': followups}, ensure_ascii=False)}\n\n"

    yield "data: [DONE]\n\n"
