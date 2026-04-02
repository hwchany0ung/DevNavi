# backend/tests/integration/test_auth.py
# Design Ref: §2.6 — Auth 토큰 검증 통합 테스트 (실제 Supabase)
# Plan SC: Auth 토큰 검증 통합 테스트 (TR-03)
import pytest

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_protected_roadmap_endpoint_no_auth(async_client):
    """인증 없이 /roadmap/persist → 401."""
    resp = await async_client.post("/roadmap/persist", json={
        "role": "백엔드",
        "period": "6months",
        "summary": "test",
        "data": {},
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_roadmap_completions_no_auth(async_client):
    """인증 없이 /roadmap/activity/me → 401."""
    resp = await async_client.get("/roadmap/activity/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_invalid_jwt_returns_401(async_client):
    """형식은 맞지만 서명이 틀린 JWT → 401."""
    resp = await async_client.get(
        "/roadmap/activity/me",
        headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_malformed_auth_header_returns_401(async_client):
    """Bearer 형식이 아닌 토큰 → 401."""
    resp = await async_client.get(
        "/roadmap/activity/me",
        headers={"Authorization": "Token not-a-jwt"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_consent_requires_auth(async_client):
    """인증 없이 /auth/consent → 401."""
    resp = await async_client.post("/auth/consent", json={
        "agreed_terms_at": "2026-01-01T00:00:00Z",
        "agreed_privacy_at": "2026-01-01T00:00:00Z",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_health_endpoint_no_auth_required(async_client):
    """헬스체크는 인증 없이 접근 가능."""
    resp = await async_client.get("/health")
    assert resp.status_code == 200
