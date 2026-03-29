# backend/tests/conftest.py
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# 테스트 환경 설정 — SSM/Supabase 연결 방지
os.environ.setdefault("ENV", "test")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-32-chars-minimum!!")
os.environ.setdefault("CLOUDFRONT_SECRET", "test-cf-secret")


@pytest.fixture(scope="session")
def app():
    """FastAPI 앱 인스턴스 — SSM/DB 없이 로드."""
    from app.main import app as fastapi_app
    return fastapi_app


@pytest.fixture
def mock_anthropic(monkeypatch):
    """Anthropic AsyncAnthropic 클라이언트를 MagicMock으로 대체."""
    mock_client = MagicMock()
    mock_client.messages = MagicMock()
    mock_client.messages.create = AsyncMock()
    monkeypatch.setattr("app.services.claude_service._client", mock_client)
    return mock_client


@pytest.fixture
def mock_supabase(monkeypatch):
    """Supabase httpx 클라이언트 GET/POST를 AsyncMock으로 대체."""
    mock_client = MagicMock()
    mock_client.get = AsyncMock()
    mock_client.post = AsyncMock()
    monkeypatch.setattr("app.core.supabase_client._client", mock_client)
    return mock_client
