"""
로드맵 비즈니스 로직 — 공유 httpx 클라이언트로 Supabase REST API 호출.
(supabase 패키지 불필요)
"""
import json
import logging
import re
import uuid
from enum import Enum
from typing import Optional

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.core.supabase_client import get_supabase_client, sb_headers, sb_url
from app.models.roadmap import FullRoadmapResponse

logger = logging.getLogger(__name__)


class DbOp(str, Enum):
    SAVE         = "저장"
    FETCH        = "조회"
    TOGGLE       = "완료 토글"
    LIST_DONE    = "완료 목록 조회"
    LIST_ROADMAP = "로드맵 목록 조회"
    ACTIVITY     = "활동 조회"


# ── 로드맵 파싱 ───────────────────────────────────────────────────────

def parse_full_roadmap(raw_json: str) -> FullRoadmapResponse:
    """LLM 응답 문자열 → FullRoadmapResponse.

    코드블록 제거 후 첫 { ~ 마지막 } 구간을 추출해 파싱.
    (LLM이 JSON 앞뒤에 텍스트를 붙이는 경우 방어)
    """
    cleaned = re.sub(r"```(?:json)?\s*", "", raw_json).replace("```", "").strip()
    start = cleaned.find("{")
    end   = cleaned.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"JSON 구조를 찾을 수 없습니다: {cleaned[:300]}")
    json_str = cleaned[start:end]
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"로드맵 JSON 파싱 실패: {e}\n원문: {json_str[:300]}")
    return FullRoadmapResponse(**data)


# ── Supabase 에러 변환 헬퍼 ──────────────────────────────────────────

