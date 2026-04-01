"""
Supabase JWT 인증 미들웨어 — JWKS 기반 (ES256/HS256 자동 지원).

Supabase가 ECC (P-256) 키로 토큰을 서명하는 경우 ES256으로,
Legacy HS256 Secret이 있는 경우 폴백으로 검증.

사용법:
  from app.middleware.auth import require_user, optional_user

  @router.get("/protected")
  async def my_route(user: dict = Depends(require_user)):
      return {"user_id": user["id"]}
"""
import logging
from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException, status

logger = logging.getLogger(__name__)

from app.core.config import settings
from app.core.supabase_client import get_supabase_client, sb_headers, sb_url

# JWKS 클라이언트 (모듈 초기화 시 1회 생성, 키 자동 캐싱)
_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client() -> Optional[PyJWKClient]:
    global _jwks_client
    if _jwks_client is None and settings.SUPABASE_URL:
        jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


def _extract_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


async def _verify_token_async(token: str) -> dict:
    """Supabase JWT 검증 → {"id": "...", "email": "..."} 반환 (비동기 래퍼).

    PyJWKClient.get_signing_key_from_jwt 는 동기 HTTP 요청을 수행하므로
    asyncio.to_thread로 감싸서 이벤트 루프 블로킹을 방지.
    """
    import asyncio
    return await asyncio.to_thread(_verify_token_sync, token)


def _verify_token_sync(token: str) -> dict:
    """Supabase JWT 검증 → {"id": "...", "email": "..."} 반환 (동기).

    1) JWKS 엔드포인트로 ES256/HS256 자동 검증 시도 (ECC P-256 현재 키)
    2) 실패 시 Legacy HS256 Secret으로 폴백
    """
    # 1. JWKS 기반 검증 (ECC P-256 / ES256 지원)
    jwks_client = _get_jwks_client()
    jwks_key_found = False  # BI-1: signing key 획득 성공 여부 추적
    if jwks_client:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            jwks_key_found = True  # signing key 획득 성공 → 이후 HS256 폴백 차단
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256", "HS256"],
                audience="authenticated",
            )
            sub = payload.get("sub", "")
            if not sub:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="유효하지 않은 토큰입니다. (sub 누락)",
                )
            return {
                "id":    sub,
                "email": payload.get("email", ""),
            }
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="토큰이 만료됐습니다.",
            )
        except jwt.InvalidTokenError:
            if jwks_key_found:
                # BI-1: signing key를 정상 획득했는데 토큰 검증 실패
                # → 위조된 토큰이므로 HS256 폴백 없이 즉시 거부 (다운그레이드 공격 차단)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="유효하지 않은 토큰입니다.",
                )
            pass  # signing key 획득 실패 시에만 Legacy HS256 폴백 허용
        except Exception as e:
            # PyJWKClientConnectionError, PyJWKClientError 등 JWKS 네트워크/조회 오류
            # jwt.InvalidTokenError를 상속하지 않아 위 except에서 잡히지 않음 → 폴백
            logger.warning("JWKS 검증 실패, HS256 폴백 시도: %s", e)

    # 2. Legacy HS256 Secret 폴백 (JWKS 네트워크 장애 시에만 도달)
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
            sub = payload.get("sub", "")
            if not sub:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="유효하지 않은 토큰입니다. (sub 누락)",
                )
            return {
                "id":    sub,
                "email": payload.get("email", ""),
            }
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="토큰이 만료됐습니다.",
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않은 토큰입니다.",
            )

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="인증 서비스 미설정 (SUPABASE_URL 또는 SUPABASE_JWT_SECRET 필요)",
    )


async def require_user(authorization: Optional[str] = Header(None)) -> dict:
    """Bearer JWT 필수. 없거나 유효하지 않으면 401."""
    token = _extract_token(authorization)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증이 필요합니다.")
    return await _verify_token_async(token)


async def optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Bearer JWT 선택. 없으면 None 반환 (공개 엔드포인트용).

    토큰이 있지만 유효하지 않은 경우(401) → None 반환 (미인증으로 처리).
    JWKS/인증 서비스 장애(503) → 예외 전파 (silent 허용 안 됨 — M2).
    """
    token = _extract_token(authorization)
    if not token:
        return None
    try:
        return await _verify_token_async(token)
    except HTTPException as e:
        if e.status_code == status.HTTP_503_SERVICE_UNAVAILABLE:
            raise  # 인증 인프라 장애 — 요청 차단
        return None  # 401: 토큰 무효/만료 — 미인증으로 처리


async def require_admin(authorization: Optional[str] = Header(None)) -> dict:
    """관리자 전용. JWT 검증 후 DB에서 role='admin' 확인.

    보안 설계:
      - 비인가 접근 시 403이 아닌 404 반환 (라우트 존재 자체를 숨김)
      - role 판단은 반드시 DB에서 (JWT 커스텀 클레임 사용 안 함)
    """
    user = await require_user(authorization)
    if not settings.supabase_ready:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    client = get_supabase_client()
    resp = await client.get(
        sb_url("users"),
        params={"id": f"eq.{user['id']}", "select": "role"},
        headers=sb_headers(),
    )

    try:
        rows = resp.json() if resp.status_code == 200 else []
    except Exception:
        logger.warning("require_admin: Supabase 비-JSON 응답 (status=%d)", resp.status_code)
        rows = []
    role = rows[0].get("role", "user") if rows else "user"

    if role != "admin":
        # 존재를 드러내지 않기 위해 404 반환
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    return {**user, "role": role}


# require_premium: Phase 6 결제 연동 시 구현 예정
# 현재 미사용 — 구현 필요 시 user_profiles.is_premium + premium_expires_at 기반으로 작성
