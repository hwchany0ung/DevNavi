"""
보안 이벤트 미들웨어 단위 테스트.

Design Ref: security-monitoring-be.design.md §4
Plan SC: 단위 테스트 >= 3건 (미들웨어 감지 로직 event_type 분류)
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.middleware.security_events import SecurityEventMiddleware, _extract_client_ip


# ── IP 추출 테스트 ─────────────────────────────────────────────────


class TestExtractClientIp:
    """_extract_client_ip: X-Forwarded-For 우선, fallback scope client."""

    def test_xff_header_single(self):
        """X-Forwarded-For 단일 IP."""
        scope = {"headers": [(b"x-forwarded-for", b"1.2.3.4")]}
        assert _extract_client_ip(scope) == "1.2.3.4"

    def test_xff_header_multiple(self):
        """X-Forwarded-For 다중 IP — 첫 번째(실제 클라이언트) 반환."""
        scope = {"headers": [(b"x-forwarded-for", b"1.2.3.4, 10.0.0.1, 172.16.0.1")]}
        assert _extract_client_ip(scope) == "1.2.3.4"

    def test_fallback_scope_client(self):
        """X-Forwarded-For 없을 때 scope client IP 사용."""
        scope = {"headers": [], "client": ("192.168.1.100", 54321)}
        assert _extract_client_ip(scope) == "192.168.1.100"

    def test_no_headers_no_client(self):
        """헤더도 client도 없으면 빈 문자열."""
        scope = {"headers": []}
        assert _extract_client_ip(scope) == ""


# ── 미들웨어 테스트 ────────────────────────────────────────────────


def _make_scope(path="/test", method="GET", client=("127.0.0.1", 8000)):
    """테스트용 ASGI scope 생성."""
    return {
        "type": "http",
        "path": path,
        "method": method,
        "headers": [],
        "client": client,
    }


def _make_inner_app(status_code: int):
    """지정 status_code를 반환하는 inner ASGI app."""
    async def app(scope, receive, send):
        await send({"type": "http.response.start", "status": status_code})
        await send({"type": "http.response.body", "body": b""})
    return app


@pytest.mark.asyncio
class TestSecurityEventMiddleware:
    """SecurityEventMiddleware: 429/401 감지 → save_security_event 호출."""

    @patch("app.middleware.security_events.save_security_event", new_callable=AsyncMock)
    async def test_detects_429_rate_limit(self, mock_save):
        """429 응답 → event_type='rate_limit_exceeded'로 save 호출."""
        mw = SecurityEventMiddleware(_make_inner_app(429))
        scope = _make_scope(path="/roadmap/full", method="POST")

        sent_messages = []
        async def send(msg):
            sent_messages.append(msg)

        await mw(scope, AsyncMock(), send)

        mock_save.assert_called_once()
        call_kwargs = mock_save.call_args
        # positional 또는 keyword 인자 모두 대응
        if call_kwargs.kwargs:
            assert call_kwargs.kwargs["event_type"] == "rate_limit_exceeded"
            assert call_kwargs.kwargs["status_code"] == 429
            assert call_kwargs.kwargs["path"] == "/roadmap/full"
            assert call_kwargs.kwargs["method"] == "POST"
        else:
            assert call_kwargs.args[0] == "rate_limit_exceeded"  # event_type

    @patch("app.middleware.security_events.save_security_event", new_callable=AsyncMock)
    async def test_detects_401_auth_failure(self, mock_save):
        """401 응답 → event_type='auth_failure'로 save 호출."""
        mw = SecurityEventMiddleware(_make_inner_app(401))
        scope = _make_scope(path="/admin/stats", method="GET")

        sent_messages = []
        async def send(msg):
            sent_messages.append(msg)

        await mw(scope, AsyncMock(), send)

        mock_save.assert_called_once()
        call_kwargs = mock_save.call_args
        if call_kwargs.kwargs:
            assert call_kwargs.kwargs["event_type"] == "auth_failure"
            assert call_kwargs.kwargs["status_code"] == 401
        else:
            assert call_kwargs.args[0] == "auth_failure"

    @patch("app.middleware.security_events.save_security_event", new_callable=AsyncMock)
    async def test_ignores_200_ok(self, mock_save):
        """200 응답 → save 호출 안 됨."""
        mw = SecurityEventMiddleware(_make_inner_app(200))
        scope = _make_scope()

        sent_messages = []
        async def send(msg):
            sent_messages.append(msg)

        await mw(scope, AsyncMock(), send)

        mock_save.assert_not_called()

    @patch("app.middleware.security_events.save_security_event", new_callable=AsyncMock)
    async def test_ignores_500_server_error(self, mock_save):
        """500 응답 → save 호출 안 됨 (5xx는 ErrorLogging 담당)."""
        mw = SecurityEventMiddleware(_make_inner_app(500))
        scope = _make_scope()

        sent_messages = []
        async def send(msg):
            sent_messages.append(msg)

        await mw(scope, AsyncMock(), send)

        mock_save.assert_not_called()

    async def test_non_http_passthrough(self):
        """non-http scope → inner app에 그대로 전달."""
        called = {"inner": False}

        async def inner_app(scope, receive, send):
            called["inner"] = True

        mw = SecurityEventMiddleware(inner_app)
        scope = {"type": "websocket"}

        await mw(scope, AsyncMock(), AsyncMock())

        assert called["inner"] is True
