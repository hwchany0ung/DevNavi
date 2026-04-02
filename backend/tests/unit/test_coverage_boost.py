# backend/tests/unit/test_coverage_boost.py
# app/core/supabase_client + app/models/roadmap 커버리지 보강
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

pytestmark = pytest.mark.unit


# ── supabase_client ───────────────────────────────────────────────────

class TestCloseSupabaseClient:
    @pytest.mark.asyncio
    async def test_close_open_client(self):
        """열린 클라이언트가 있으면 aclose() 호출 후 None으로 초기화."""
        from app.core import supabase_client as sc

        mock_client = AsyncMock()
        mock_client.is_closed = False
        sc._client = mock_client

        await sc.close_supabase_client()

        mock_client.aclose.assert_awaited_once()
        assert sc._client is None

    @pytest.mark.asyncio
    async def test_close_already_closed_client(self):
        """이미 닫힌 클라이언트는 aclose() 미호출."""
        from app.core import supabase_client as sc

        mock_client = MagicMock()
        mock_client.is_closed = True
        sc._client = mock_client

        await sc.close_supabase_client()
        mock_client.aclose.assert_not_called()

    @pytest.mark.asyncio
    async def test_close_aclose_exception_ignored(self):
        """aclose() 예외 발생 시에도 _client=None 보장."""
        from app.core import supabase_client as sc

        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.aclose.side_effect = Exception("connection error")
        sc._client = mock_client

        await sc.close_supabase_client()
        assert sc._client is None

    def test_sb_headers_raises_without_key(self):
        """SUPABASE_SERVICE_KEY 미설정 시 RuntimeError."""
        from app.core.supabase_client import sb_headers
        with patch("app.core.supabase_client.settings") as mock_settings:
            mock_settings.SUPABASE_SERVICE_KEY = None
            with pytest.raises(RuntimeError, match="SUPABASE_SERVICE_KEY"):
                sb_headers()

    def test_sb_url_raises_without_url(self):
        """SUPABASE_URL 미설정 시 RuntimeError."""
        from app.core.supabase_client import sb_url
        with patch("app.core.supabase_client.settings") as mock_settings:
            mock_settings.SUPABASE_URL = None
            with pytest.raises(RuntimeError, match="SUPABASE_URL"):
                sb_url("roadmaps")


# ── roadmap models ────────────────────────────────────────────────────

class TestRoadmapModels:
    def test_full_roadmap_request_truncates_skills(self):
        """skills 리스트가 sanitize 처리됨."""
        from app.models.roadmap import FullRoadmapRequest
        req = FullRoadmapRequest(
            role="backend",
            period="6months",
            level="beginner",
            skills=["Python", "SQL"],
        )
        assert req.skills == ["Python", "SQL"]

    def test_reroute_request_1month(self):
        """original_period에 '1month' 허용 (M6 수정 검증)."""
        from app.models.roadmap import RerouteRequest
        req = RerouteRequest(
            original_role="backend",
            original_period="1month",
            completion_rate=25.0,
            done_contents=["task1"],
            weeks_left=3,
        )
        assert req.original_period == "1month"

    def test_persist_request_invalid_parent_id(self):
        """parent_id가 UUID 형식이 아니면 ValidationError."""
        from app.models.roadmap import PersistRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            PersistRequest(
                role="backend",
                period="6months",
                roadmap={"months": [{"month": 1}]},
                parent_id="not-a-uuid",
            )

    def test_persist_request_valid_parent_id(self):
        """올바른 UUID parent_id는 통과."""
        from app.models.roadmap import PersistRequest
        req = PersistRequest(
            role="backend",
            period="6months",
            roadmap={"months": [{"month": 1}]},
            parent_id="a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        )
        assert req.parent_id == "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

    def test_persist_request_missing_months(self):
        """roadmap에 months 없으면 ValidationError."""
        from app.models.roadmap import PersistRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="months"):
            PersistRequest(role="backend", period="6months", roadmap={"role": "x"})

    def test_persist_request_empty_months(self):
        """roadmap.months가 빈 배열이면 ValidationError."""
        from app.models.roadmap import PersistRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            PersistRequest(role="backend", period="6months", roadmap={"months": []})

    def test_completion_toggle_invalid_task_id(self):
        """task_id 형식 불일치 시 ValidationError."""
        from app.models.roadmap import CompletionToggleRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            CompletionToggleRequest(task_id="invalid", completed=True)

    def test_completion_toggle_valid_task_id(self):
        """올바른 task_id 형식 통과."""
        from app.models.roadmap import CompletionToggleRequest
        req = CompletionToggleRequest(task_id="1-2-3", completed=True)
        assert req.task_id == "1-2-3"
