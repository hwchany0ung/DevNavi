"""
QA 서비스 — 사용량 체크, 소유권 검증, Haiku 스트리밍.
"""
import json
import logging
from typing import AsyncGenerator

import anthropic

from app.core.config import settings
from app.core.supabase_client import get_supabase_client, sb_headers, sb_url
from app.models.qa_models import QARequest, QATaskContext

logger = logging.getLogger(__name__)

_QA_MODEL = "claude-haiku-4-5-20251001"
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

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(
            api_key=settings.ANTHROPIC_API_KEY,
            timeout=60.0,
        )
    return _client


def build_system_prompt(task_context: QATaskContext) -> str:
    """태스크 컨텍스트를 시스템 프롬프트에 주입."""
    return _SYSTEM_PROMPT_TEMPLATE.format(
        job_type=task_context.job_type,
        month=task_context.month,
        week=task_context.week,
        category=task_context.category,
        task_name=task_context.task_name,
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
        # RPC 실패 시 허용 (서비스 가용성 우선)
        return {"allowed": True, "daily_count": 0, "monthly_count": 0}

    return resp.json()


async def verify_task_ownership(user_id: str, task_id: str) -> bool:
    """사용자의 활성 로드맵에 해당 task_id가 존재하는지 검증.

    task_id 형식: "{month}-{week}-{task_index}"
    user의 active roadmap JSON에서 해당 월/주 태스크 존재 여부 확인.
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
    resp = await client.get(
        sb_url("roadmaps"),
        headers=sb_headers(),
        params={
            "user_id": f"eq.{user_id}",
            "status":  "eq.active",
            "select":  "data",
            "limit":   "1",
        },
    )

    if resp.status_code != 200:
        logger.warning(
            "verify_task_ownership 조회 실패 (user=%s, status=%d)",
            user_id, resp.status_code,
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
            system=_FOLLOWUP_SYSTEM.format(job_type=task_context.job_type),
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


async def stream_qa_response(request: QARequest, user_id: str) -> AsyncGenerator[str, None]:
    """Haiku를 SSE 스트리밍으로 호출하여 QA 응답 생성."""
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

    # 팔로업 질문 생성 (실패 시 조용히 건너뜀)
    followups = await generate_followup_questions(
        request.question, "".join(full_answer), request.task_context,
    )
    if followups:
        yield f"data: {json.dumps({'followups': followups}, ensure_ascii=False)}\n\n"

    yield "data: [DONE]\n\n"
