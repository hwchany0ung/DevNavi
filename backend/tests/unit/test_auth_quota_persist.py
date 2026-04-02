# backend/tests/unit/test_auth_quota_persist.py
# M4: JWT 인증·쿼터·persist 단위 테스트
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

pytestmark = pytest.mark.unit


# ── JWT 인증 테스트 ────────────────────────────────────────────────────

class TestVerifyTokenSync:
    """_verify_token_sync: HS256 폴백 경로 단위 테스트 (JWKS 네트워크 없이)."""

    def _make_token(self, payload: dict, secret: str = "test-secret") -> str:
        import jwt
        return jwt.encode(payload, secret, algorithm="HS256")

    def test_valid_token_returns_user(self):
        """유효한 HS256 토큰 → {"id": ..., "email": ...} 반환."""
        import time, jwt
        from app.middleware.auth import _verify_token_sync

        token = jwt.encode(
            {"sub": "user-123", "email": "test@example.com", "aud": "authenticated", "exp": int(time.time()) + 3600},
            "test-secret-32-chars-minimum!!xx",
            algorithm="HS256",
        )
        with patch("app.middleware.auth.settings") as mock_settings:
            mock_settings.SUPABASE_URL = None  # JWKS 스킵
            mock_settings.SUPABASE_JWT_SECRET = "test-secret-32-chars-minimum!!xx"
            result = _verify_token_sync(token)

        assert result["id"] == "user-123"
        assert result["email"] == "test@example.com"

    def test_expired_token_raises_401(self):
        """만료된 토큰 → 401 HTTPException."""
        import time, jwt
        from app.middleware.auth import _verify_token_sync, _AuthError

        token = jwt.encode(
            {"sub": "user-123", "aud": "authenticated", "exp": int(time.time()) - 10},
            "test-secret-32-chars-minimum!!xx",
            algorithm="HS256",
        )
        with patch("app.middleware.auth.settings") as mock_settings:
            mock_settings.SUPABASE_URL = None
            mock_settings.SUPABASE_JWT_SECRET = "test-secret-32-chars-minimum!!xx"
            with pytest.raises(_AuthError) as exc_info:
                _verify_token_sync(token)

        assert exc_info.value.status_code == 401
        assert "만료" in exc_info.value.detail

    def test_invalid_signature_raises_401(self):
        """잘못된 서명 → 401 HTTPException."""
        import time, jwt
        from app.middleware.auth import _verify_token_sync, _AuthError

        token = jwt.encode(
            {"sub": "user-123", "aud": "authenticated", "exp": int(time.time()) + 3600},
            "wrong-secret",
            algorithm="HS256",
        )
        with patch("app.middleware.auth.settings") as mock_settings:
            mock_settings.SUPABASE_URL = None
            mock_settings.SUPABASE_JWT_SECRET = "test-secret-32-chars-minimum!!xx"
            with pytest.raises(_AuthError) as exc_info:
                _verify_token_sync(token)

        assert exc_info.value.status_code == 401

    def test_no_auth_config_raises_503(self):
        """SUPABASE_URL, SUPABASE_JWT_SECRET 모두 미설정 → 503."""
        from app.middleware.auth import _verify_token_sync, _AuthError

        with patch("app.middleware.auth.settings") as mock_settings:
            mock_settings.SUPABASE_URL = None
            mock_settings.SUPABASE_JWT_SECRET = None
            with pytest.raises(_AuthError) as exc_info:
                _verify_token_sync("any.token.value")

        assert exc_info.value.status_code == 503


# ── 쿼터(사용량 제한) 테스트 ─────────────────────────────────────────

class TestCheckAndIncrement:
    """check_and_increment: 쿼터 초과 시 429, 정상 케이스 통과."""

    @pytest.mark.asyncio
    async def test_supabase_not_ready_passes(self):
        """Supabase 미설정 (개발 모드) → 제한 없이 통과."""
        from app.services.usage_service import check_and_increment

        with patch("app.services.usage_service.settings") as mock_settings:
            mock_settings.supabase_ready = False
            # 예외 없이 반환되어야 함
            await check_and_increment("user-123", "full")

    @pytest.mark.asyncio
    async def test_dev_bypass_user_passes(self):
        """DEV_BYPASS_USERS에 포함된 user_id → 한도 미적용."""
        from app.services.usage_service import check_and_increment

        with patch("app.services.usage_service.settings") as mock_settings:
            mock_settings.supabase_ready = True
            with patch("app.services.usage_service._DEV_BYPASS_USERS", frozenset(["bypass-user"])):
                await check_and_increment("bypass-user", "full")

    @pytest.mark.asyncio
    async def test_rpc_limit_exceeded_raises_429(self):
        """RPC가 DAILY_LIMIT_EXCEEDED 반환 → 429 HTTPException."""
        from app.services.usage_service import check_and_increment

        mock_response = MagicMock()
        mock_response.status_code = 422
        mock_response.text = "DAILY_LIMIT_EXCEEDED"
        mock_response.json.return_value = {"code": "DAILY_LIMIT_EXCEEDED", "message": "limit exceeded"}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch("app.services.usage_service.settings") as mock_settings, \
             patch("app.services.usage_service.get_supabase_client", return_value=mock_client), \
             patch("app.services.usage_service._DEV_BYPASS_USERS", frozenset()):
            mock_settings.supabase_ready = True
            with pytest.raises(HTTPException) as exc_info:
                await check_and_increment("user-123", "full")

        assert exc_info.value.status_code == 429
        assert exc_info.value.detail["code"] == "DAILY_LIMIT_EXCEEDED"

    @pytest.mark.asyncio
    async def test_rpc_success_passes(self):
        """RPC 200 응답 → 통과 (예외 없음)."""
        from app.services.usage_service import check_and_increment

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"count": 1}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch("app.services.usage_service.settings") as mock_settings, \
             patch("app.services.usage_service.get_supabase_client", return_value=mock_client), \
             patch("app.services.usage_service._DEV_BYPASS_USERS", frozenset()):
            mock_settings.supabase_ready = True
            await check_and_increment("user-123", "full")


# ── persist (user_id=None) 방어 테스트 ──────────────────────────────

class TestGetRoadmapUserIdNone:
    """get_roadmap: user_id=None은 현재 의도된 동작이나 호출 시 주의 필요."""

    @pytest.mark.asyncio
    async def test_user_id_none_returns_result_without_filter(self):
        """user_id=None이면 owner 필터 없이 조회 (공개 조회 예약된 동작)."""
        from app.services.roadmap_service import get_roadmap

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = [{"id": "road-uuid", "user_id": "some-user"}]

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch("app.services.roadmap_service.settings") as mock_settings, \
             patch("app.services.roadmap_service.get_supabase_client", return_value=mock_client):
            mock_settings.supabase_ready = True
            result = await get_roadmap("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", user_id=None)

        # user_id 필터 없이 조회 → 결과 반환
        assert result is not None
        # 실제 쿼리 params에 user_id 필터가 없었음을 확인
        call_kwargs = mock_client.get.call_args
        assert "user_id" not in call_kwargs.kwargs.get("params", {})

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_none(self):
        """UUID 형식이 아닌 roadmap_id → None 반환 (주입 방어)."""
        from app.services.roadmap_service import get_roadmap

        with patch("app.services.roadmap_service.settings") as mock_settings:
            mock_settings.supabase_ready = True
            result = await get_roadmap("not-a-valid-uuid", user_id="user-123")

        assert result is None
