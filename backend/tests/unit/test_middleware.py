# backend/tests/unit/test_middleware.py
import os
import pytest
from httpx import AsyncClient, ASGITransport

pytestmark = pytest.mark.unit

# app.core.config 모듈을 테스트 실행 전에 임포트해 두기 위함.
# conftest.py가 ENV/ANTHROPIC_API_KEY를 setdefault로 설정하지만,
# 셸 환경에 빈 문자열이 이미 설정된 경우 덮어쓰지 않으므로,
# os.environ을 직접 설정해 Settings() 유효성 검사를 통과시킨다.
os.environ["ANTHROPIC_API_KEY"] = os.environ.get("ANTHROPIC_API_KEY") or "test-key"

from app.core import config  # noqa: E402  — 모듈 로드 확인
from app.main import app as _app  # noqa: E402  — app 캐시


@pytest.fixture
def app_with_cf_secret(monkeypatch):
    """CLOUDFRONT_SECRET이 설정된 앱."""
    monkeypatch.setattr(config.settings, "CLOUDFRONT_SECRET", "test-cf-secret")
    return _app


@pytest.fixture
def app_without_cf_secret(monkeypatch):
    """CLOUDFRONT_SECRET이 빈 문자열인 앱 (로컬 개발 환경)."""
    monkeypatch.setattr(config.settings, "CLOUDFRONT_SECRET", "")
    return _app


@pytest.mark.asyncio
async def test_cf_secret_valid_header_passes(app_with_cf_secret):
    """올바른 X-CF-Secret 헤더 → 미들웨어 통과 (non-health 경로에서 404 확인)."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_cf_secret),
        base_url="http://test",
    ) as client:
        # /nonexistent: 미들웨어 통과 시 FastAPI 404, 차단 시 403
        resp = await client.get(
            "/nonexistent", headers={"X-CF-Secret": "test-cf-secret"}
        )
    # 미들웨어를 통과했으므로 FastAPI가 404 반환 (403이 아님)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cf_secret_wrong_header_blocked(app_with_cf_secret):
    """잘못된 X-CF-Secret 헤더 → 403 반환."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_cf_secret),
        base_url="http://test",
    ) as client:
        resp = await client.get(
            "/nonexistent", headers={"X-CF-Secret": "wrong-secret"}
        )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_cf_secret_missing_header_blocked(app_with_cf_secret):
    """X-CF-Secret 헤더 없음 → 403 반환."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_cf_secret),
        base_url="http://test",
    ) as client:
        resp = await client.get("/nonexistent")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_cf_secret_not_configured_allows_all(app_without_cf_secret):
    """CLOUDFRONT_SECRET 미설정(로컬 개발) → 헤더 없어도 통과."""
    async with AsyncClient(
        transport=ASGITransport(app=app_without_cf_secret),
        base_url="http://test",
    ) as client:
        resp = await client.get("/health")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_health_always_bypasses_cf_secret(app_with_cf_secret):
    """/health 경로는 X-CF-Secret 없이도 항상 통과 (헬스체크 보호 예외)."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_cf_secret),
        base_url="http://test",
    ) as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
