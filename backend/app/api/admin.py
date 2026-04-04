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

    # ── 스칼라 카운트 + 행 데이터 + usage 전부 asyncio.gather로 통합 ──
    # create_task 후 sequential await 실패 시 orphan 태스크가 되는 문제 방지.
    (
        total_users,
        new_users_today,
        total_roadmaps,
        roadmaps_today,
        errors_today,
        usage_resp,
        user_rows_resp,
        roadmap_rows_resp,
    ) = await asyncio.gather(
        _count("users"),
        _count("users", {"created_at": f"gte.{today}"}),
        _count("roadmaps"),
        _count("roadmaps", {"created_at": f"gte.{today}"}),
        _count("error_logs", {"created_at": f"gte.{today}"}),
        client.get(
            sb_url("api_usage"),
            params={"select": "endpoint,count", "usage_date": f"eq.{today}", "limit": "1000"},
            headers=sb_headers(),
        ),
        client.get(
            sb_url("users"),
            params={"select": "created_at", "created_at": f"gte.{week_ago}", "limit": "1000"},
            headers=sb_headers(),
        ),
        client.get(
            sb_url("roadmaps"),
            params={"select": "created_at", "created_at": f"gte.{week_ago}", "limit": "1000"},
            headers=sb_headers(),
        ),
    )

    # ── usage 집계 ────────────────────────────────────────────────
    usage_rows: list[dict] = usage_resp.json() if usage_resp.status_code == 200 else []
    api_calls_today    = sum(r.get("count", 0) for r in usage_rows)
    endpoint_breakdown: dict[str, int] = defaultdict(int)
    for row in usage_rows:
        endpoint_breakdown[row.get("endpoint", "unknown")] += row.get("count", 0)

    # ── 최근 7일 행 데이터 ────────────────────────────────────────
    user_rows: list[dict] = user_rows_resp.json() if user_rows_resp.status_code == 200 else []
    roadmap_rows: list[dict] = roadmap_rows_resp.json() if roadmap_rows_resp.status_code == 200 else []

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


@router.get("/security-events")
@limiter.limit("30/minute")
async def get_security_events(
    request: Request,
    admin: dict = Depends(require_admin),
    limit: int = 50,
    event_type: Optional[str] = None,
) -> dict:
    """보안 이벤트 조회 — 최근 이벤트 목록 + 오늘 요약.

    Design Ref: security-monitoring-be.design.md §3
    """
    if not settings.supabase_ready:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="DB 미설정")

    client = get_supabase_client()
    today = date.today().isoformat()

    # limit 범위 제한 (1~200)
    safe_limit = max(1, min(limit, 200))

    # 이벤트 조회 파라미터
    events_params: dict = {
        "select": "id,event_type,ip,path,method,status_code,created_at",
        "order": "created_at.desc",
        "limit": str(safe_limit),
    }
    if event_type in ("rate_limit_exceeded", "auth_failure"):
        events_params["event_type"] = f"eq.{event_type}"

    # 병렬 조회: 이벤트 목록 + 오늘 유형별 카운트
    events_resp, rl_count, af_count = await asyncio.gather(
        client.get(
            sb_url("security_events"),
            params=events_params,
            headers=sb_headers(),
        ),
        _count("security_events", {
            "created_at": f"gte.{today}",
            "event_type": "eq.rate_limit_exceeded",
        }),
        _count("security_events", {
            "created_at": f"gte.{today}",
            "event_type": "eq.auth_failure",
        }),
    )

    events = events_resp.json() if events_resp.status_code == 200 else []

    return {
        "events": events,
        "summary": {
            "rate_limit_today": rl_count,
            "auth_failure_today": af_count,
        },
    }


@router.get("/me")
@limiter.limit("30/minute")
async def admin_me(request: Request, admin: dict = Depends(require_admin)) -> dict:
    """관리자 신원 확인용 (프론트 진입 시 권한 체크에 사용)."""
    return {"id": admin["id"], "email": admin["email"], "role": "admin"}


