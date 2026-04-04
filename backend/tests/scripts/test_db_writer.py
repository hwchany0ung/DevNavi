import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
from unittest.mock import patch, MagicMock
from scripts.db_writer import get_next_version, build_diff


def test_get_next_version_first():
    with patch("scripts.db_writer.sb") as mock_sb:
        mock_sb.get.return_value = []
        assert get_next_version("backend") == 1


def test_get_next_version_increments():
    with patch("scripts.db_writer.sb") as mock_sb:
        mock_sb.get.return_value = [{"version": 3}]
        assert get_next_version("backend") == 4


def test_build_diff_detects_changes():
    old = "■ 필수 기술\n- Java, Spring"
    new = "■ 필수 기술\n- Java, Spring, Kotlin"
    diff = build_diff(old, new)
    assert "Kotlin" in diff


def test_build_diff_no_changes():
    text = "■ 필수 기술\n- Java, Spring"
    diff = build_diff(text, text)
    assert diff == "(변경 없음)"