def _raise_db_error(e: httpx.HTTPStatusError, operation: DbOp) -> None:
    """httpx.HTTPStatusError → FastAPI HTTPException(502) 변환.

    내부 DB 구조(테이블명·SQL 오류 등)는 클라이언트에 노출하지 않고 로그에만 기록.
    """
    logger.error(
        "DB %s 실패 | Supabase %s | %s",
        operation, e.response.status_code, e.response.text[:500],
    )
    raise HTTPException(
        status_code=502,
        detail=f"데이터베이스 {operation} 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    )


# ── 저장 / 조회 ───────────────────────────────────────────────────────

async def persist_roadmap(
    user_id: str,
    role: str,
    period: str,
    data: dict,
    parent_id: Optional[str] = None,
) -> str:
    """파싱된 roadmap dict를 Supabase roadmaps 테이블에 저장."""
    if not settings.supabase_ready:
        # 프로덕션에서는 DB 없이 운영 불가 — 503 반환
        if settings.ENV == "production":
            raise HTTPException(status_code=503, detail="데이터베이스를 사용할 수 없습니다.")
        logger.warning("Supabase 미설정 — 개발 환경 임시 UUID 반환 (로드맵 저장 안됨)")
        return str(uuid.uuid4())

    roadmap_id = str(uuid.uuid4())
    client = get_supabase_client()
    try:
        resp = await client.post(
            sb_url("roadmaps"),
            headers=sb_headers(),
            json={
                "id":               roadmap_id,
                "user_id":          user_id,
                "role":             role,
                "period":           period,
                "summary":          data.get("summary", ""),
                "persona_title":    data.get("persona_title", ""),
                "persona_subtitle": data.get("persona_subtitle", ""),
                "data":             data,
                "parent_id":        parent_id,
                "status":           "active",
            },
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        _raise_db_error(e, DbOp.SAVE)
    return roadmap_id


async def get_roadmap(roadmap_id: str, user_id: str) -> dict | None:
    """roadmap_id로 로드맵 조회 (인증된 사용자 전용).

    호출부(GET /roadmap/{id})는 require_user로 인증을 강제하므로
    user_id는 항상 유효한 값이 전달된다. 소유자 불일치 시 None 반환.

    # 공유 기능 추가 시: 별도 share_token 검증 라우트를 신설하고
    # 이 함수는 None 허용 없이 유지할 것.
    """
    # M2: user_id=None 방어 — None 허용 시 소유자 필터 무효화로 타인 데이터 접근 위험
    if user_id is None:
        return None
    if not settings.supabase_ready:
        return None
    # BI-10: PostgREST 파라미터 UUID 형식 검증 (라우트 검증 후 이중 방어)
    if not _UUID_RE.match(roadmap_id):
        return None
    client = get_supabase_client()
    # 소유자 필터를 항상 적용해 타인 로드맵 접근을 원천 차단
    params: dict = {"id": f"eq.{roadmap_id}", "select": "*", "user_id": f"eq.{user_id}"}
    try:
        resp = await client.get(
            sb_url("roadmaps"),
            headers=sb_headers(),
            params=params,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        _raise_db_error(e, DbOp.FETCH)
    rows = resp.json()
    return rows[0] if rows else None


# ── 태스크 완료 ───────────────────────────────────────────────────────

async def upsert_completion(
    user_id: str,
    roadmap_id: str,
    task_id: str,
    completed: bool,
) -> None:
    """완료 → upsert / 미완료 → delete."""
    if not settings.supabase_ready:
        return
    client = get_supabase_client()
    try:
        if completed:
            resp = await client.post(
                sb_url("task_completions"),
                headers=sb_headers(prefer="resolution=merge-duplicates,return=minimal"),
                json={"user_id": user_id, "roadmap_id": roadmap_id, "task_id": task_id},
            )
        else:
            resp = await client.delete(
                sb_url("task_completions"),
                headers=sb_headers(prefer="return=minimal"),
                params={
                    "user_id":    f"eq.{user_id}",
                    "roadmap_id": f"eq.{roadmap_id}",
                    "task_id":    f"eq.{task_id}",
                },
            )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        _raise_db_error(e, DbOp.TOGGLE)


async def list_completions(user_id: str, roadmap_id: str) -> list[str]:
    """완료된 task_id 목록."""
    if not settings.supabase_ready:
        return []
    client = get_supabase_client()
    try:
        resp = await client.get(
            sb_url("task_completions"),
            headers=sb_headers(),
            params={
                "user_id":    f"eq.{user_id}",
                "roadmap_id": f"eq.{roadmap_id}",
                "select":     "task_id",
            },
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        _raise_db_error(e, DbOp.LIST_DONE)
    return [row["task_id"] for row in (resp.json() or [])]


async def list_user_roadmaps(user_id: str) -> list[dict]:
    """사용자의 로드맵 목록 조회 (최신순)."""
    if not settings.supabase_ready:
        return []
    client = get_supabase_client()
    try:
        resp = await client.get(
            sb_url("roadmaps"),
            headers=sb_headers(),
            params={"user_id": f"eq.{user_id}", "select": "id,created_at", "order": "created_at.desc", "limit": "1"},
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        _raise_db_error(e, DbOp.LIST_ROADMAP)
    return resp.json() or []


async def get_completion_rate(roadmap_id: str, user_id: str) -> float | None:
    """roadmap_id에 속한 태스크의 실제 완료율 계산 (0~100).

    I-3: 클라이언트가 보낸 completion_rate 대신 DB 값을 사용하기 위한 서버측 계산.
    소유권 검증 포함 — 요청자가 해당 로드맵 소유자가 아니면 None 반환.
    로드맵 데이터 없거나 태스크가 없으면 None 반환.
    """
    if not settings.supabase_ready:
        return None
    if user_id is None:
        return None
    if not _UUID_RE.match(roadmap_id):
        return None

    # 소유권 확인 및 로드맵 데이터 조회
    roadmap = await get_roadmap(roadmap_id, user_id=user_id)
    if roadmap is None:
        return None

    # 전체 태스크 수 계산 — roadmap data 필드에서 직접 계산
    data = roadmap.get("data", {})
    months = data.get("months", []) if isinstance(data, dict) else []
    total_tasks = sum(
        len(week.get("tasks", []))
        for month in months
        for week in (month.get("weeks", []) if isinstance(month, dict) else [])
    )
    if total_tasks == 0:
        return None

    # 완료된 태스크 수 조회
    client = get_supabase_client()
    try:
        resp = await client.get(
            sb_url("task_completions"),
            headers=sb_headers(),
            params={
                "user_id":    f"eq.{user_id}",
                "roadmap_id": f"eq.{roadmap_id}",
                "select":     "task_id",
            },
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.warning("get_completion_rate DB 조회 실패: %s", e)
        return None

    completed_count = len(resp.json() or [])
    return round(completed_count / total_tasks * 100, 2)


async def set_share_token(roadmap_id: str, user_id: str, token: Optional[str]) -> bool:
    """share_token 설정(토큰) 또는 해제(None). UUID 검증 + 본인 소유 검증 포함."""
    if not settings.supabase_ready:
        return False
    if not _UUID_RE.match(roadmap_id):
        return False
    # 소유자 검증
    existing = await get_roadmap(roadmap_id, user_id)
    if existing is None:
        return False
    client = get_supabase_client()
    try:
        resp = await client.patch(
            sb_url("roadmaps"),
            headers={**sb_headers(), "Prefer": "return=representation"},
            params={"id": f"eq.{roadmap_id}", "user_id": f"eq.{user_id}"},
            json={"share_token": token},
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.warning("set_share_token 실패: %s", e)
        return False
    return len(resp.json() or []) > 0


async def get_roadmap_by_share_token(token: str) -> Optional[dict]:
    """공유 토큰으로 로드맵 data 필드 반환. UUID 검증 + 없으면 None."""
    if not settings.supabase_ready:
        return None
    if not _UUID_RE.match(str(token)):
        return None
    client = get_supabase_client()
    try:
        resp = await client.get(
            sb_url("roadmaps"),
            headers=sb_headers(),
            params={"share_token": f"eq.{token}", "select": "id,data,created_at"},
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.warning("get_roadmap_by_share_token 실패: %s", e)
        return None
    rows = resp.json() or []
    return rows[0] if rows else None


async def list_activity(user_id: str) -> list[dict]:
    """잔디 달력용 최근 365일 날짜별 완료 수."""
    if not settings.supabase_ready:
        return []
    client = get_supabase_client()
    try:
        resp = await client.get(
            sb_url("activity_summary"),
            headers=sb_headers(),
            params={"user_id": f"eq.{user_id}", "select": "activity_date,count"},
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        _raise_db_error(e, DbOp.ACTIVITY)
    return resp.json() or []
