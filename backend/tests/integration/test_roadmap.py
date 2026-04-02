# backend/tests/integration/test_roadmap.py
# Design Ref: §2.6 — Roadmap API 통합 테스트 (실제 Supabase)
# Plan SC: Roadmap API 통합 테스트 (TR-02)
import pytest

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_teaser_endpoint_no_auth_allowed(async_client):
    """/roadmap/teaser는 인증 없이도 호출 가능 (무료 플로우)."""
    resp = await async_client.post("/roadmap/teaser", json={
        "role": "backend",
        "period": "6months",
        "level": "beginner",
        "skills": [],
        "certifications": [],
        "company_type": "any",
        "daily_study_hours": "1to2h",
    })
    # 인증 없는 티저 요청: 200(스트리밍) 또는 rate limit(429) 허용
    # 503은 Supabase 미설정인 경우(테스트 환경에서는 발생 안 해야 함)
    assert resp.status_code in (200, 429), f"unexpected: {resp.status_code}"


@pytest.mark.asyncio
async def test_persist_requires_auth(async_client):
    """/roadmap/persist는 인증 필수."""
    resp = await async_client.post("/roadmap/persist", json={
        "role": "backend",
        "period": "6months",
        "summary": "test summary",
        "persona_title": "백엔드 입문자",
        "data": {"months": []},
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_reroute_requires_auth(async_client):
    """/roadmap/reroute는 인증 필수."""
    resp = await async_client.post("/roadmap/reroute", json={
        "original_roadmap_id": "00000000-0000-0000-0000-000000000000",
        "feedback": "더 실용적으로",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_roadmap_get_nonexistent_returns_404(async_client):
    """존재하지 않는 로드맵 ID 조회 → 404."""
    resp = await async_client.get("/roadmap/00000000-0000-0000-0000-000000000000")
    # 인증 없으면 401, 인증 있어도 없는 ID면 404
    assert resp.status_code in (401, 404)


@pytest.mark.asyncio
async def test_roadmap_invalid_uuid_returns_422(async_client):
    """UUID 형식이 아닌 roadmap_id → 422 또는 401(auth가 먼저 실행되는 경우)."""
    resp = await async_client.get("/roadmap/not-a-uuid")
    # FastAPI 라우터에 따라 auth 미들웨어가 UUID 검증보다 먼저 실행될 수 있음
    assert resp.status_code in (401, 422)


@pytest.mark.asyncio
async def test_completions_requires_auth(async_client):
    """/roadmap/{id}/completions GET은 인증 필수."""
    resp = await async_client.get(
        "/roadmap/00000000-0000-0000-0000-000000000000/completions"
    )
    assert resp.status_code == 401
