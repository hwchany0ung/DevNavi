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
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Path, Request
from fastapi.responses import StreamingResponse

# C2: roadmap_id 경로 파라미터 UUID 검증 (임의 문자열 주입 방지)
_UUID_PATTERN = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

logger = logging.getLogger(__name__)

from app.core.limiter import limiter
from app.core.config import settings
from app.core.supabase_client import get_supabase_client, sb_headers, sb_url
from app.models.roadmap import (
    TeaserRequest,
    FullRoadmapRequest,
    RerouteRequest,
    PersistRequest,
    CompletionToggleRequest,
    RoadmapSaveResponse,
    CareerSummaryRequest,
    CareerSummaryResponse,
    OnboardingSkillItem,
)
from app.prompts.builder import build_teaser_prompt, build_full_prompt, build_reroute_prompt, build_career_summary_prompt
from app.prompts.constants import PERIOD_MAP
from app.services.claude_service import stream_teaser, stream_full, stream_full_multicall, call_reroute, call_haiku
from app.services.roadmap_service import (
    parse_full_roadmap,
    persist_roadmap,
    get_roadmap,
    upsert_completion,
    list_completions,
    list_activity,
    list_user_roadmaps,
    get_completion_rate,
)
from app.middleware.auth import require_user, optional_user
from app.services.usage_service import check_and_increment

router = APIRouter(prefix="/roadmap", tags=["roadmap"])

SSE_HEADERS = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}


async def _with_usage_check(
    gen: AsyncGenerator[str, None],
    user_id: str,
) -> AsyncGenerator[str, None]:
    """사용량 차감 후 실제 스트리밍 제너레이터로 위임.

    스트리밍은 HTTP 헤더(200)를 먼저 전송한 뒤 body를 소비하기 때문에
    제너레이터 내부에서 429를 HTTP 상태로 반환할 수 없다.
    대신 SSE error event로 변환해 프론트엔드가 기존 onError 핸들러로 처리하게 한다.
    이 방식은 라우팅 오류·모델 파라미터 검증 실패 시 쿼터를 소모하지 않는 장점이 있다.
    (career-summary는 동기 응답이라 호출 성공 후 차감 가능하나, 스트리밍은 이 구조가 최선)
    """
    try:
        await check_and_increment(user_id, "full")
    except HTTPException as e:
        message = (
            e.detail.get("message", str(e.detail))
            if isinstance(e.detail, dict)
            else e.detail
        )
        # M1: SSE 에러는 HTTP 200으로 전송되어 ErrorLoggingMiddleware가 감지 못 함
        # → 429는 정상 비즈니스 로직이므로 INFO, 그 외는 WARNING으로 서버 측 기록
        if e.status_code == 429:
            logger.info("SSE usage limit (user=%s): %s", user_id, message)
        else:
            logger.warning("SSE error event (user=%s, status=%d): %s", user_id, e.status_code, message)
        yield f"data: {json.dumps({'type': 'error', 'message': message})}\n\n"
        return
    async for chunk in gen:
        yield chunk


# ─────────────────────────── 티저 캐시 헬퍼 ─────────────────────────

async def _get_teaser_cache(params_key: str) -> str | None:
    """Supabase teaser_cache 테이블에서 캐시된 티저 반환. 없으면 None."""
    try:
        client = get_supabase_client()
        resp = await client.get(
            sb_url("teaser_cache"),
            headers=sb_headers(),
            params={"params_key": f"eq.{params_key}", "select": "content", "limit": "1"},
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0]["content"] if rows else None
    except Exception as e:
        logger.warning("티저 캐시 조회 실패 (AI 직접 호출로 대체): %s", e)
        return None


async def _save_teaser_cache(params_key: str, content: str) -> None:
    """티저 결과를 Supabase에 저장. 이미 존재하면 무시(ignore)."""
    try:
        client = get_supabase_client()
        resp = await client.post(
            sb_url("teaser_cache"),
            headers=sb_headers(prefer="resolution=ignore,return=minimal"),
            json={"params_key": params_key, "content": content},
        )
        resp.raise_for_status()
        logger.info("티저 캐시 저장 완료: %s (%d자)", params_key, len(content))
    except Exception as e:
        logger.warning("티저 캐시 저장 실패: %s", e)


async def _stream_cached_teaser(content: str) -> AsyncGenerator[str, None]:
    """캐시된 텍스트를 SSE 형식으로 즉시 반환 (AI 호출 없음)."""
    yield f"data: {json.dumps({'type': 'text', 'chunk': content})}\n\n"
    yield "data: [DONE]\n\n"


async def _stream_teaser_and_cache(
    system: str, user_msg: str, params_key: str
) -> AsyncGenerator[str, None]:
    """Claude로 티저를 스트리밍하면서 완료 시 캐시에 저장."""
    buffer: list[str] = []

    async for chunk in stream_teaser(system, user_msg):
        # [DONE] 이전 청크에서 텍스트 수집
        if not chunk.startswith("data: [DONE]"):
            try:
                prefix = "data: "
                payload = chunk[len(prefix):].strip() if chunk.startswith(prefix) else chunk.strip()
                data = json.loads(payload)
                if data.get("type") == "text":
                    buffer.append(data.get("chunk", ""))
            except Exception:
                pass
        yield chunk

    # 스트리밍 완료 후 캐시 저장 (마지막 yield 뒤에 실행)
    if buffer and settings.supabase_ready:
        await _save_teaser_cache(params_key, "".join(buffer))


