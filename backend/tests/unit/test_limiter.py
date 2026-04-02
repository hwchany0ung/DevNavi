# backend/tests/unit/test_limiter.py
import pytest
from app.core.limiter import _parse_real_ip

pytestmark = pytest.mark.unit


def test_xff_uses_last_ip_not_first():
    """클라이언트가 fake IP를 앞에 주입해도 마지막 IP(CloudFront가 추가한 실제 IP)를 사용."""
    assert _parse_real_ip("1.1.1.1, 2.2.2.2, 3.3.3.3") == "3.3.3.3"


def test_xff_single_ip():
    """XFF에 IP가 하나만 있는 경우."""
    assert _parse_real_ip("1.2.3.4") == "1.2.3.4"


def test_xff_missing_falls_back_to_client_host():
    """XFF 헤더가 없으면 client_host fallback."""
    assert _parse_real_ip(None, client_host="127.0.0.1") == "127.0.0.1"


def test_xff_strips_whitespace():
    """IP 주변 공백 제거."""
    assert _parse_real_ip("  1.1.1.1 ,  2.2.2.2  ") == "2.2.2.2"


def test_xff_missing_no_client():
    """XFF도 없고 client도 없으면 'unknown' 반환."""
    assert _parse_real_ip(None, client_host=None) == "unknown"
