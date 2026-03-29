# backend/tests/test_claude.py
import ast
import inspect
import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi import HTTPException


def test_no_inline_imports_in_claude_service():
    """claude_service.py의 모든 함수에 inline import가 없는지 AST로 검증."""
    import app.services.claude_service as m
    source = inspect.getsource(m)
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for child in ast.walk(node):
                if isinstance(child, (ast.Import, ast.ImportFrom)):
                    pytest.fail(
                        f"함수 내부 inline import 발견: "
                        f"{node.name}:{getattr(child, 'lineno', '?')} — "
                        f"모듈 상단으로 이동 필요"
                    )


@pytest.mark.asyncio
async def test_call_reroute_max_tokens_raises_422(mock_anthropic):
    """max_tokens 도달 시 HTTPException(422) 발생."""
    from app.services.claude_service import call_reroute

    mock_anthropic.messages.create.return_value = MagicMock(
        stop_reason="max_tokens",
        content=[MagicMock(text="incomplete json {")]
    )

    with pytest.raises(HTTPException) as exc_info:
        await call_reroute("system prompt", "user prompt")

    assert exc_info.value.status_code == 422
    assert "재탐색" in exc_info.value.detail


@pytest.mark.asyncio
async def test_call_reroute_success_returns_text(mock_anthropic):
    """정상 응답 시 content[0].text 반환."""
    from app.services.claude_service import call_reroute

    mock_anthropic.messages.create.return_value = MagicMock(
        stop_reason="end_turn",
        content=[MagicMock(text='{"months":[]}')]
    )

    result = await call_reroute("system prompt", "user prompt")
    assert result == '{"months":[]}'
