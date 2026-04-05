# backend/tests/unit/test_roadmap_share.py
# F8: 로드맵 공유 링크 — share 엔드포인트 단위 테스트
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from starlette.requests import Request as StarletteRequest
from starlette.datastructures import State


def _mock_request():
    """slowapi limiter가 요구하는 최소 starlette Request 객체."""
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/roadmap/shared/test",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 0),
        "state": State(),
    }
    return StarletteRequest(scope)

pytestmark = pytest.mark.unit


# ── POST /roadmap/{id}/share ──────────────────────────────────────────

class TestCreateShare:
    """create_share 핸들러 직접 호출 단위 테스트."""

    @pytest.mark.asyncio
    async def test_create_share_service_returns_token_structure(self):
        """set_share_token 성공 → {"share_token": <uuid>} 구조 반환."""
        from app.api.roadmap import create_share
        import uuid

        generated_token = None

        async def fake_set(roadmap_id, user_id, token):
            nonlocal generated_token
            generated_token = token
            return True

        with patch("app.api.roadmap.set_share_token", side_effect=fake_set):
            from app.core.limiter import limiter
            limiter.enabled = False
            try:
                result = await create_share(
                    roadmap_id="00000000-0000-0000-0000-000000000001",
                    request=_mock_request(),
                    user={"id": "user-1"},
                )
            finally:
                limiter.enabled = True

        assert "share_token" in result
        assert result["share_token"] == generated_token
        # UUID 형식 검증
        uuid.UUID(result["share_token"])

    @pytest.mark.asyncio
    async def test_create_share_not_owner_returns_404(self):
        """set_share_token False(소유자 불일치) → 404."""
        from app.api.roadmap import create_share

        with patch("app.api.roadmap.set_share_token", new=AsyncMock(return_value=False)):
            from app.core.limiter import limiter
            limiter.enabled = False
            try:
                with pytest.raises(HTTPException) as exc_info:
                    await create_share(
                        roadmap_id="00000000-0000-0000-0000-000000000001",
                        request=_mock_request(),
                        user={"id": "user-1"},
                    )
            finally:
                limiter.enabled = True

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_create_share_generates_new_uuid_each_call(self):
        """호출마다 새로운 UUID 생성 (링크 갱신 가능)."""
        from app.api.roadmap import create_share

        tokens = []

        async def fake_set(roadmap_id, user_id, token):
            tokens.append(token)
            return True

        with patch("app.api.roadmap.set_share_token", side_effect=fake_set):
            from app.core.limiter import limiter
            limiter.enabled = False
            try:
                r1 = await create_share(
                    roadmap_id="00000000-0000-0000-0000-000000000001",
                    request=_mock_request(),
                    user={"id": "user-1"},
                )
                r2 = await create_share(
                    roadmap_id="00000000-0000-0000-0000-000000000001",
                    request=_mock_request(),
                    user={"id": "user-1"},
                )
            finally:
                limiter.enabled = True

        assert r1["share_token"] != r2["share_token"]


# ── DELETE /roadmap/{id}/share ────────────────────────────────────────

class TestDeleteShare:
    """delete_share 핸들러 직접 호출 단위 테스트."""

    @pytest.mark.asyncio
    async def test_delete_share_success(self):
        """set_share_token(token=None) → {"ok": True}."""
        from app.api.roadmap import delete_share

        captured = {}

        async def fake_set(roadmap_id, user_id, token):
            captured["token"] = token
            return True

        with patch("app.api.roadmap.set_share_token", side_effect=fake_set):
            from app.core.limiter import limiter
            limiter.enabled = False
            try:
                result = await delete_share(
                    roadmap_id="00000000-0000-0000-0000-000000000001",
                    request=_mock_request(),
                    user={"id": "user-1"},
                )
            finally:
                limiter.enabled = True

        assert result == {"ok": True}
        assert captured["token"] is None  # share_token을 NULL로 설정

    @pytest.mark.asyncio
    async def test_delete_share_not_owner_returns_404(self):
        """소유자 불일치 → 404."""
        from app.api.roadmap import delete_share

        with patch("app.api.roadmap.set_share_token", new=AsyncMock(return_value=False)):
            from app.core.limiter import limiter
            limiter.enabled = False
            try:
                with pytest.raises(HTTPException) as exc_info:
                    await delete_share(
                        roadmap_id="00000000-0000-0000-0000-000000000001",
                        request=_mock_request(),
                        user={"id": "user-1"},
                    )
            finally:
                limiter.enabled = True

        assert exc_info.value.status_code == 404


# ── GET /roadmap/shared/{token} ───────────────────────────────────────