@router.get("/qa/stats")
@limiter.limit("30/minute")
async def get_qa_stats(request: Request, admin: dict = Depends(require_admin)) -> dict:
    """Q&A 관리자 통계.

    Supabase service_role로 집계 쿼리 실행.
    """
    if not settings.supabase_ready:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="DB 미설정")

    client = get_supabase_client()

    try:
        # 병렬 쿼리 — asyncio.gather()로 동시 실행 (get_stats의 create_task 패턴 참고)
        (
            total_r,
            up_r,
            down_r,
            daily_r,
            checked_r,
            recent_r,
        ) = await asyncio.gather(
            # 총 Q&A 횟수
            client.get(
                sb_url("qa_events"),
                params={"select": "id", "event_type": "eq.qa_submitted"},
                headers={**sb_headers(), "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"},
            ),
            # 만족도 up 건수 (C5: 서버사이드 필터로 전체 로드 제거)
            client.get(
                sb_url("qa_feedback"),
                params={"select": "id", "rating": "eq.up"},
                headers={**sb_headers(), "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"},
            ),
            # 만족도 down 건수
            client.get(
                sb_url("qa_feedback"),
                params={"select": "id", "rating": "eq.down"},
                headers={**sb_headers(), "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"},
            ),
            # 일별 Q&A (최근 7일) — v_qa_daily_counts 뷰 사용
            client.get(
                sb_url("v_qa_daily_counts"),
                params={"select": "date,count"},
                headers=sb_headers(),
            ),
            # task_checked 이벤트 수
            client.get(
                sb_url("qa_events"),
                params={"select": "id", "event_type": "eq.task_checked"},
                headers={**sb_headers(), "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"},
            ),
            # 최근 피드백 20건
            client.get(
                sb_url("qa_feedback"),
                params={"select": "id,task_id,question,rating,created_at", "order": "created_at.desc", "limit": "20"},
                headers=sb_headers(),
            ),
        )

        total_qa_count = _parse_count(total_r.headers.get("content-range", "0/0"))

        up_count = _parse_count(up_r.headers.get("content-range", "0/0"))
        down_count = _parse_count(down_r.headers.get("content-range", "0/0"))
        total_fb = up_count + down_count
        satisfaction_rate = round(up_count / total_fb, 2) if total_fb > 0 else 0.0

        daily_counts = [
            {"date": str(row["date"]), "count": row["count"]}
            for row in (daily_r.json() if daily_r.status_code == 200 else [])
        ]

        task_checked_count = _parse_count(checked_r.headers.get("content-range", "0/0"))
        task_completion_lift = round(task_checked_count / max(total_qa_count, 1), 2)

        recent_feedback = recent_r.json() if recent_r.status_code == 200 else []

        return {
            "total_qa_count": total_qa_count,
            "satisfaction_rate": satisfaction_rate,
            "daily_counts": daily_counts,
            "task_completion_lift": task_completion_lift,
            "recent_feedback": recent_feedback,
        }
    except Exception as e:
        logger.error("qa stats 조회 실패: %s", e)
        return {
            "total_qa_count": 0,
            "satisfaction_rate": 0.0,
            "daily_counts": [],
            "task_completion_lift": 0.0,
            "recent_feedback": [],
        }


# ── role_references 롤백 ──────────────────────────────────────────

_VALID_ROLES = [
    "backend", "frontend", "cloud_devops", "fullstack",
    "data", "ai_ml", "security", "ios_android", "qa",
]


@router.post("/references/{role}/rollback", status_code=200)
@limiter.limit("10/minute")
async def rollback_reference(
    request: Request,
    role: str,
    _: dict = Depends(require_admin),
):
    """특정 직군의 role_references를 이전 버전으로 롤백."""
    if role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail="유효하지 않은 직군입니다.")

    if not settings.supabase_ready:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="DB 미설정")

    client = get_supabase_client()

    # 현재 active 버전 조회
    r = await client.get(
        sb_url("role_references"),
        headers=sb_headers(),
        params={"role": f"eq.{role}", "is_active": "eq.true",
                "select": "id,version", "limit": "1"},
    )
    active_rows = r.json() if r.status_code == 200 else []
    if not active_rows:
        raise HTTPException(status_code=404, detail="활성 버전이 없습니다.")

    current_version = active_rows[0]["version"]
    if current_version <= 1:
        raise HTTPException(status_code=400, detail="롤백할 이전 버전이 없습니다.")

    prev_version = current_version - 1

    # 이전 버전 조회
    r2 = await client.get(
        sb_url("role_references"),
        headers=sb_headers(),
        params={"role": f"eq.{role}", "version": f"eq.{prev_version}",
                "select": "id", "limit": "1"},
    )
    prev_rows = r2.json() if r2.status_code == 200 else []
    if not prev_rows:
        raise HTTPException(status_code=404, detail=f"v{prev_version}이 존재하지 않습니다.")

    # 현재 active 해제
    await client.patch(
        sb_url("role_references"),
        headers=sb_headers(prefer="return=minimal"),
        params={"id": f"eq.{active_rows[0]['id']}"},
        json={"is_active": False},
    )
    # 이전 버전 활성화
    await client.patch(
        sb_url("role_references"),
        headers=sb_headers(prefer="return=minimal"),
        params={"id": f"eq.{prev_rows[0]['id']}"},
        json={"is_active": True, "activated_by": "admin_rollback"},
    )

    logger.info("role_references rollback: %s v%d -> v%d", role, current_version, prev_version)
    return {"role": role, "rolled_back_to": prev_version}