# ─────────────────────────── 티저 (Haiku) ───────────────────────────

@router.post("/teaser")
@limiter.limit("20/hour")
@limiter.limit("5/minute")   # M3: burst 방어 — 1분 5회 초과 시 429 (확인됨)
async def teaser(request: Request, body: TeaserRequest):
    """무료 사용자용 월별 뼈대 텍스트 스트리밍. Supabase 캐시 우선 반환.

    Rate Limit:
      - 20/hour per IP: 시간당 총량 제한
      - 5/minute per IP: 단시간 burst 방지 (1분 내 5회 초과 시 429)
    """
    params_key = f"{body.role}|{body.period}|{body.level}"

    # 1. 캐시 확인 → 히트 시 AI 호출 없이 즉시 반환
    # 최소 50자 이상인 경우만 유효 캐시로 간주 (빈 캐시/불완전 캐시 방지)
    if settings.supabase_ready:
        cached = await _get_teaser_cache(params_key)
        if cached and len(cached.strip()) >= 50:
            logger.info("티저 캐시 히트: %s", params_key)
            return StreamingResponse(_stream_cached_teaser(cached), headers=SSE_HEADERS)
        elif cached:
            logger.warning("티저 캐시 무효 (너무 짧음 %d자) → AI 재호출: %s", len(cached.strip()), params_key)

    # 2. 캐시 미스 → Claude Haiku 호출 + 결과 캐시 저장
    logger.info("티저 캐시 미스 → AI 호출: %s", params_key)
    system, user_msg = await build_teaser_prompt(body.role, body.period, body.level)
    return StreamingResponse(
        _stream_teaser_and_cache(system, user_msg, params_key),
        headers=SSE_HEADERS,
    )


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
    - 무료 사용자 하루 2회 초과 시 429
    - Phase 6 결제 연동 후 require_premium으로 전환 예정
    """
    months = PERIOD_MAP.get(body.period, 6)

    # 6개월 초과 → 멀티콜 (6개월씩 병렬 분할 호출 후 병합)
    if months > 6:
        gen = stream_full_multicall(
            body.role, body.level,
            body.skills, body.certifications,
            body.company_type, body.daily_study_hours,
            months,
            extra_profile=body.extra_profile,
        )
    else:
        # 6개월 이하 → 단일 호출 스트리밍
        system, user_msg = await build_full_prompt(
            body.role, body.period, body.level,
            body.skills, body.certifications,
            body.company_type, body.daily_study_hours,
            extra_profile=body.extra_profile,
        )
        gen = stream_full(system, user_msg)

    # 라우팅·파라미터 확정 후 쿼터 차감 — 제너레이터 시작 시점에 실행
    return StreamingResponse(_with_usage_check(gen, user["id"]), headers=SSE_HEADERS)


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
    try:
        system, user_msg = await build_career_summary_prompt(
            body.role, body.period, body.level,
            body.skills, body.certifications, body.company_type,
            extra_profile=body.extra_profile,
        )
        raw = await call_haiku(system, user_msg)
        logger.debug("career-summary raw response: %s", raw[:200])
    except Exception as e:
        logger.exception("career-summary AI 호출 실패")
        raise HTTPException(status_code=500, detail={"message": "AI 호출에 실패했습니다. 잠시 후 다시 시도해주세요."})

    # JSON 추출 — 코드블록 제거 후 첫 번째 { } 구간 파싱
    cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
    # 앞뒤 불필요한 텍스트 제거 (첫 { ~ 마지막 } 추출)
    start = cleaned.find("{")
    end   = cleaned.rfind("}") + 1
    if start == -1 or end == 0:
        logger.error("career-summary JSON 구조 없음. 원문(200자): %s", cleaned[:200])
        raise HTTPException(status_code=422, detail={"message": "응답 파싱에 실패했습니다. 다시 시도해주세요."})
    json_str = cleaned[start:end]

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error("career-summary JSON 파싱 실패: %s\n원문: %s", e, json_str[:300])
        raise HTTPException(status_code=422, detail={"message": "응답 파싱에 실패했습니다. 다시 시도해주세요."})

    # JSON 파싱 성공 후에만 사용량 차감 (파싱 실패 시 차감하지 않음)
    await check_and_increment(user["id"], "career-summary")

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
@limiter.limit("10/hour")
async def persist(
    request: Request,
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
@limiter.limit("5/hour")
async def reroute(
    request: Request,
    body: RerouteRequest,
    user: dict = Depends(require_user),
):
    """완료율 기반 잔여 로드맵 재생성 (단일 JSON 응답). 무료 하루 3회 제한."""
    # BC-5+회귀수정: 쿼터를 먼저 확인(429 차단), AI 호출, 성공 후 결과 반환
    # 쿼터 서비스 장애(503) 시에도 AI 결과는 반환 (비용 낭비 방지)
    await check_and_increment(user["id"], "reroute")

    # I-3: roadmap_id 제공 시 DB에서 실제 완료율 계산 (클라이언트 값 신뢰 금지)
    # 미제공 시 클라이언트 값 사용 (하위 호환 유지)
    completion_rate = body.completion_rate
    if body.roadmap_id is not None:
        db_rate = await get_completion_rate(body.roadmap_id, user["id"])
        if db_rate is not None:
            completion_rate = db_rate

    system, user_msg = await build_reroute_prompt(
        body.original_role, body.original_period,
        body.company_type, completion_rate,
        body.done_contents, body.weeks_left,
        body.daily_study_hours,
        user_requests=body.user_requests or None,
    )
    raw = await call_reroute(system, user_msg)
    try:
        roadmap = parse_full_roadmap(raw)
    except ValueError as e:
        raise HTTPException(status_code=422, detail={"message": "로드맵 파싱에 실패했습니다. 다시 시도해주세요."})
    return roadmap


# ─────────────────────────── 조회 ───────────────────────────────────

@router.get("/role-skills")
@limiter.limit("60/minute")
async def get_role_skills(request: Request, role: str | None = None):
    """직군별 추천 스킬·자격증 조회 (role_skills 테이블).

    - role 미지정 시 전체 직군 반환
    - Supabase 미연동 또는 조회 결과 없을 경우 빈 리스트 반환 (프론트에서 fallback)
    """
    from app.core.config import settings

    if not settings.supabase_ready:
        return {"skills": [], "certs": []}

    try:
        client = get_supabase_client()
        params: dict = {
            "select": "skill_name,category,priority",
            "order": "priority.desc",
        }
        if role:
            # 허용된 직군 값만 전달 (주입 방지)
            allowed_roles = {
                "backend", "frontend", "cloud_devops", "fullstack",
                "data", "ai_ml", "security", "ios_android", "qa",
            }
            if role not in allowed_roles:
                raise HTTPException(
                    status_code=400,
                    detail={"message": f"유효하지 않은 직군입니다: {role}"},
                )
            params["role"] = f"eq.{role}"

        resp = await client.get(
            sb_url("role_skills"),
            headers=sb_headers(),
            params=params,
        )
        resp.raise_for_status()
        rows = resp.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("role_skills 조회 실패 (빈 리스트 반환): %s", e)
        return {"skills": [], "certs": []}

    skills = [r["skill_name"] for r in rows if r.get("category") == "skill"]
    certs  = [r["skill_name"] for r in rows if r.get("category") == "cert"]
    return {"skills": skills, "certs": certs}


@router.get("/my")
@limiter.limit("30/minute")
async def my_roadmaps(request: Request, user: dict = Depends(require_user)):
    """로그인 사용자의 최신 로드맵 ID 반환 (홈 자동 리다이렉트용)."""
    items = await list_user_roadmaps(user["id"])
    return {"roadmap_id": items[0]["id"] if items else None}


@router.get("/activity/me")
@limiter.limit("30/minute")
async def get_activity(request: Request, user: dict = Depends(require_user)):
    """잔디 달력용 최근 365일 날짜별 완료 수."""
    data = await list_activity(user["id"])
    return {"activity": data}


@router.get("/{roadmap_id}")
async def get(roadmap_id: str = Path(pattern=_UUID_PATTERN), user: dict = Depends(require_user)):
    """저장된 로드맵 조회 (인증 필수, 본인 소유 검증)."""
    data = await get_roadmap(roadmap_id, user_id=user["id"])
    if not data:
        raise HTTPException(status_code=404, detail={"message": "로드맵을 찾을 수 없습니다."})
    return data


# ─────────────────────────── 태스크 완료 ────────────────────────────

@router.post("/{roadmap_id}/completions")
async def toggle_completion(
    roadmap_id: str = Path(pattern=_UUID_PATTERN),
    body: CompletionToggleRequest = ...,
    user: dict = Depends(require_user),
):
    """태스크 완료/취소 토글."""
    # I-1: IDOR 방어 — 소유권 검증 후 진행
    owner_check = await get_roadmap(roadmap_id, user_id=user["id"])
    if owner_check is None:
        raise HTTPException(status_code=404, detail={"message": "로드맵을 찾을 수 없습니다."})
    await upsert_completion(user["id"], roadmap_id, body.task_id, body.completed)
    return {"ok": True}


@router.get("/{roadmap_id}/completions")
async def get_completions(
    roadmap_id: str = Path(pattern=_UUID_PATTERN),
    user: dict = Depends(require_user),
):
    """완료된 task_id 목록 반환."""
    # I-1: IDOR 방어 — 소유권 검증 후 진행
    owner_check = await get_roadmap(roadmap_id, user_id=user["id"])
    if owner_check is None:
        raise HTTPException(status_code=404, detail={"message": "로드맵을 찾을 수 없습니다."})
    task_ids = await list_completions(user["id"], roadmap_id)
    return {"task_ids": task_ids}
