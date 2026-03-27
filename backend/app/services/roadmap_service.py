"""
로드맵 비즈니스 로직 — 공유 httpx 클라이언트로 Supabase REST API 호출.
(supabase 패키지 불필요)
"""
import json
import re
import uuid
from typing import Optional

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.core.supabase_client import get_supabase_client, sb_headers, sb_url
from app.models.roadmap import FullRoadmapResponse


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

def _raise_db_error(e: httpx.HTTPStatusError, operation: str) -> None:
    """httpx.HTTPStatusError → FastAPI HTTPException(502) 변환.

    Supabase가 4xx/5xx를 반환했을 때 클라이언트에게 의미 있는 에러를 전달.
    502 Bad Gateway: 백엔드가 upstream(DB)에서 실패했음을 의미.
    """
    raise HTTPException(
        status_code=502,
        detail=f"DB {operation} 실패 (Supabase {e.response.status_code}): {e.response.text[:200]}",
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
        return str(uuid.uuid4())  # Supabase 없으면 UUID만 반환

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
            },
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        _raise_db_error(e, "저장")
    return roadmap_id


async def get_roadmap(roadmap_id: str) -> dict | None:
    """roadmap_id로 로드맵 조회."""
    if not settings.supabase_ready:
        return None
    client = get_supabase_client()
    try:
        resp = await client.get(
            sb_url("roadmaps"),
            headers=sb_headers(),
            params={"id": f"eq.{roadmap_id}", "select": "*"},
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        _raise_db_error(e, "조회")
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
        _raise_db_error(e, "완료 토글")


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
        _raise_db_error(e, "완료 목록 조회")
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
            params={"user_id": f"eq.{user_id}", "select": "id,created_at", "order": "created_at.desc", "limit": "5"},
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        _raise_db_error(e, "로드맵 목록 조회")
    return resp.json() or []


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
        _raise_db_error(e, "활동 조회")
    return resp.json() or []
