"""
로드맵 비즈니스 로직 — httpx로 Supabase REST API 직접 호출.
(supabase 패키지 불필요)
"""
import json
import re
import uuid
from typing import Optional

import httpx

from app.core.config import settings
from app.models.roadmap import FullRoadmapResponse


# ── Supabase REST 헬퍼 ────────────────────────────────────────────────

def _headers() -> dict:
    """Service-role 헤더 (RLS 우회)."""
    return {
        "apikey":        settings.SUPABASE_SERVICE_KEY or "",
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY or ''}",
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
    }

def _url(table: str) -> str:
    return f"{settings.SUPABASE_URL}/rest/v1/{table}"


# ── 로드맵 파싱 ───────────────────────────────────────────────────────

def parse_full_roadmap(raw_json: str) -> FullRoadmapResponse:
    """LLM 응답 문자열 → FullRoadmapResponse."""
    cleaned = re.sub(r"```(?:json)?\s*", "", raw_json).strip().rstrip("`").strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"로드맵 JSON 파싱 실패: {e}\n원문: {cleaned[:300]}")
    return FullRoadmapResponse(**data)


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
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            _url("roadmaps"),
            headers=_headers(),
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
    return roadmap_id


async def get_roadmap(roadmap_id: str) -> dict | None:
    """roadmap_id로 로드맵 조회."""
    if not settings.supabase_ready:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            _url("roadmaps"),
            headers=_headers(),
            params={"id": f"eq.{roadmap_id}", "select": "*"},
        )
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
    async with httpx.AsyncClient() as client:
        if completed:
            await client.post(
                _url("task_completions"),
                headers={**_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
                json={"user_id": user_id, "roadmap_id": roadmap_id, "task_id": task_id},
            )
        else:
            await client.delete(
                _url("task_completions"),
                headers=_headers(),
                params={
                    "user_id":    f"eq.{user_id}",
                    "roadmap_id": f"eq.{roadmap_id}",
                    "task_id":    f"eq.{task_id}",
                },
            )


async def list_completions(user_id: str, roadmap_id: str) -> list[str]:
    """완료된 task_id 목록."""
    if not settings.supabase_ready:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            _url("task_completions"),
            headers=_headers(),
            params={
                "user_id":    f"eq.{user_id}",
                "roadmap_id": f"eq.{roadmap_id}",
                "select":     "task_id",
            },
        )
    return [row["task_id"] for row in (resp.json() or [])]


async def list_activity(user_id: str) -> list[dict]:
    """잔디 달력용 최근 365일 날짜별 완료 수."""
    if not settings.supabase_ready:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            _url("activity_summary"),
            headers=_headers(),
            params={"user_id": f"eq.{user_id}", "select": "activity_date,count"},
        )
    return resp.json() or []
