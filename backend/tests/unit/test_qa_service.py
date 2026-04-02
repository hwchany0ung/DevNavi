# backend/tests/unit/test_qa_service.py
# QA 서비스 단위 테스트
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

pytestmark = pytest.mark.unit


# ── build_system_prompt ─────────────────────────────────────────────────

class TestBuildSystemPrompt:
    """build_system_prompt: 컨텍스트 정보가 프롬프트에 올바르게 주입되는지 검증."""

    def _make_context(self, **kwargs):
        from app.models.qa_models import QATaskContext
        defaults = dict(
            job_type="backend",
            month=2,
            week=3,
            category="기초",
            task_name="Docker 네트워킹 설정하기",
        )
        defaults.update(kwargs)
        return QATaskContext(**defaults)

    def test_all_fields_injected(self):
        """모든 컨텍스트 필드가 시스템 프롬프트에 포함된다."""
        from app.services.qa_service import build_system_prompt
        ctx = self._make_context()
        prompt = build_system_prompt(ctx)

        assert "backend" in prompt
        assert "2개월차" in prompt
        assert "3주차" in prompt
        assert "기초" in prompt
        assert "Docker 네트워킹 설정하기" in prompt

    def test_job_type_appears_twice(self):
        """job_type은 답변 규칙에서도 참조되므로 2회 이상 등장해야 한다."""
        from app.services.qa_service import build_system_prompt
        ctx = self._make_context(job_type="frontend")
        prompt = build_system_prompt(ctx)

        assert prompt.count("frontend") >= 2

    def test_different_context_produces_different_prompt(self):
        """다른 컨텍스트는 다른 프롬프트를 생성한다."""
        from app.services.qa_service import build_system_prompt
        ctx_a = self._make_context(job_type="backend", month=1)
        ctx_b = self._make_context(job_type="frontend", month=6)

        assert build_system_prompt(ctx_a) != build_system_prompt(ctx_b)


# ── increment_and_check_qa_usage ─────────────────────────────────────────

