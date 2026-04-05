"""
feedback_service + analytics_service 단위 테스트.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

pytestmark = pytest.mark.unit


# ── feedback_service 테스트 ──────────────────────────────────────

@pytest.mark.unit
class TestSaveFeedback:
    @patch("app.services.feedback_service.get_supabase_client")
    async def test_save_feedback_up(self, mock_get):
        from app.services.feedback_service import save_feedback
        mock_client = MagicMock()
        mock_client.post = AsyncMock(return_value=MagicMock(status_code=201))
        mock_get.return_value = mock_client

        result = await save_feedback("uid", "1-1-0", "질문", "답변", "up")
        assert result is True

    @patch("app.services.feedback_service.get_supabase_client")
    async def test_save_feedback_down(self, mock_get):
        from app.services.feedback_service import save_feedback
        mock_client = MagicMock()
        mock_client.post = AsyncMock(return_value=MagicMock(status_code=201))
        mock_get.return_value = mock_client

        result = await save_feedback("uid", "1-1-0", "질문", "답변", "down")
        assert result is True

    @patch("app.services.feedback_service.get_supabase_client")
    async def test_save_feedback_db_error_returns_false(self, mock_get):
        from app.services.feedback_service import save_feedback
        mock_client = MagicMock()
        mock_client.post = AsyncMock(side_effect=Exception("DB error"))
        mock_get.return_value = mock_client

        result = await save_feedback("uid", "1-1-0", "질문", "답변", "up")
        assert result is False


# ── analytics_service 테스트 ────────────────────────────────────

@pytest.mark.unit
class TestLogEvent:
    @patch("app.services.analytics_service.get_supabase_client")
    async def test_log_event_qa_opened(self, mock_get):
        from app.services.analytics_service import log_event
        mock_client = MagicMock()
        mock_client.post = AsyncMock(return_value=MagicMock(status_code=201))
        mock_get.return_value = mock_client

        result = await log_event("qa_opened", "1-1-0", "uid", {})
        assert result is True

    @patch("app.services.analytics_service.get_supabase_client")
    async def test_log_event_anonymous(self, mock_get):
        from app.services.analytics_service import log_event
        mock_client = MagicMock()
        mock_client.post = AsyncMock(return_value=MagicMock(status_code=201))
        mock_get.return_value = mock_client

        result = await log_event("qa_opened", "1-1-0", None, {})
        assert result is True

    @patch("app.services.analytics_service.get_supabase_client")
    async def test_log_event_db_error_returns_false(self, mock_get):
        from app.services.analytics_service import log_event
        mock_client = MagicMock()
        mock_client.post = AsyncMock(side_effect=Exception("DB error"))
        mock_get.return_value = mock_client

        result = await log_event("task_checked", "1-1-0", "uid", {})
        assert result is False

    @patch("app.services.analytics_service.get_supabase_client")
    async def test_log_event_task_checked(self, mock_get):
        from app.services.analytics_service import log_event
        mock_client = MagicMock()
        mock_client.post = AsyncMock(return_value=MagicMock(status_code=201))
        mock_get.return_value = mock_client

        result = await log_event("task_checked", "2-3-1", "uid", {"from_qa": True})
        assert result is True


# ── 엔드포인트 모델 검증 테스트 ─────────────────────────────────

@pytest.mark.unit
class TestFeedbackRequestValidation:
    def test_valid_feedback_request(self):
        from app.models.qa_models import FeedbackRequest
        req = FeedbackRequest(task_id="1-1-0", question="질문", answer="답변", rating="up")
        assert req.rating == "up"

    def test_invalid_rating_raises_validation_error(self):
        from app.models.qa_models import FeedbackRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            FeedbackRequest(task_id="1-1-0", question="질문", answer="답변", rating="neutral")

    def test_invalid_task_id_pattern_raises(self):
        from app.models.qa_models import FeedbackRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            FeedbackRequest(task_id="bad-id", question="질문", answer="답변", rating="up")


@pytest.mark.unit
class TestEventRequestValidation:
    def test_event_anonymous_allowed(self):
        from app.models.qa_models import EventRequest
        req = EventRequest(event_type="qa_opened", task_id=None)
        assert req.task_id is None

    def test_invalid_event_type_raises(self):
        from app.models.qa_models import EventRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            EventRequest(event_type="click", task_id="1-1-0")

    def test_task_id_pattern_validated(self):
        from app.models.qa_models import EventRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            EventRequest(event_type="qa_opened", task_id="bad-format")
