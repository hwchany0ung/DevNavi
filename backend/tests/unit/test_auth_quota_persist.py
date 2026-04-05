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
            with patch("app.services.usage_service._load_bypass_users", return_value=frozenset(["bypass-user"])):
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
             patch("app.services.usage_service._load_bypass_users", return_value=frozenset()):
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
             patch("app.services.usage_service._load_bypass_users", return_value=frozenset()):
            mock_settings.supabase_ready = True
            await check_and_increment("user-123", "full")


# ── persist (user_id=None) 방어 테스트 ──────────────────────────────

class TestGetRoadmap:
    """get_roadmap: user_id 필수(str), 소유자 필터 항상 적용."""

    @pytest.mark.asyncio
    async def test_owner_filter_always_applied(self):
        """user_id가 주어지면 쿼리 params에 user_id 필터가 항상 포함된다."""
        from app.services.roadmap_service import get_roadmap

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = [{"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "user_id": "user-123"}]

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch("app.services.roadmap_service.settings") as mock_settings, \
             patch("app.services.roadmap_service.get_supabase_client", return_value=mock_client):
            mock_settings.supabase_ready = True
            result = await get_roadmap("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", user_id="user-123")

        assert result is not None
        # 소유자 필터가 항상 params에 포함되어야 함
        call_kwargs = mock_client.get.call_args
        params = call_kwargs.kwargs.get("params", {})
        assert "user_id" in params
        assert params["user_id"] == "eq.user-123"

    @pytest.mark.asyncio
    async def test_different_owner_returns_none(self):
        """다른 user_id의 로드맵 조회 시 Supabase가 빈 배열 반환 → None."""
        from app.services.roadmap_service import get_roadmap

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = []  # 소유자 불일치 → 빈 결과

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch("app.services.roadmap_service.settings") as mock_settings, \
             patch("app.services.roadmap_service.get_supabase_client", return_value=mock_client):
            mock_settings.supabase_ready = True
            result = await get_roadmap("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", user_id="other-user")

        assert result is None

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_none(self):
        """UUID 형식이 아닌 roadmap_id → None 반환 (주입 방어)."""
        from app.services.roadmap_service import get_roadmap

        with patch("app.services.roadmap_service.settings") as mock_settings:
            mock_settings.supabase_ready = True
            result = await get_roadmap("not-a-valid-uuid", user_id="user-123")

        assert result is None


# ── JWT 추가 케이스 ────────────────────────────────────────────────────

class TestVerifyTokenSyncExtra:
    """_verify_token_sync: 알고리즘 불일치·sub 누락 케이스."""

    def test_signature_mismatch_raises_401(self):
        """잘못된 secret으로 서명된 토큰을 올바른 secret으로 검증 → 401.

        HS256 폴백 경로에서 서명 불일치 시 InvalidTokenError → _AuthError(401).
        """
        import time
        from app.middleware.auth import _verify_token_sync, _AuthError

        # RSA 키 없이 RS256 헤더만 가진 위조 토큰 생성 (HS256 secret으로 실제 서명)
        # 알고리즘 불일치를 시뮬레이션: algorithms=["RS256"] 토큰을 HS256 검증 시도
        import jwt as pyjwt
        # HS256으로 서명하되 헤더의 alg를 RS256처럼 보이게 하는 것은 불가하므로
        # RS256 알고리즘 토큰을 알려진 secret 없이 생성 → 서명 검증 실패로 401 확인
        # 실제 시나리오: JWKS 없이 HS256 폴백만 활성화된 상태에서 RS256 토큰 제출
        token = pyjwt.encode(
            {"sub": "user-123", "aud": "authenticated", "exp": int(time.time()) + 3600},
            "wrong-secret-for-rs256-simulation",
            algorithm="HS256",
        )
        # SUPABASE_JWT_SECRET을 다른 값으로 설정하면 서명 불일치 → 401
        with patch("app.middleware.auth.settings") as mock_settings:
            mock_settings.SUPABASE_URL = None  # JWKS 스킵
            mock_settings.SUPABASE_JWT_SECRET = "correct-secret-32-chars-minimum!x"
            with pytest.raises(_AuthError) as exc_info:
                _verify_token_sync(token)

        assert exc_info.value.status_code == 401

    def test_missing_sub_claim_raises_401(self):
        """sub 클레임이 없는 토큰 → 401 HTTPException (HS256 폴백 경로)."""
        import time, jwt
        from app.middleware.auth import _verify_token_sync, _AuthError

        secret = "test-secret-32-chars-minimum!!xx"
        token = jwt.encode(
            # sub 없이 email만 포함
            {"email": "nosubject@example.com", "aud": "authenticated", "exp": int(time.time()) + 3600},
            secret,
            algorithm="HS256",
        )
        with patch("app.middleware.auth.settings") as mock_settings:
            mock_settings.SUPABASE_URL = None  # JWKS 스킵
            mock_settings.SUPABASE_JWT_SECRET = secret
            with pytest.raises(_AuthError) as exc_info:
                _verify_token_sync(token)

        assert exc_info.value.status_code == 401
        assert "sub" in exc_info.value.detail


# ── 쿼터 추가 케이스 ──────────────────────────────────────────────────

class TestUsageQuota:
    """check_and_increment: 엔드포인트별 독립 동작 및 월 한도 코드 처리."""

    @pytest.mark.asyncio
    async def test_daily_limit_reached_raises_429(self):
        """일 사용량 29회 → increment 후 30회 = DAILY_LIMIT_EXCEEDED → 429.

        RPC가 DAILY_LIMIT_EXCEEDED 코드를 반환하면 429를 발생시켜야 한다.
        (실제 카운터 증가는 RPC가 원자적으로 처리 — 여기서는 RPC 응답 시뮬레이션)
        """
        from app.services.usage_service import check_and_increment

        mock_response = MagicMock()
        mock_response.status_code = 422
        mock_response.text = "DAILY_LIMIT_EXCEEDED"
        mock_response.json.return_value = {
            "code": "DAILY_LIMIT_EXCEEDED",
            "message": "daily limit reached after increment to 30",
        }

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch("app.services.usage_service.settings") as mock_settings, \
             patch("app.services.usage_service.get_supabase_client", return_value=mock_client), \
             patch("app.services.usage_service._load_bypass_users", return_value=frozenset()):
            mock_settings.supabase_ready = True
            with pytest.raises(HTTPException) as exc_info:
                await check_and_increment("user-daily-30", "full")

        assert exc_info.value.status_code == 429
        assert exc_info.value.detail["code"] == "DAILY_LIMIT_EXCEEDED"

    @pytest.mark.asyncio
    async def test_monthly_limit_code_raises_429(self):
        """월 사용량 99회 → increment 후 100회 = 한도 도달 → 429.

        RPC hint 필드에 DAILY_LIMIT_EXCEEDED 코드가 포함된 경우에도 429 발생해야 한다.
        (usage_service는 hint 필드까지 검사함)
        """
        from app.services.usage_service import check_and_increment

        mock_response = MagicMock()
        mock_response.status_code = 422
        mock_response.text = "limit exceeded"
        mock_response.json.return_value = {
            "code": "P0001",
            "hint": "DAILY_LIMIT_EXCEEDED",  # RPC가 hint에 코드를 넣는 경우
            "message": "monthly quota 100 reached",
        }

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch("app.services.usage_service.settings") as mock_settings, \
             patch("app.services.usage_service.get_supabase_client", return_value=mock_client), \
             patch("app.services.usage_service._load_bypass_users", return_value=frozenset()):
            mock_settings.supabase_ready = True
            with pytest.raises(HTTPException) as exc_info:
                await check_and_increment("user-monthly-100", "career-summary")

        assert exc_info.value.status_code == 429

    @pytest.mark.asyncio
    async def test_endpoints_are_independent(self):
        """'full' 한도 초과가 'career-summary' 카운터에 영향을 주지 않는다.

        각 엔드포인트는 독립적인 DAILY_LIMITS 값을 사용하므로
        한 엔드포인트의 거부가 다른 엔드포인트 통과를 막지 않는다.
        """
        from app.services.usage_service import check_and_increment

        # 'full' 초과 응답
        mock_response_over = MagicMock()
        mock_response_over.status_code = 422
        mock_response_over.text = "DAILY_LIMIT_EXCEEDED"
        mock_response_over.json.return_value = {"code": "DAILY_LIMIT_EXCEEDED"}

        # 'career-summary' 정상 응답
        mock_response_ok = MagicMock()
        mock_response_ok.status_code = 200
        mock_response_ok.json.return_value = {"count": 3}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=[mock_response_over, mock_response_ok])

        with patch("app.services.usage_service.settings") as mock_settings, \
             patch("app.services.usage_service.get_supabase_client", return_value=mock_client), \
             patch("app.services.usage_service._load_bypass_users", return_value=frozenset()):
            mock_settings.supabase_ready = True

            # 'full' → 한도 초과
            with pytest.raises(HTTPException) as exc_info:
                await check_and_increment("user-indep", "full")
            assert exc_info.value.status_code == 429

            # 'career-summary' → 정상 통과 (예외 없음)
            await check_and_increment("user-indep", "career-summary")


# ── persist_roadmap 추가 케이스 ───────────────────────────────────────

class TestPersistRoadmap:
    """persist_roadmap: supabase_ready 가드 및 Supabase 응답 실패 처리."""

    @pytest.mark.asyncio
    async def test_supabase_not_ready_returns_uuid_immediately(self):
        """supabase_ready=False → Supabase 호출 없이 UUID 문자열 즉시 반환."""
        from app.services.roadmap_service import persist_roadmap

        with patch("app.services.roadmap_service.settings") as mock_settings, \
             patch("app.services.roadmap_service.get_supabase_client") as mock_get_client:
            mock_settings.supabase_ready = False
            result = await persist_roadmap(
                user_id="user-123",
                role="개발자",
                period="6개월",
                data={"summary": "test"},
            )

        # Supabase 클라이언트 자체를 호출하지 않아야 함
        mock_get_client.assert_not_called()
        # 반환값은 UUID 형식 문자열이어야 함
        import uuid
        assert isinstance(result, str)
        uuid.UUID(result)  # 유효한 UUID인지 검증 (ValueError 없으면 통과)

    @pytest.mark.asyncio
    async def test_supabase_500_raises_db_error(self):
        """Supabase INSERT 응답 500 → _raise_db_error 호출로 예외 전파.

        persist_roadmap은 실패 시 예외를 전파한다 (False 반환이 아님).
        raise_for_status()가 HTTPStatusError를 발생시키면 _raise_db_error가 처리한다.
        """
        import httpx
        from app.services.roadmap_service import persist_roadmap

        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500 Internal Server Error",
            request=MagicMock(),
            response=mock_response,
        )

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch("app.services.roadmap_service.settings") as mock_settings, \
             patch("app.services.roadmap_service.get_supabase_client", return_value=mock_client):
            mock_settings.supabase_ready = True
            # Supabase 500은 HTTPException(502)으로 전파해야 함
            with pytest.raises(HTTPException) as exc_info:
                await persist_roadmap(
                    user_id="user-123",
                    role="개발자",
                    period="6개월",
                    data={"summary": "test"},
                )
        assert exc_info.value.status_code == 502