class TestIncrementAndCheckQaUsage:
    """increment_and_check_qa_usage: Supabase RPC 호출 결과 처리."""

    @pytest.fixture
    def mock_supabase_ready(self):
        with patch("app.services.qa_service.settings") as mock_settings:
            mock_settings.supabase_ready = True
            mock_settings.SUPABASE_URL = "https://test.supabase.co"
            mock_settings.SUPABASE_SERVICE_KEY = "test-key"
            yield mock_settings

    @pytest.mark.asyncio
    async def test_allowed_when_under_limit(self, mock_supabase_ready):
        """일일/월간 한도 이하이면 allowed=True를 반환한다."""
        from app.services.qa_service import increment_and_check_qa_usage

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "allowed": True,
            "daily_count": 5,
            "monthly_count": 10,
            "daily_limit": 30,
            "monthly_limit": 100,
        }

        with patch("app.services.qa_service.get_supabase_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_get_client.return_value = mock_client

            result = await increment_and_check_qa_usage("user-abc")

        assert result["allowed"] is True
        assert result["daily_count"] == 5

    @pytest.mark.asyncio
    async def test_not_allowed_when_daily_limit_exceeded(self, mock_supabase_ready):
        """일일 한도 초과 시 allowed=False를 반환한다."""
        from app.services.qa_service import increment_and_check_qa_usage

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "allowed": False,
            "daily_count": 31,
            "monthly_count": 31,
            "daily_limit": 30,
            "monthly_limit": 100,
        }

        with patch("app.services.qa_service.get_supabase_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_get_client.return_value = mock_client

            result = await increment_and_check_qa_usage("user-abc")

        assert result["allowed"] is False

    @pytest.mark.asyncio
    async def test_raises_runtime_error_when_supabase_not_ready(self):
        """Supabase 미설정 시 RuntimeError를 발생시킨다."""
        from app.services.qa_service import increment_and_check_qa_usage

        with patch("app.services.qa_service.settings") as mock_settings:
            mock_settings.supabase_ready = False
            with pytest.raises(RuntimeError):
                await increment_and_check_qa_usage("user-abc")

    @pytest.mark.asyncio
    async def test_allows_on_rpc_error(self, mock_supabase_ready):
        """RPC 실패(5xx) 시 서비스 가용성 우선으로 allowed=True를 반환한다."""
        from app.services.qa_service import increment_and_check_qa_usage

        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"

        with patch("app.services.qa_service.get_supabase_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_get_client.return_value = mock_client

            result = await increment_and_check_qa_usage("user-abc")

        assert result["allowed"] is True


# ── verify_task_ownership ────────────────────────────────────────────────

class TestVerifyTaskOwnership:
    """verify_task_ownership: task_id 소유권 검증."""

    @pytest.fixture
    def mock_supabase_ready(self):
        with patch("app.services.qa_service.settings") as mock_settings:
            mock_settings.supabase_ready = True
            mock_settings.SUPABASE_URL = "https://test.supabase.co"
            mock_settings.SUPABASE_SERVICE_KEY = "test-key"
            yield mock_settings

    def _make_roadmap_data(self):
        return {
            "months": [
                {
                    "month": 1,
                    "weeks": [
                        {
                            "week": 1,
                            "tasks": [
                                {"name": "태스크 A"},
                                {"name": "태스크 B"},
                            ],
                        }
                    ],
                }
            ]
        }

    @pytest.mark.asyncio
    async def test_returns_true_for_valid_task(self, mock_supabase_ready):
        """유효한 task_id로 소유권 조회 시 True를 반환한다."""
        from app.services.qa_service import verify_task_ownership

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [{"data": self._make_roadmap_data()}]

        with patch("app.services.qa_service.get_supabase_client") as mock_get_client, \
             patch("app.services.qa_service.sb_url", return_value="https://test.supabase.co/rest/v1/roadmaps"), \
             patch("app.services.qa_service.sb_headers", return_value={}):
            mock_client = MagicMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_get_client.return_value = mock_client

            result = await verify_task_ownership("user-abc", "1-1-0")

        assert result is True

    @pytest.mark.asyncio
    async def test_returns_false_for_out_of_range_task_index(self, mock_supabase_ready):
        """task_index가 범위 밖이면 False를 반환한다."""
        from app.services.qa_service import verify_task_ownership

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [{"data": self._make_roadmap_data()}]

        with patch("app.services.qa_service.get_supabase_client") as mock_get_client, \
             patch("app.services.qa_service.sb_url", return_value="https://test.supabase.co/rest/v1/roadmaps"), \
             patch("app.services.qa_service.sb_headers", return_value={}):
            mock_client = MagicMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_get_client.return_value = mock_client

            result = await verify_task_ownership("user-abc", "1-1-99")

        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_when_no_active_roadmap(self, mock_supabase_ready):
        """활성 로드맵이 없으면 False를 반환한다."""
        from app.services.qa_service import verify_task_ownership

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = []

        with patch("app.services.qa_service.get_supabase_client") as mock_get_client, \
             patch("app.services.qa_service.sb_url", return_value="https://test.supabase.co/rest/v1/roadmaps"), \
             patch("app.services.qa_service.sb_headers", return_value={}):
            mock_client = MagicMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_get_client.return_value = mock_client

            result = await verify_task_ownership("other-user", "1-1-0")

        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_for_invalid_task_id_format(self, mock_supabase_ready):
        """task_id 형식이 잘못되면 False를 반환한다."""
        from app.services.qa_service import verify_task_ownership

        result = await verify_task_ownership("user-abc", "invalid-format")
        assert result is False

    @pytest.mark.asyncio
    async def test_returns_true_when_supabase_not_ready(self):
        """Supabase 미설정(dev 환경) 시 True를 반환한다 (접근 허용)."""
        from app.services.qa_service import verify_task_ownership

        with patch("app.services.qa_service.settings") as mock_settings:
            mock_settings.supabase_ready = False
            result = await verify_task_ownership("user-abc", "1-1-0")

        assert result is True


# ── QARequest 모델 검증 ───────────────────────────────────────────────────

class TestQAModels:
    """QARequest, QAMessage, QATaskContext Pydantic 검증."""

    def test_valid_request(self):
        """유효한 QARequest 생성."""
        from app.models.qa_models import QARequest, QATaskContext
        req = QARequest(
            task_id="1-1-0",
            question="이게 뭔가요?",
            task_context=QATaskContext(
                job_type="backend",
                month=1,
                week=1,
                category="기초",
                task_name="Docker 설정",
            ),
        )
        assert req.task_id == "1-1-0"

    def test_question_max_length(self):
        """question이 200자 초과 시 ValidationError."""
        from pydantic import ValidationError
        from app.models.qa_models import QARequest, QATaskContext

        with pytest.raises(ValidationError):
            QARequest(
                task_id="1-1-0",
                question="x" * 201,
                task_context=QATaskContext(
                    job_type="backend", month=1, week=1,
                    category="기초", task_name="태스크",
                ),
            )

    def test_invalid_task_id_pattern(self):
        """task_id가 패턴 불일치 시 ValidationError."""
        from pydantic import ValidationError
        from app.models.qa_models import QARequest, QATaskContext

        with pytest.raises(ValidationError):
            QARequest(
                task_id="abc-def",
                question="질문",
                task_context=QATaskContext(
                    job_type="backend", month=1, week=1,
                    category="기초", task_name="태스크",
                ),
            )

    def test_messages_max_length(self):
        """messages가 10개 초과 시 ValidationError."""
        from pydantic import ValidationError
        from app.models.qa_models import QARequest, QATaskContext, QAMessage

        with pytest.raises(ValidationError):
            QARequest(
                task_id="1-1-0",
                question="질문",
                task_context=QATaskContext(
                    job_type="backend", month=1, week=1,
                    category="기초", task_name="태스크",
                ),
                messages=[QAMessage(role="user", content="msg") for _ in range(11)],
            )

    def test_month_range_validation(self):
        """month가 1~12 범위 벗어나면 ValidationError."""
        from pydantic import ValidationError
        from app.models.qa_models import QATaskContext

        with pytest.raises(ValidationError):
            QATaskContext(
                job_type="backend", month=13, week=1,
                category="기초", task_name="태스크",
            )

    def test_week_range_validation(self):
        """week가 1~4 범위 벗어나면 ValidationError."""
        from pydantic import ValidationError
        from app.models.qa_models import QATaskContext

        with pytest.raises(ValidationError):
            QATaskContext(
                job_type="backend", month=1, week=5,
                category="기초", task_name="태스크",
            )
