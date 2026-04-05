"""
API 사용량 추적 및 제한 서비스.

무료 사용자가 다수의 요청으로 Claude API 크레딧을 소진하는 것을 방지.
사용량은 Supabase api_usage 테이블에 (user_id, usage_date, endpoint) 기준으로 기록.

제한:
  - /roadmap/full          : 주 1회 (Sonnet — 고비용, 해당 주 월요일 날짜를 키로 사용)
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
from datetime import date, datetime, timedelta, timezone

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.core.supabase_client import get_supabase_client, sb_headers, sb_url

logger = logging.getLogger(__name__)

# ── 엔드포인트별 허용 횟수 ───────────────────────────────────────────
DAILY_LIMITS: dict[str, int] = {
    "full":           1,   # Sonnet 전체 로드맵 — 주 1회 (주 단위 키 사용)
    "career-summary": 10,  # Haiku 커리어 분석 — 하루 10회
    "reroute":        3,   # Sonnet GPS 재탐색 — 하루 3회
}

# full은 주 단위로 추적 (해당 주 월요일 날짜를 키로 사용)
_WEEKLY_ENDPOINTS = frozenset({"full"})


def _limit_message(endpoint: str, limit: int) -> str:
    if endpoint in _WEEKLY_ENDPOINTS:
        return f"주 최대 {limit}회까지 로드맵을 생성할 수 있습니다. 추가 이용이 필요하시면 support@devnavi.kr로 문의해 주세요."
    return f"하루 최대 {limit}회까지 사용 가능합니다. 내일 다시 이용해 주세요."

# ── 개발/테스트 계정 — 일일 한도 적용 제외 ──────────────────────────
# 소스에 UUID를 박지 않고 환경변수(DEV_BYPASS_USERS=uuid1,uuid2)로 관리
# 로컬: .env, 프로덕션: SSM /devnavi/prod/DEV_BYPASS_USERS
def _load_bypass_users() -> frozenset[str]:
    raw = settings.DEV_BYPASS_USERS
    return frozenset(u.strip() for u in raw.split(",") if u.strip())

_DEV_BYPASS_USERS: frozenset[str] = _load_bypass_users()


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
        logger.warning("DEV_BYPASS 적용: user=%s endpoint=%s", user_id, endpoint)
        return  # 개발/테스트 계정 → 한도 미적용

    limit = DAILY_LIMITS.get(endpoint, 3)
    # BI-11: Lambda 서버 타임존에 의존하지 않도록 UTC 기준 날짜 사용
    today = datetime.now(timezone.utc).date()
    # full은 주 단위 추적 — 해당 주 월요일 날짜를 키로 사용 (DB 스키마 변경 없이 주간 제한)
    date_key = (today - timedelta(days=today.weekday())) if endpoint in _WEEKLY_ENDPOINTS else today
    client = get_supabase_client()

    # ── 1. 원자적 RPC 호출 (Race Condition 완전 방지) ────────────────
    try:
        rpc_resp = await client.post(
            sb_url("rpc/increment_and_check_usage"),
            headers=sb_headers(),
            json={
                "p_user_id":  user_id,
                "p_endpoint": endpoint,
                "p_date":     date_key.isoformat(),
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
                reset_at = (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()
                raise HTTPException(
                    status_code=429,
                    detail={
                        "code":    "DAILY_LIMIT_EXCEEDED",
                        "message": _limit_message(endpoint, limit),
                        "limit":   limit,
                        "reset_at": reset_at,
                    },
                )
        # RPC 자체가 없거나 다른 오류 → 폴백
        raise httpx.HTTPStatusError("RPC unavailable", request=rpc_resp.request, response=rpc_resp)

    except HTTPException:
        raise  # 한도 초과 예외는 그대로 전달

    except Exception as rpc_err:
        # RPC 미존재 또는 네트워크 오류 → 기존 방식으로 폴백
        logger.warning("RPC 폴백 (원인: %s) — 기존 방식으로 진행", rpc_err)
        await _legacy_check_and_increment(client, user_id, endpoint, date_key.isoformat(), limit)


async def _legacy_check_and_increment(
    client, user_id: str, endpoint: str, today: str, limit: int
) -> None:
    """원자적 increment_api_usage RPC 폴백 — increment_and_check_usage 미존재 시 사용.

    I3: 기존 SELECT→UPDATE 2단계는 동시 요청 시 race condition 발생.
    increment_api_usage RPC(migrations/002)로 원자적 카운터 증가 후 limit 검사.
    """
    try:
        rpc_resp = await client.post(
            f"{settings.SUPABASE_URL}/rest/v1/rpc/increment_api_usage",
            headers=sb_headers(),
            json={
                "p_user_id":  user_id,
                "p_endpoint": endpoint,
                "p_date":     today,
            },
        )
        rpc_resp.raise_for_status()
        new_count: int = rpc_resp.json()
    except Exception as e:
        # BC-6: RPC 2개 모두 실패 시 제한 없이 통과하면 비용 폭탄 위험
        # 프로덕션에서는 차단, 개발 환경에서만 통과 허용
        logger.error("increment_api_usage RPC 실패 (user=%s): %s", user_id, e)
        raise HTTPException(
            status_code=503,
            detail={
                "code":    "USAGE_SERVICE_UNAVAILABLE",
                "message": "사용량 확인 서비스에 일시적 문제가 있습니다. 잠시 후 다시 시도해 주세요.",
            },
        )

    if new_count > limit:
        reset_at = (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()
        raise HTTPException(
            status_code=429,
            detail={
                "code":    "DAILY_LIMIT_EXCEEDED",
                "message": _limit_message(endpoint, limit),
                "current": new_count,
                "limit":   limit,
                "reset_at": reset_at,
            },
        )
