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
from datetime import datetime, timezone
from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException, status

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


def _verify_token(token: str) -> dict:
    """Supabase JWT 검증 → {"id": "...", "email": "..."} 반환.

    1) JWKS 엔드포인트로 ES256/HS256 자동 검증 시도 (ECC P-256 현재 키)
    2) 실패 시 Legacy HS256 Secret으로 폴백
    """
    # 1. JWKS 기반 검증 (ECC P-256 / ES256 지원)
    jwks_client = _get_jwks_client()
    if jwks_client:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
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
            pass  # Legacy HS256으로 폴백 (토큰 검증 실패만 허용)

    # 2. Legacy HS256 Secret 폴백
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
    return _verify_token(token)


async def optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Bearer JWT 선택. 없으면 None 반환 (공개 엔드포인트용)."""
    token = _extract_token(authorization)
    if not token:
        return None
    try:
        return _verify_token(token)
    except HTTPException:
        return None


async def require_premium(authorization: Optional[str] = Header(None)) -> dict:
    """구독 사용자만 허용. 미구독 또는 만료 시 402."""
    user = await require_user(authorization)
    if not settings.supabase_ready:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="DB 미설정")

    client = get_supabase_client()
    resp = await client.get(
        sb_url("user_profiles"),
        params={"id": f"eq.{user['id']}", "select": "is_premium,premium_expires_at"},
        headers=sb_headers(),
    )
    resp.raise_for_status()

    rows = resp.json()
    profile = rows[0] if rows else None

    if not profile or not profile.get("is_premium"):
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="프리미엄 구독이 필요합니다.")

    # 만료일 검증 — is_premium=True여도 만료됐으면 차단
    expires_at = profile.get("premium_expires_at")
    if expires_at:
        try:
            expires_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if expires_dt < datetime.now(timezone.utc):
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail="구독이 만료됐습니다. 갱신 후 이용해 주세요.",
                )
        except ValueError:
            # 날짜 형식 이상 → 만료로 간주해 차단 (통과 허용하면 만료 구독자 접근 가능)
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="구독 정보 오류가 있습니다. 고객지원에 문의해 주세요.",
            )

    return user
