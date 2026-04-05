# backend/tests/unit/test_usage_service.py
"""usage_service.check_and_increment — 429 응답 detail.reset_at 필드 검증."""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException


pytestmark = pytest.mark.unit


def _make_rpc_response(status_code: int, body):
    """httpx Response 유사 Mock 생성."""
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = body
    mock_resp.text = str(body)
    mock_resp.request = MagicMock()
    return mock_resp


@pytest.fixture
def mock_http_client():
    """get_supabase_client()를 직접 대체하는 AsyncMock httpx 클라이언트."""
    client = MagicMock()
    client.post = AsyncMock()
    client.is_closed = False
    with patch("app.services.usage_service.get_supabase_client", return_value=client):
        yield client


@pytest.mark.asyncio
async def test_429_rpc_contains_reset_at(mock_http_client):
    """RPC 경로에서 429 발생 시 detail에 reset_at 필드가 포함된다."""
    from app.services import usage_service

    # RPC가 400(한도 초과)을 반환하도록 설정
    rpc_body = {
        "code": "DAILY_LIMIT_EXCEEDED",
        "message": "DAILY_LIMIT_EXCEEDED",
        "hint": "",
    }
    mock_http_client.post.return_value = _make_rpc_response(400, rpc_body)

    with pytest.raises(HTTPException) as exc_info:
        await usage_service.check_and_increment("test-user-id", "career-summary")

    assert exc_info.value.status_code == 429
    detail = exc_info.value.detail
    assert detail["code"] == "DAILY_LIMIT_EXCEEDED"
    assert "reset_at" in detail, "reset_at 필드가 429 detail에 없음"

    # reset_at은 UTC 내일 날짜 ISO 문자열
    today = datetime.now(timezone.utc).date()
    tomorrow = today + timedelta(days=1)
    assert detail["reset_at"] == tomorrow.isoformat()


@pytest.mark.asyncio
async def test_429_legacy_contains_reset_at(mock_http_client):
    """폴백(legacy) 경로에서 429 발생 시 detail에 reset_at 필드가 포함된다."""
    from app.services import usage_service

    # 1차 RPC가 404(미존재)를 반환 → 폴백 경로 진입
    import httpx as _httpx
    primary_rpc_resp = _make_rpc_response(404, {})

    # 폴백 RPC가 limit 초과 count(11)를 반환 (career-summary limit=10)
    legacy_rpc_resp = _make_rpc_response(200, 11)
    legacy_rpc_resp.raise_for_status = MagicMock()

    # 1차 post → HTTPStatusError를 raise하도록 설정 (RPC 미존재 시 폴백 트리거)
    def side_effect_primary(*args, **kwargs):
        raise _httpx.HTTPStatusError(
            "RPC unavailable",
            request=MagicMock(),
            response=primary_rpc_resp,
        )

    mock_http_client.post.side_effect = [
        # 첫 번째 호출: RPC 폴백 트리거를 위해 예외 발생
        Exception("RPC not found"),
        # 두 번째 호출(legacy): 한도 초과 count 반환
        legacy_rpc_resp,
    ]

    with pytest.raises(HTTPException) as exc_info:
        await usage_service.check_and_increment("test-user-id", "career-summary")

    assert exc_info.value.status_code == 429
    detail = exc_info.value.detail
    assert detail["code"] == "DAILY_LIMIT_EXCEEDED"
    assert "reset_at" in detail, "reset_at 필드가 legacy 경로 429 detail에 없음"

    today = datetime.now(timezone.utc).date()
    tomorrow = today + timedelta(days=1)
    assert detail["reset_at"] == tomorrow.isoformat()
