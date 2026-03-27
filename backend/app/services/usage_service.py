"""
API 사용량 추적 및 일일 제한 서비스.

무료 사용자가 다수의 요청으로 Claude API 크레딧을 소진하는 것을 방지.
사용량은 Supabase api_usage 테이블에 (user_id, usage_date, endpoint) 기준으로 기록.

제한:
  - /roadmap/full          : 하루 3회 (Sonnet — 고비용)
  - /roadmap/career-summary: 하루 10회 (Haiku — 저비용)
  - /roadmap/reroute       : 하루 3회 (Sonnet — 고비용)

Phase 6 결제 연동 후 프리미엄 사용자는 check_and_increment 호출 전에
user["plan"] == "premium" 여부를 확인해 스킵하면 됨.
"""
import logging
from datetime import date

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.core.supabase_client import get_supabase_client, sb_headers, sb_url

logger = logging.getLogger(__name__)

# ── 엔드포인트별 일일 허용 횟수 ──────────────────────────────────────
DAILY_LIMITS: dict[str, int] = {
    "full":           2,   # Sonnet 전체 로드맵 (파라미터 캐시로 중복 방지 → 하루 2회로 축소)
    "career-summary": 10,  # Haiku 커리어 분석
    "reroute":        3,   # Sonnet GPS 재탐색
}


async def check_and_increment(user_id: str, endpoint: str) -> None:
    """일일 사용량 확인 후 카운터 증가. 초과 시 HTTPException(429).

    Args:
        user_id:  JWT에서 추출한 사용자 UUID
        endpoint: 'full' | 'career-summary' | 'reroute'

    동작 방식:
      1. 오늘 날짜 기준 사용량 조회
      2. limit 이상이면 429 응답
      3. 통과 시 count+1 upsert
      4. Supabase 장애 시 → 경고 로그 후 통과 (사용자 경험 우선)
    """
    if not settings.supabase_ready:
        # 개발 모드 (Supabase 미설정) → 제한 없이 통과
        return

    limit = DAILY_LIMITS.get(endpoint, 3)
    today = date.today().isoformat()
    client = get_supabase_client()

    # ── 1. 현재 사용량 조회 ──────────────────────────────────────────
    try:
        resp = await client.get(
            sb_url("api_usage"),
            headers=sb_headers(),
            params={
                "user_id":    f"eq.{user_id}",
                "usage_date": f"eq.{today}",
                "endpoint":   f"eq.{endpoint}",
                "select":     "count",
            },
        )
        resp.raise_for_status()
        rows = resp.json()
        current: int = rows[0]["count"] if rows else 0
    except httpx.HTTPStatusError as e:
        # DB 오류 시 서비스 중단보다 경고 후 통과 (단, 로그 필수)
        logger.warning(
            "사용량 조회 실패 — 제한 없이 통과 처리 (user=%s, endpoint=%s): %s",
            user_id, endpoint, e.response.text[:100],
        )
        return
    except Exception as e:
        logger.warning("사용량 조회 예외 — 통과 처리: %s", e)
        return

    # ── 2. 한도 초과 검사 ────────────────────────────────────────────
    if current >= limit:
        raise HTTPException(
            status_code=429,
            detail={
                "code":    "DAILY_LIMIT_EXCEEDED",
                "message": f"하루 최대 {limit}회까지 사용 가능합니다. 내일 다시 이용해 주세요.",
                "current": current,
                "limit":   limit,
            },
        )

    # ── 3. 카운터 증가 (upsert) ──────────────────────────────────────
    try:
        resp = await client.post(
            sb_url("api_usage"),
            headers=sb_headers(prefer="resolution=merge-duplicates,return=minimal"),
            json={
                "user_id":    user_id,
                "usage_date": today,
                "endpoint":   endpoint,
                "count":      current + 1,
            },
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        # 카운터 업데이트 실패 → 서비스는 계속 (이미 통과한 요청이므로)
        logger.warning(
            "사용량 카운터 업데이트 실패 (user=%s, endpoint=%s): %s",
            user_id, endpoint, e.response.text[:100],
        )
    except Exception as e:
        logger.warning("사용량 업데이트 예외: %s", e)
