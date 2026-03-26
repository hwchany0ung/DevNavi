"""
/roadmap 라우터

엔드포인트:
  POST /roadmap/teaser              - Haiku 티저 스트리밍 (무료, 로그인 불필요)
  POST /roadmap/full                - Sonnet 전체 로드맵 스트리밍 (프리미엄)
  POST /roadmap/career-summary      - Haiku 커리어 분석 JSON
  POST /roadmap/persist             - 스트리밍 완료 후 Supabase 저장 (인증 필요)
  POST /roadmap/reroute             - Sonnet GPS 재탐색 (인증 필요)
  GET  /roadmap/{id}                - 저장된 로드맵 조회
  POST /roadmap/{id}/completions    - 태스크 완료 토글 (인증 필요)
  GET  /roadmap/{id}/completions    - 완료 목록 조회 (인증 필요)
  GET  /roadmap/activity/me         - 잔디 달력 데이터 (인증 필요)
"""
import json
import re
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

from app.core.limiter import limiter
from app.models.roadmap import (
    TeaserRequest,
    FullRoadmapRequest,
    RerouteRequest,
    PersistRequest,
    CompletionToggleRequest,
    RoadmapSaveResponse,
    CareerSummaryRequest,
    CareerSummaryResponse,
)
from app.prompts.builder import build_teaser_prompt, build_full_prompt, build_reroute_prompt, build_career_summary_prompt
from app.services.claude_service import stream_teaser, stream_full, call_reroute, call_haiku
from app.services.roadmap_service import (
    parse_full_roadmap,
    persist_roadmap,
    get_roadmap,
    upsert_completion,
    list_completions,
    list_activity,
)
from app.middleware.auth import require_user, optional_user
from app.services.usage_service import check_and_increment

router = APIRouter(prefix="/roadmap", tags=["roadmap"])

SSE_HEADERS = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}


# ─────────────────────────── 티저 (Haiku) ───────────────────────────

@router.post("/teaser")
@limiter.limit("20/hour")
async def teaser(request: Request, body: TeaserRequest):
    """무료 사용자용 월별 뼈대 텍스트 스트리밍."""
    system, user = build_teaser_prompt(body.role, body.period, body.level)
    return StreamingResponse(stream_teaser(system, user), headers=SSE_HEADERS)


# ─────────────────────────── 전체 로드맵 (Sonnet) ───────────────────

@router.post("/full")
@limiter.limit("5/hour")
async def full_roadmap(
    request: Request,
    body: FullRoadmapRequest,
    user: dict = Depends(require_user),
):
    """Sonnet 전체 로드맵 JSON SSE 스트리밍 (로그인 필수).

    - 로그인 미인증 시 401
    - 무료 사용자 하루 3회 초과 시 429
    - Phase 6 결제 연동 후 require_premium으로 전환 예정
    """
    await check_and_increment(user["id"], "full")
    system, user_msg = build_full_prompt(
        body.role, body.period, body.level,
        body.skills, body.certifications,
        body.company_type, body.daily_study_hours,
    )
    return StreamingResponse(stream_full(system, user_msg), headers=SSE_HEADERS)


# ─────────────────────────── 커리어 분석 요약 ───────────────────────

