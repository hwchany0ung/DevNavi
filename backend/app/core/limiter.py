"""
slowapi Rate Limiter 싱글턴.

main.py에서 app.state.limiter 로 등록하고,
각 라우터에서 @limiter.limit() 데코레이터로 사용.

CloudFront 뒤에 배포되므로 REMOTE_ADDR 대신 X-Forwarded-For 첫 번째 IP를 사용.
X-Forwarded-For 없으면 REMOTE_ADDR로 폴백.
"""
from starlette.requests import Request
from slowapi import Limiter


def _get_real_ip(request: Request) -> str:
    """CloudFront → Lambda 환경에서 실제 클라이언트 IP 반환.

    X-Forwarded-For: <client>, <proxy1>, <proxy2>
    첫 번째 값이 실제 클라이언트 IP.
    """
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=_get_real_ip)
