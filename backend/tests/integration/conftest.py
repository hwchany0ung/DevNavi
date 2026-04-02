# backend/tests/integration/conftest.py
# Design Ref: §2.4 — 실제 Supabase 연동 통합 테스트 fixtures
# SUPABASE_TEST_URL 없으면 모듈 전체 skip — 로컬 단위 테스트에 영향 없음
import os
import pytest
import httpx

SUPABASE_TEST_URL = os.environ.get("SUPABASE_TEST_URL")
SUPABASE_TEST_SERVICE_KEY = os.environ.get("SUPABASE_TEST_SERVICE_KEY")
SUPABASE_TEST_ANON_KEY = os.environ.get("SUPABASE_TEST_ANON_KEY")

if not SUPABASE_TEST_URL:
    pytest.skip(
        "SUPABASE_TEST_URL not set — skipping integration tests. "
        "Set SUPABASE_TEST_URL, SUPABASE_TEST_SERVICE_KEY to run.",
        allow_module_level=True,
    )


@pytest.fixture(scope="session")
def sb_base_url():
    return SUPABASE_TEST_URL


@pytest.fixture(scope="session")
def sb_headers():
    return {
        "apikey": SUPABASE_TEST_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_TEST_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="session")
def app():
    """실제 Supabase를 가리키는 FastAPI 앱 인스턴스."""
    os.environ["SUPABASE_URL"] = SUPABASE_TEST_URL
    os.environ["SUPABASE_SERVICE_KEY"] = SUPABASE_TEST_SERVICE_KEY
    from app.main import app as fastapi_app
    return fastapi_app


@pytest.fixture
async def async_client(app):
    from httpx import AsyncClient, ASGITransport
    cf_secret = os.environ.get("CLOUDFRONT_SECRET", "test-cf-secret")
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"X-CF-Secret": cf_secret},  # CloudFront 미들웨어 통과 (403 방지)
    ) as client:
        yield client


@pytest.fixture(autouse=True)
async def cleanup_test_data(sb_base_url, sb_headers):
    """각 테스트 후 test_ 이메일로 생성된 테스트 데이터 삭제."""
    yield
    async with httpx.AsyncClient() as client:
        await client.delete(
            f"{sb_base_url}/rest/v1/users?email=like.test_%40test.com",
            headers=sb_headers,
        )
