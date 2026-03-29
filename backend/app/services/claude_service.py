"""
Claude API 호출 서비스.

- stream_teaser        : Haiku → SSE 텍스트 스트리밍
- stream_full          : Sonnet → SSE JSON 청크 스트리밍 (≤6개월 단일 호출)
- stream_full_multicall: Sonnet → 6개월씩 분할 호출 후 병합 스트리밍 (>6개월)
- call_reroute         : Sonnet → 단일 JSON 응답 (GPS 재탐색)
"""
import asyncio
import json
import re
from typing import AsyncGenerator

import anthropic

from app.core.config import settings

# Anthropic 공식 모델명 (https://docs.anthropic.com/models)
HAIKU  = "claude-haiku-4-5"    # 티저용 (빠르고 저렴)
SONNET = "claude-sonnet-4-6"   # 전체 로드맵 + 재탐색

# CloudFront idle-connection timeout = 60s → 55초마다 keepalive 전송
_KEEPALIVE_INTERVAL = 55

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(
            api_key=settings.ANTHROPIC_API_KEY,
            # 스트리밍은 오래 걸릴 수 있으므로 여유있게 설정
            timeout=120.0,
        )
    return _client


async def stream_teaser(system: str, user: str) -> AsyncGenerator[str, None]:
    """Haiku로 티저 텍스트를 SSE data 형식으로 스트리밍."""
    import logging
    _logger = logging.getLogger(__name__)
    client = _get_client()
    try:
        async with client.messages.stream(
            model=HAIKU,
            max_tokens=800,
            system=system,
            messages=[{"role": "user", "content": user}],
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'type': 'text', 'chunk': text})}\n\n"
    except Exception as e:
        _logger.error("stream_teaser 오류: %s", e, exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'message': 'AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'})}\n\n"
    yield "data: [DONE]\n\n"


async def stream_full(system: str, user: str) -> AsyncGenerator[str, None]:
    """Sonnet으로 전체 로드맵 JSON을 SSE data 형식으로 스트리밍.

    클라이언트는 청크를 버퍼링하다가 [DONE] 수신 시 JSON.parse 수행.

    Lambda Function URL 직접 접근 (CloudFront 우회) → 60초 timeout 제한 없음.
    Lambda 자체 timeout = 900초.

    max_tokens=8192:
    - CF 우회로 시간 제한 없음
    - claude-sonnet-4-6 최대 출력 8192 토큰 → 1년 이상 로드맵도 완전 생성
    - max_tokens 도달 시 [DONE] 대신 error 이벤트 전송 (불완전 JSON 파싱 방지)
    """
    import time

    import logging
    _logger = logging.getLogger(__name__)
    client = _get_client()
    last_chunk_time = time.monotonic()
    stop_reason: str | None = None

    try:
        async with client.messages.stream(
            model=SONNET,
            max_tokens=8192,
            system=system,
            messages=[{"role": "user", "content": user}],
        ) as stream:
            # text_stream 대신 raw 이벤트 순회 → stop_reason 직접 캡처
            async for event in stream:
                if event.type == "content_block_delta":
                    text = getattr(event.delta, "text", None)
                    if text:
                        now = time.monotonic()
                        if now - last_chunk_time > _KEEPALIVE_INTERVAL:
                            yield ": keepalive\n\n"
                        last_chunk_time = now
                        yield f"data: {json.dumps({'type': 'chunk', 'chunk': text})}\n\n"
                elif event.type == "message_delta":
                    stop_reason = getattr(event.delta, "stop_reason", None)
    except Exception as e:
        _logger.error("stream_full 오류: %s", e, exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'message': '로드맵 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'})}\n\n"
        return

    # max_tokens 도달 시 JSON이 잘린 채 종료 → 파싱 불가이므로 에러 처리
    if stop_reason == "max_tokens":
        _logger.warning("stream_full max_tokens 도달 (stop_reason=%s) — JSON 불완전 종료", stop_reason)
        yield f"data: {json.dumps({'type': 'error', 'message': '로드맵이 너무 길어 생성이 중단됐습니다. 목표 기간을 줄이거나 다시 시도해 주세요.'})}\n\n"
        return

    yield "data: [DONE]\n\n"


_MULTICALL_CHUNK = 6  # 한 번에 생성할 최대 개월 수


async def _fetch_chunk(client, system: str, user_msg: str) -> tuple[str, str | None]:
    """단일 청크를 수집 후 (raw_text, stop_reason) 반환 — 병렬 호출용.

    try/except 없음: 예외는 asyncio.Task로 래핑되어 호출부(stream_full_multicall)의
    task.result()에서 포착 → 거기서 SSE error 이벤트로 변환.
    """
    raw = ""
    stop_reason = None
    async with client.messages.stream(
        model=SONNET,
        max_tokens=8192,
        system=system,
        messages=[{"role": "user", "content": user_msg}],
    ) as stream:
        async for event in stream:
            if event.type == "content_block_delta":
                text = getattr(event.delta, "text", None)
                if text:
                    raw += text
            elif event.type == "message_delta":
                stop_reason = getattr(event.delta, "stop_reason", None)
    return raw, stop_reason


