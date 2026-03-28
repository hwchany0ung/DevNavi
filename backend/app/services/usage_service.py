"""
API 사용량 추적 및 일일 제한 서비스.

무료 사용자가 다수의 요청으로 Claude API 크레딧을 소진하는 것을 방지.
사용량은 Supabase api_usage 테이블에 (user_id, usage_date, endpoint) 기준으로 기록.

제한:
  - /roadmap/full          : 하루 5회 (Sonnet — 고비용)
  - /roadmap/career-summary: 하루 10회 (Haiku — 저비용)
  - /roadmap/reroute       : 하루 3회 (Sonnet — 고비용)

[Race Condition 해결]
  기존: 조회 → 비교 → upsert (3단계 HTTP, 동시 요청 시 limit 우회 가능)
  현재: Supabase RPC increment_and_check_usage 함수로 원자적 처리
  RPC 미존재 시: 기존 2단계 방식으로 폴백 (하위 호환)

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
    "full":           5,   # Sonnet 전체 로드맵 (파라미터 캐시로 중복 방지 → 하루 5회)
    "career-summary": 10,  # Haiku 커리어 분석
    "reroute":        3,   # Sonnet GPS 재탐색
}

# ── 개발/테스트 계정 — 일일 한도 적용 제외 ──────────────────────────
_DEV_BYPASS_USERS: frozenset[str] = frozenset({
    "4b2a2646-b9ca-4a20-8ab3-c8ff0d3b675c",
    "6fc1c49e-fa71-4b1d-860d-c1ae2106a0de",
})


async def check_and_increment(user_id: str, endpoint: str) -> None:
    """일일 사용량 원자적 확인 + 카운터 증가. 초과 시 HTTPException(429).

    Args:
        user_id:  JWT에서 추출한 사용자 UUID
        endpoint: 'full' | 'career-summary' | 'reroute'

    동작 방식:
      1. Supabase RPC increment_and_check_usage 로 원자적 처리 (Race Condition 방지)
      2. RPC 없으면 기존 조회+upsert 방식으로 폴백
      3. Supabase 장애 시 → 경고 로그 후 통과 (사용자 경험 우선)
    """
    if not settings.supabase_ready:
        return  # 개발 모드 (Supabase 미설정) → 제한 없이 통과

    if user_id in _DEV_BYPASS_USERS:
        return  # 개발/테스트 계정 → 한도 미적용

    limit = DAILY_LIMITS.get(endpoint, 3)
    today = date.today()
    client = get_supabase_client()

    # ── 1. 원자적 RPC 호출 (Race Condition 완전 방지) ────────────────
    try:
        rpc_resp = await client.post(
            sb_url("rpc/increment_and_check_usage"),
            headers=sb_headers(),
            json={
                "p_user_id":  user_id,
                "p_endpoint": endpoint,
                "p_date":     today.isoformat(),
                "p_limit":    limit,
            },
        )
        if rpc_resp.status_code == 200:
            # 성공 → count가 반환됨, 제한 이내
            return
        if rpc_resp.status_code in (400, 422):
            # PostgreSQL RAISE EXCEPTION → 한도 초과 (문자열 + 에러코드 이중 확인)
            err_text = rpc_resp.text
            try:
                err_json = rpc_resp.json()
                is_limit = (
                    "DAILY_LIMIT_EXCEEDED" in err_text or
                    err_json.get("code") == "DAILY_LIMIT_EXCEEDED" or
                    "DAILY_LIMIT_EXCEEDED" in str(err_json.get("message", "")) or
                    "DAILY_LIMIT_EXCEEDED" in str(err_json.get("hint", ""))
                )
            except Exception:
                is_limit = "DAILY_LIMIT_EXCEEDED" in err_text
            if is_limit:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "code":    "DAILY_LIMIT_EXCEEDED",
                        "message": f"하루 최대 {limit}회까지 사용 가능합니다. 내일 다시 이용해 주세요.",
                        "limit":   limit,
                    },
                )
        # RPC 자체가 없거나 다른 오류 → 폴백
        raise httpx.HTTPStatusError("RPC unavailable", request=rpc_resp.request, response=rpc_resp)

    except HTTPException:
        raise  # 한도 초과 예외는 그대로 전달

    except Exception as rpc_err:
        # RPC 미존재 또는 네트워크 오류 → 기존 방식으로 폴백
        logger.warning("RPC 폴백 (원인: %s) — 기존 방식으로 진행", rpc_err)
        await _legacy_check_and_increment(client, user_id, endpoint, today.isoformat(), limit)


async def _legacy_check_and_increment(
    client, user_id: str, endpoint: str, today: str, limit: int
) -> None:
    """기존 2단계(조회+upsert) 방식 — RPC 미존재 시 폴백용."""

    # 1. 현재 사용량 조회
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
        logger.warning(
            "사용량 조회 실패 — 제한 없이 통과 (user=%s, endpoint=%s): %s",
            user_id, endpoint, e.response.text[:100],
        )
        return
    except Exception as e:
        logger.warning("사용량 조회 예외 — 통과 처리: %s", e)
        return

    # 2. 한도 초과 검사
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

    # 3. 카운터 증가 (upsert)
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
    except Exception as e:
        logger.warning("사용량 카운터 업데이트 실패 (user=%s): %s", user_id, e)
