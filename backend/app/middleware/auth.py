"""
Supabase JWT 인증 미들웨어 (PyJWT 직접 검증 — supabase 패키지 불필요).

사용법:
  from app.middleware.auth import require_user, optional_user

  @router.get("/protected")
  async def my_route(user: dict = Depends(require_user)):
      return {"user_id": user["id"]}
"""
from datetime import datetime, timezone
from typing import Optional

import jwt
from fastapi import Header, HTTPException, status

from app.core.config import settings
from app.core.supabase_client import get_supabase_client, sb_headers, sb_url


def _extract_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


def _verify_token(token: str) -> dict:
    """Supabase JWT 검증 → {"id": "...", "email": "..."} 반환."""
    if not settings.SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="인증 서비스 미설정 (SUPABASE_JWT_SECRET 필요)",
        )
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return {
            "id":    payload.get("sub", ""),
            "email": payload.get("email", ""),
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="토큰이 만료됐습니다.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰입니다.")


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
            pass  # 날짜 파싱 실패 시 통과 (데이터 이상)

    return user
