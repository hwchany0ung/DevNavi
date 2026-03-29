"""
관리자 전용 API — /admin/*

보안 설계:
  1. require_admin: JWT 검증 후 DB에서 role='admin' 확인 (서버사이드)
  2. 비인가 접근 시 404 반환 (라우트 존재 자체를 숨김)
  3. Rate Limit 30/minute (관리자도 DoS 공격 가능)
  4. 에러 응답은 내부 상세 정보 미포함
"""
import asyncio
import logging
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.limiter import limiter
from app.core.supabase_client import get_supabase_client, sb_headers, sb_url
from app.middleware.auth import require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


# ── 헬퍼 ──────────────────────────────────────────────────────────

def _parse_count(content_range: str) -> int:
    """Content-Range 헤더에서 총 건수 파싱. 형식: '0-0/1234' or '*/1234'."""
    try:
        return int(content_range.split("/")[-1])
    except (ValueError, IndexError):
        return 0


async def _count(table: str, params: Optional[dict] = None) -> int:
    """Supabase REST count=exact 로 테이블 행 수 반환."""
    client = get_supabase_client()
    q = params or {}
    q["select"] = "id"
    r = await client.get(
        sb_url(table),
        params=q,
        headers={**sb_headers(), "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"},
    )
    return _parse_count(r.headers.get("content-range", "0/0"))


def _group_by_day(rows: list[dict], field: str, days: int) -> list[dict]:
    """ISO datetime 문자열을 날짜별로 집계. 빈 날은 0으로 채움."""
    counts: dict[str, int] = defaultdict(int)
    for row in rows:
        val = row.get(field, "") or ""
        if val:
            counts[val[:10]] += 1  # "2025-01-01T..." → "2025-01-01"
    return [
        {"date": (date.today() - timedelta(days=i)).isoformat(),
         "count": counts[(date.today() - timedelta(days=i)).isoformat()]}
        for i in range(days - 1, -1, -1)
    ]


# ── 에러 로그 비동기 저장 (미들웨어에서 호출) ─────────────────────

async def save_error_log(
    method: str,
    path: str,
    status_code: int,
    error_msg: str = "",
    user_id: Optional[str] = None,
) -> None:
    """5xx 에러를 error_logs 테이블에 저장. 실패해도 예외 전파하지 않음."""
    if not settings.supabase_ready:
        return
    try:
        client = get_supabase_client()
        payload = {
            "method":      method[:10],
            "path":        path[:500],
            "status_code": status_code,
            "error_msg":   error_msg[:1000],
        }
        if user_id:
            payload["user_id"] = user_id
        await client.post(
            sb_url("error_logs"),
            json=payload,
            headers=sb_headers(prefer="return=minimal"),
        )
    except Exception as e:
        # 에러 로깅이 실패해도 서비스에 영향 없어야 함
        logger.warning("[admin] error_log 저장 실패: %s", e)


# ── 엔드포인트 ────────────────────────────────────────────────────

@router.get("/stats")
@limiter.limit("30/minute")
async def get_stats(request: Request, admin: dict = Depends(require_admin)) -> dict:
    """
    대시보드 전체 통계.

    반환 항목:
      - total_users        : 총 가입자 수
      - new_users_today    : 오늘 신규 가입자
      - total_roadmaps     : 총 로드맵 생성 수
      - roadmaps_today     : 오늘 로드맵 생성 수
      - api_calls_today    : 오늘 총 API 호출 수
      - endpoint_breakdown : 엔드포인트별 오늘 호출 수
      - errors_today       : 오늘 발생한 에러 수
      - daily_signups      : 최근 7일 일별 신규 가입 (chart)
      - daily_roadmaps     : 최근 7일 일별 로드맵 생성 (chart)
    """
    if not settings.supabase_ready:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="DB 미설정")

    client   = get_supabase_client()
    today    = date.today().isoformat()
    week_ago = (date.today() - timedelta(days=6)).isoformat()

    # ── 스칼라 카운트 (병렬) ───────────────────────────────────────
    total_users_task    = asyncio.create_task(_count("users"))
    new_users_task      = asyncio.create_task(_count("users", {"created_at": f"gte.{today}"}))
    total_roadmaps_task = asyncio.create_task(_count("roadmaps"))
    roadmaps_today_task = asyncio.create_task(_count("roadmaps", {"created_at": f"gte.{today}"}))
    errors_today_task   = asyncio.create_task(_count("error_logs", {"created_at": f"gte.{today}"}))

    # ── 오늘 api_usage (엔드포인트 분석용) ───────────────────────
    usage_resp = await client.get(
        sb_url("api_usage"),
        params={"select": "endpoint,count", "usage_date": f"eq.{today}", "limit": "10000"},
        headers=sb_headers(),
    )
    usage_rows: list[dict] = usage_resp.json() if usage_resp.status_code == 200 else []
    api_calls_today    = sum(r.get("count", 0) for r in usage_rows)
    endpoint_breakdown: dict[str, int] = defaultdict(int)
    for row in usage_rows:
        endpoint_breakdown[row.get("endpoint", "unknown")] += row.get("count", 0)

    # ── 최근 7일 일별 데이터 ──────────────────────────────────────
    user_rows_resp = await client.get(
        sb_url("users"),
        params={"select": "created_at", "created_at": f"gte.{week_ago}", "limit": "10000"},
        headers=sb_headers(),
    )
    user_rows: list[dict] = user_rows_resp.json() if user_rows_resp.status_code == 200 else []

    roadmap_rows_resp = await client.get(
        sb_url("roadmaps"),
        params={"select": "created_at", "created_at": f"gte.{week_ago}", "limit": "10000"},
        headers=sb_headers(),
    )
    roadmap_rows: list[dict] = roadmap_rows_resp.json() if roadmap_rows_resp.status_code == 200 else []

    # 병렬 태스크 결과 수집
    (
        total_users,
        new_users_today,
        total_roadmaps,
        roadmaps_today,
        errors_today,
    ) = await asyncio.gather(
        total_users_task,
        new_users_task,
        total_roadmaps_task,
        roadmaps_today_task,
        errors_today_task,
    )

    return {
        "total_users":        total_users,
        "new_users_today":    new_users_today,
        "total_roadmaps":     total_roadmaps,
        "roadmaps_today":     roadmaps_today,
        "api_calls_today":    api_calls_today,
        "endpoint_breakdown": dict(endpoint_breakdown),
        "errors_today":       errors_today,
        "daily_signups":      _group_by_day(user_rows,    "created_at", 7),
        "daily_roadmaps":     _group_by_day(roadmap_rows, "created_at", 7),
    }


@router.get("/errors")
@limiter.limit("30/minute")
async def get_errors(request: Request, admin: dict = Depends(require_admin)) -> list:
    """최근 에러 로그 50건 (최신순)."""
    if not settings.supabase_ready:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="DB 미설정")

    client = get_supabase_client()
    r = await client.get(
        sb_url("error_logs"),
        params={"select": "*", "order": "created_at.desc", "limit": "50"},
        headers=sb_headers(),
    )
    return r.json() if r.status_code == 200 else []


@router.get("/me")
async def admin_me(admin: dict = Depends(require_admin)) -> dict:
    """관리자 신원 확인용 (프론트 진입 시 권한 체크에 사용)."""
    return {"id": admin["id"], "email": admin["email"], "role": "admin"}