async def stream_full_multicall(
    role: str,
    level: str,
    skills: list[str],
    certifications: list[str],
    company_type: str,
    daily_study_hours: str,
    total_months: int,
) -> AsyncGenerator[str, None]:
    """6개월씩 병렬 분할 호출 후 JSON을 병합해 SSE 스트리밍.

    max_tokens 한도 초과 문제를 해결하기 위해 7개월 이상 로드맵에 사용.
    모든 청크를 asyncio.create_task로 동시 실행 → 순차 대비 ~N배 속도 향상.

    ⚠️  Lambda 배포 전제조건:
        asyncio.create_task()는 현재 이벤트 루프에서 태스크를 스케줄링한다.
        Mangum BUFFERED 모드에서는 각 Lambda 호출이 asyncio.run()으로 단일 루프를
        생성·종료하므로, 이 함수가 완전히 소비되기 전에 루프가 닫히지 않는다 → 안전.
        RESPONSE_STREAM 모드로 전환 시 이벤트 루프 생명주기가 달라질 수 있으니
        반드시 재검증 후 전환할 것.
    """
    import logging
    import time as _time
    from app.prompts.builder import build_full_prompt_partial

    _logger = logging.getLogger(__name__)
    client = _get_client()

    # 6개월씩 청크 분할: [(1,6), (7,12), (13,18)]
    chunks = []
    start = 1
    while start <= total_months:
        end = min(start + _MULTICALL_CHUNK - 1, total_months)
        chunks.append((start, end))
        start = end + 1
    total_chunks = len(chunks)

    # 모든 청크 프롬프트 빌드 후 태스크 동시 시작
    prompt_pairs = [
        build_full_prompt_partial(
            role, level, skills, certifications,
            company_type, daily_study_hours,
            month_start, month_end, total_months,
        )
        for month_start, month_end in chunks
    ]

    tasks = [
        asyncio.create_task(_fetch_chunk(client, system, user_msg))
        for system, user_msg in prompt_pairs
    ]

    # 태스크 완료 시점마다 progress event 전송 + keepalive 유지
    # (태스크 생성 직후 일괄 전송하면 progress가 실제 진행률을 반영하지 못함)
    notified: set[int] = set()
    last_keepalive = _time.monotonic()

    while not all(t.done() for t in tasks):
        await asyncio.sleep(1)
        # 새로 완료된 태스크에 대해 progress event 발행
        for i, t in enumerate(tasks):
            if t.done() and i not in notified:
                notified.add(i)
                yield f"data: {json.dumps({'type': 'progress', 'step': len(notified), 'total': total_chunks})}\n\n"
        now = _time.monotonic()
        if now - last_keepalive > _KEEPALIVE_INTERVAL:
            yield ": keepalive\n\n"
            last_keepalive = now

    # 루프 종료 후 마지막 sleep 사이에 완료된 태스크 처리
    for i, t in enumerate(tasks):
        if i not in notified:
            notified.add(i)
            yield f"data: {json.dumps({'type': 'progress', 'step': len(notified), 'total': total_chunks})}\n\n"

    # 순서대로 결과 수집 및 파싱
    all_months: list[dict] = []
    base_structure: dict | None = None

    for idx, task in enumerate(tasks):
        try:
            raw, stop_reason = task.result()
        except Exception as e:
            _logger.error(
                "stream_full_multicall 청크 %d/%d 오류: %s", idx + 1, total_chunks, e, exc_info=True
            )
            yield f"data: {json.dumps({'type': 'error', 'message': '로드맵 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'})}\n\n"
            # 나머지 태스크 취소
            for t in tasks:
                t.cancel()
            return

        if stop_reason == "max_tokens":
            _logger.warning("stream_full_multicall 청크 %d/%d max_tokens 도달", idx + 1, total_chunks)
            yield f"data: {json.dumps({'type': 'error', 'message': '로드맵이 너무 길어 생성이 중단됐습니다. 목표 기간을 줄이거나 다시 시도해 주세요.'})}\n\n"
            for t in tasks:
                t.cancel()
            return

        cleaned = re.sub(r"```(?:json)?\s*", "", raw).replace("```", "").strip()
        json_start = cleaned.find("{")
        json_end = cleaned.rfind("}") + 1
        if json_start == -1 or json_end == 0:
            _logger.error(
                "stream_full_multicall 청크 %d/%d JSON 없음: %s",
                idx + 1, total_chunks, cleaned[:200],
            )
            yield f"data: {json.dumps({'type': 'error', 'message': '로드맵 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'})}\n\n"
            return

        try:
            data = json.loads(cleaned[json_start:json_end])
        except json.JSONDecodeError as e:
            _logger.error(
                "stream_full_multicall 청크 %d/%d 파싱 실패: %s", idx + 1, total_chunks, e
            )
            yield f"data: {json.dumps({'type': 'error', 'message': '로드맵 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'})}\n\n"
            return

        if base_structure is None:
            base_structure = {
                "summary":          data.get("summary", ""),
                "persona_title":    data.get("persona_title", ""),
                "persona_subtitle": data.get("persona_subtitle", ""),
            }

        all_months.extend(data.get("months", []))

    # 병합 후 JSON 스트리밍
    merged = {**(base_structure or {}), "months": all_months}
    merged_json = json.dumps(merged, ensure_ascii=False)

    chunk_size = 200
    for i in range(0, len(merged_json), chunk_size):
        yield f"data: {json.dumps({'type': 'chunk', 'chunk': merged_json[i:i + chunk_size]})}\n\n"

    yield "data: [DONE]\n\n"


async def call_reroute(system: str, user: str) -> str:
    """Sonnet 단일 호출로 재탐색 JSON 문자열 반환."""
    client = _get_client()
    response = await client.messages.create(
        model=SONNET,
        max_tokens=8192,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return response.content[0].text


async def call_haiku(system: str, user: str) -> str:
    """Haiku 단일 호출로 빠른 JSON 문자열 반환 (커리어 분석용)."""
    client = _get_client()
    response = await client.messages.create(
        model=HAIKU,
        max_tokens=1500,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return response.content[0].text
