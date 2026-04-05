# backend/tests/unit/test_role_skills.py
# GET /roadmap/role-skills 엔드포인트 단위 테스트
import os
import pytest
from unittest.mock import MagicMock
from httpx import AsyncClient, ASGITransport

# Settings 유효성 검사 통과를 위한 환경 변수 설정
os.environ["ANTHROPIC_API_KEY"] = os.environ.get("ANTHROPIC_API_KEY") or "test-key"

pytestmark = pytest.mark.unit


def _make_mock_response(rows: list, status: int = 200) -> MagicMock:
    """httpx GET 응답 모의 객체 생성 헬퍼."""
    mock_resp = MagicMock()
    mock_resp.status_code = status
    mock_resp.json.return_value = rows
    if status >= 400:
        mock_resp.raise_for_status.side_effect = Exception(f"HTTP {status}")
    else:
        mock_resp.raise_for_status = MagicMock()
    return mock_resp


@pytest.fixture
def _app():
    from app.main import app as fastapi_app
    return fastapi_app


# pre-commit hook: CLOUDFRONT_SECRET=test, conftest.py: CLOUDFRONT_SECRET=test-cf-secret
# 런타임에 settings.CLOUDFRONT_SECRET 값을 읽어 헤더 생성
def _cf_header():
    from app.core.config import settings
    return {"X-CF-Secret": settings.CLOUDFRONT_SECRET or ""}


@pytest.fixture
def supabase_ready(monkeypatch, mock_supabase):
    """settings.supabase_ready=True 상태를 만들기 위해 URL/KEY 설정.
    mock_supabase.is_closed=False로 설정해 get_supabase_client()가 새 클라이언트를 만들지 않게 한다.
    """
    mock_supabase.is_closed = False
    from app.core import config
    monkeypatch.setattr(config.settings, "SUPABASE_URL", "http://fake-supabase")
    monkeypatch.setattr(config.settings, "SUPABASE_SERVICE_KEY", "fake-key")


@pytest.fixture
def supabase_not_ready(monkeypatch):
    """settings.supabase_ready=False 상태를 만들기 위해 URL/KEY 제거."""
    from app.core import config
    monkeypatch.setattr(config.settings, "SUPABASE_URL", None)
    monkeypatch.setattr(config.settings, "SUPABASE_SERVICE_KEY", None)


class TestGetRoleSkillsEndpoint:
    """GET /roadmap/role-skills 엔드포인트 ASGI 단위 테스트."""

    @pytest.mark.asyncio
    async def test_returns_skills_and_certs_for_role(self, _app, mock_supabase, supabase_ready):
        """특정 role 요청 시 skills·certs 분리 반환."""
        rows = [
            {"skill_name": "Java",        "category": "skill", "priority": 100},
            {"skill_name": "Spring Boot", "category": "skill", "priority": 95},
            {"skill_name": "정보처리기사", "category": "cert",  "priority": 100},
            {"skill_name": "SQLD",        "category": "cert",  "priority": 90},
        ]
        mock_supabase.get.return_value = _make_mock_response(rows)

        async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as ac:
            resp = await ac.get("/roadmap/role-skills?role=backend", headers=_cf_header())

        assert resp.status_code == 200
        data = resp.json()
        assert data["skills"] == ["Java", "Spring Boot"]
        assert data["certs"]  == ["정보처리기사", "SQLD"]

    @pytest.mark.asyncio
    async def test_invalid_role_returns_400(self, _app, supabase_ready):
        """허용되지 않은 role 값 → 400."""
        async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as ac:
            resp = await ac.get("/roadmap/role-skills?role=hacker", headers=_cf_header())

        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_supabase_not_ready_returns_empty(self, _app, supabase_not_ready):
        """Supabase 미연동 시 빈 리스트 반환 (프론트 fallback 트리거)."""
        async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as ac:
            resp = await ac.get("/roadmap/role-skills?role=backend", headers=_cf_header())

        assert resp.status_code == 200
        data = resp.json()
        assert data["skills"] == []
        assert data["certs"]  == []

    @pytest.mark.asyncio
    async def test_supabase_error_returns_empty(self, _app, mock_supabase, supabase_ready):
        """Supabase 조회 실패(예외) 시 빈 리스트 반환."""
        mock_supabase.get.side_effect = Exception("Connection timeout")

        async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as ac:
            resp = await ac.get("/roadmap/role-skills?role=backend", headers=_cf_header())

        assert resp.status_code == 200
        data = resp.json()
        assert data["skills"] == []
        assert data["certs"]  == []

    @pytest.mark.asyncio
    async def test_empty_db_returns_empty_lists(self, _app, mock_supabase, supabase_ready):
        """DB에 데이터 없을 때 빈 리스트 반환."""
        mock_supabase.get.return_value = _make_mock_response([])

        async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as ac:
            resp = await ac.get("/roadmap/role-skills", headers=_cf_header())

        assert resp.status_code == 200
        data = resp.json()
        assert data["skills"] == []
        assert data["certs"]  == []

    @pytest.mark.asyncio
    async def test_no_role_param_does_not_add_filter(self, _app, mock_supabase, supabase_ready):
        """role 파라미터 없이 요청 시 Supabase params에 role 필터 없음."""
        mock_supabase.get.return_value = _make_mock_response([])

        async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as ac:
            await ac.get("/roadmap/role-skills", headers=_cf_header())

        call_kwargs = mock_supabase.get.call_args
        params = call_kwargs.kwargs.get("params", {})
        assert "role" not in params

    @pytest.mark.asyncio
    async def test_role_param_included_in_supabase_query(self, _app, mock_supabase, supabase_ready):
        """role 지정 시 Supabase params에 eq.role 필터 포함."""
        mock_supabase.get.return_value = _make_mock_response([])

        async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as ac:
            await ac.get("/roadmap/role-skills?role=data", headers=_cf_header())

        call_kwargs = mock_supabase.get.call_args
        params = call_kwargs.kwargs.get("params", {})
        assert params.get("role") == "eq.data"