@router.post("/career-summary")
@limiter.limit("10/hour")
async def career_summary(
    request: Request,
    body: CareerSummaryRequest,
    user: dict = Depends(require_user),
):
    """Haiku로 커리어 분석 JSON 반환 (로그인 필수).

    - 무료 사용자 하루 10회 초과 시 429
    """
    await check_and_increment(user["id"], "career-summary")
    try:
        system, user_msg = build_career_summary_prompt(
            body.role, body.period, body.level,
            body.skills, body.certifications, body.company_type,
        )
        raw = await call_haiku(system, user_msg)
        logger.info("career-summary raw response: %s", raw[:200])
    except Exception as e:
        logger.exception("career-summary AI 호출 실패")
        raise HTTPException(status_code=500, detail=f"AI 호출 실패: {e}")

    # JSON 추출 — 코드블록 제거 후 첫 번째 { } 구간 파싱
    cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
    # 앞뒤 불필요한 텍스트 제거 (첫 { ~ 마지막 } 추출)
    start = cleaned.find("{")
    end   = cleaned.rfind("}") + 1
    if start == -1 or end == 0:
        raise HTTPException(status_code=422, detail=f"JSON 구조를 찾을 수 없습니다: {cleaned[:200]}")
    json_str = cleaned[start:end]

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error("career-summary JSON 파싱 실패: %s\n원문: %s", e, json_str[:300])
        raise HTTPException(status_code=422, detail=f"JSON 파싱 실패: {e}")

    # 모델 검증 — 실패 시 raw dict 반환 (프론트가 방어적으로 처리)
    try:
        return CareerSummaryResponse(**data).model_dump()
    except Exception as e:
        logger.warning("CareerSummaryResponse 검증 경고 (raw dict 반환): %s", e)
        # 최소한의 기본값으로 보정
        return {
            "skills_to_learn": data.get("skills_to_learn", []),
            "certs_to_get":    data.get("certs_to_get", []),
            "appeal_points":   data.get("appeal_points", []),
            "career_message":  data.get("career_message", ""),
        }


# ─────────────────────────── Supabase 저장 ──────────────────────────

@router.post("/persist", response_model=RoadmapSaveResponse)
async def persist(
    body: PersistRequest,
    user: dict = Depends(require_user),
):
    """SSE 스트리밍 완료 후 프론트가 파싱된 JSON을 Supabase에 저장."""
    roadmap_id = await persist_roadmap(
        user["id"], body.role, body.period,
        body.roadmap, body.parent_id,
    )
    return RoadmapSaveResponse(roadmap_id=roadmap_id)


# ─────────────────────────── GPS 재탐색 (Sonnet) ────────────────────

@router.post("/reroute")
async def reroute(
    body: RerouteRequest,
    user: dict = Depends(require_user),
):
    """완료율 기반 잔여 로드맵 재생성 (단일 JSON 응답). 무료 하루 3회 제한."""
    await check_and_increment(user["id"], "reroute")
    system, user_msg = build_reroute_prompt(
        body.original_role, body.original_period,
        body.company_type, body.completion_rate,
        body.done_contents, body.weeks_left,
        body.daily_study_hours,
    )
    raw = await call_reroute(system, user_msg)
    try:
        roadmap = parse_full_roadmap(raw)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return roadmap


# ─────────────────────────── 조회 ───────────────────────────────────

@router.get("/activity/me")
async def get_activity(user: dict = Depends(require_user)):
    """잔디 달력용 최근 365일 날짜별 완료 수."""
    data = await list_activity(user["id"])
    return {"activity": data}


@router.get("/{roadmap_id}")
async def get(roadmap_id: str):
    """저장된 로드맵 조회 (공개 — 공유 링크 대응)."""
    data = await get_roadmap(roadmap_id)
    if not data:
        raise HTTPException(status_code=404, detail="로드맵을 찾을 수 없습니다.")
    return data


# ─────────────────────────── 태스크 완료 ────────────────────────────

@router.post("/{roadmap_id}/completions")
async def toggle_completion(
    roadmap_id: str,
    body: CompletionToggleRequest,
    user: dict = Depends(require_user),
):
    """태스크 완료/취소 토글."""
    await upsert_completion(user["id"], roadmap_id, body.task_id, body.completed)
    return {"ok": True}


@router.get("/{roadmap_id}/completions")
async def get_completions(
    roadmap_id: str,
    user: dict = Depends(require_user),
):
    """완료된 task_id 목록 반환."""
    task_ids = await list_completions(user["id"], roadmap_id)
    return {"task_ids": task_ids}
