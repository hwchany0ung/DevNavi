"""
slowapi Rate Limiter 싱글턴.

main.py에서 app.state.limiter 로 등록하고,
각 라우터에서 @limiter.limit() 데코레이터로 사용.
"""
from starlette.requests import Request

from slowapi import Limiter


def _parse_real_ip(xff: str | None, client_host: str | None = "unknown") -> str:
    """XFF 헤더에서 실제 클라이언트 IP 반환.

    CloudFront는 요청을 전달할 때 X-Forwarded-For 헤더의 맨 끝에
    실제 viewer IP를 append한다. 클라이언트가 앞부분을 조작해도
    마지막 항목은 CloudFront가 직접 추가한 값이므로 스푸핑 불가.

    참고: split(",")[0] 사용 시 클라이언트가 'X-Forwarded-For: fake'를
    전송하면 fake IP가 rate-limit key가 되어 bypass 가능.
    """
    if xff:
        return xff.split(",")[-1].strip()
    return client_host if client_host else "unknown"


def _get_real_ip(request: Request) -> str:
    """slowapi key_func — X-Forwarded-For 마지막 IP 사용."""
    return _parse_real_ip(
        request.headers.get("X-Forwarded-For"),
        request.client.host if request.client else None,
    )


limiter = Limiter(key_func=_get_real_ip)
