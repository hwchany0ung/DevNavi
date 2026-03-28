"""
Claude API 호출 서비스.

- stream_teaser : Haiku → SSE 텍스트 스트리밍
- stream_full   : Sonnet → SSE JSON 청크 스트리밍
- call_reroute  : Sonnet → 단일 JSON 응답 (GPS 재탐색)
"""
import json
from typing import AsyncGenerator

import anthropic

from app.core.config import settings

# Anthropic 공식 모델명 (https://docs.anthropic.com/models)
HAIKU  = "claude-haiku-4-5"    # 티저용 (빠르고 저렴)
SONNET = "claude-sonnet-4-5"   # 전체 로드맵 + 재탐색

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

    max_tokens=8000:
    - CF 우회로 시간 제한 없음
    - claude-sonnet-4-5 최대 출력 8192 토큰 → 1년 이상 로드맵도 완전 생성
    """
    import time

    import logging
    _logger = logging.getLogger(__name__)
    client = _get_client()
    last_chunk_time = time.monotonic()

    try:
        async with client.messages.stream(
            model=SONNET,
            max_tokens=8000,
            system=system,
            messages=[{"role": "user", "content": user}],
        ) as stream:
            async for text in stream.text_stream:
                now = time.monotonic()
                # 55초 이상 간격 발생 예방 keepalive (CloudFront 60초 제한)
                if now - last_chunk_time > 55:
                    yield ": keepalive\n\n"
                last_chunk_time = now
                yield f"data: {json.dumps({'type': 'chunk', 'chunk': text})}\n\n"
    except Exception as e:
        _logger.error("stream_full 오류: %s", e, exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'message': '로드맵 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'})}\n\n"
    yield "data: [DONE]\n\n"


async def call_reroute(system: str, user: str) -> str:
    """Sonnet 단일 호출로 재탐색 JSON 문자열 반환."""
    client = _get_client()
    response = await client.messages.create(
        model=SONNET,
        max_tokens=8000,
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