class TestGetSharedRoadmap:
    """get_shared_roadmap 핸들러 직접 호출 단위 테스트."""

    @pytest.mark.asyncio
    async def test_get_shared_roadmap_service_not_found(self):
        """서비스가 None 반환 → 404."""
        from app.api.roadmap import get_shared_roadmap
        from app.core.limiter import limiter

        with patch("app.api.roadmap.get_roadmap_by_share_token", new=AsyncMock(return_value=None)):
            limiter.enabled = False
            try:
                with pytest.raises(HTTPException) as exc_info:
                    await get_shared_roadmap(
                        request=_mock_request(),
                        token="00000000-0000-0000-0000-000000000001",
                    )
            finally:
                limiter.enabled = True

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_shared_roadmap_service_returns_data(self):
        """서비스가 데이터 반환 → 그대로 반환."""
        from app.api.roadmap import get_shared_roadmap
        from app.core.limiter import limiter

        fake = {"data": {}, "role": "backend", "period": "6months"}

        with patch("app.api.roadmap.get_roadmap_by_share_token", new=AsyncMock(return_value=fake)):
            limiter.enabled = False
            try:
                result = await get_shared_roadmap(
                    request=_mock_request(),
                    token="00000000-0000-0000-0000-000000000001",
                )
            finally:
                limiter.enabled = True

        assert result == fake

    @pytest.mark.asyncio
    async def test_get_shared_roadmap_no_user_id_in_response(self):
        """user_id 민감정보가 응답에 포함되지 않음 (서비스 레벨 보장)."""
        from app.api.roadmap import get_shared_roadmap
        from app.core.limiter import limiter

        # user_id가 없는 데이터만 반환되는지 확인
        safe_data = {
            "data": {"months": []},
            "role": "backend",
            "period": "6months",
            "persona_title": "Test",
            "persona_subtitle": "sub",
            "summary": "test summary",
        }

        with patch("app.api.roadmap.get_roadmap_by_share_token", new=AsyncMock(return_value=safe_data)):
            limiter.enabled = False
            try:
                result = await get_shared_roadmap(
                    request=_mock_request(),
                    token="00000000-0000-0000-0000-000000000001",
                )
            finally:
                limiter.enabled = True

        assert "user_id" not in result


# ── roadmap_service: set_share_token / get_roadmap_by_share_token ────

class TestShareServiceFunctions:
    """roadmap_service 공유 함수 단위 테스트."""

    @pytest.mark.asyncio
    async def test_set_share_token_supabase_not_ready(self):
        """Supabase 미설정 시 False 반환."""
        from app.services.roadmap_service import set_share_token

        with patch("app.services.roadmap_service.settings") as mock_settings:
            mock_settings.supabase_ready = False
            result = await set_share_token(
                "00000000-0000-0000-0000-000000000001",
                "user-1",
                "00000000-0000-0000-0000-000000000002",
            )

        assert result is False

    @pytest.mark.asyncio
    async def test_set_share_token_invalid_uuid(self):
        """잘못된 UUID → False 반환."""
        from app.services.roadmap_service import set_share_token

        with patch("app.services.roadmap_service.settings") as mock_settings:
            mock_settings.supabase_ready = True
            result = await set_share_token("not-a-uuid", "user-1", "token")

        assert result is False

    @pytest.mark.asyncio
    async def test_get_roadmap_by_share_token_supabase_not_ready(self):
        """Supabase 미설정 시 None 반환."""
        from app.services.roadmap_service import get_roadmap_by_share_token

        with patch("app.services.roadmap_service.settings") as mock_settings:
            mock_settings.supabase_ready = False
            result = await get_roadmap_by_share_token("00000000-0000-0000-0000-000000000001")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_roadmap_by_share_token_invalid_uuid(self):
        """잘못된 UUID → None 반환."""
        from app.services.roadmap_service import get_roadmap_by_share_token

        with patch("app.services.roadmap_service.settings") as mock_settings:
            mock_settings.supabase_ready = True
            result = await get_roadmap_by_share_token("not-a-uuid")

        assert result is None

    @pytest.mark.asyncio
    async def test_set_share_token_owner_not_found_returns_false(self):
        """소유자 검증 실패(get_roadmap 반환 None) → False."""
        from app.services.roadmap_service import set_share_token

        with (
            patch("app.services.roadmap_service.settings") as mock_settings,
            patch("app.services.roadmap_service.get_roadmap", new=AsyncMock(return_value=None)),
        ):
            mock_settings.supabase_ready = True
            result = await set_share_token(
                "00000000-0000-0000-0000-000000000001",
                "user-1",
                "00000000-0000-0000-0000-000000000002",
            )

        assert result is False
