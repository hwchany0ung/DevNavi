"""
slowapi Rate Limiter 싱글턴.

main.py에서 app.state.limiter 로 등록하고,
각 라우터에서 @limiter.limit() 데코레이터로 사용.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
