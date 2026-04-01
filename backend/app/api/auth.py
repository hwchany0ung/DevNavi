"""
인증 관련 API 라우터.

현재 엔드포인트:
  POST /auth/consent — PIPA 약관 동의 이력 서버 기록
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.supabase_client import get_supabase_client, sb_headers, sb_url
from app.core.config import settings
from app.middleware.auth import require_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class ConsentRequest(BaseModel):
    agreed_terms_at:   datetime         # ISO 8601 타임스탬프 — Pydantic이 형식 검증 (잘못된 값 → 422)
    agreed_privacy_at: datetime         # ISO 8601 타임스탬프 — Pydantic이 형식 검증 (잘못된 값 → 422)
    consent_version:   str = "2026-01-01"


def _get_client_ip(request: Request) -> Optional[str]:
    """CloudFront X-Forwarded-For에서 실제 클라이언트 IP 추출.

    CloudFront는 실제 뷰어 IP를 XFF 헤더 마지막에 추가하므로
    split(",")[-1]을 사용해야 클라이언트 주입 IP를 무시할 수 있음.
    """
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else None


@router.post("/consent", status_code=201)
async def record_consent(
    body: ConsentRequest,
    request: Request,
    user: dict = Depends(require_user),
):
    """PIPA 준수 — 약관 동의 이력을 consent_records 테이블에 기록.

    - 서비스 롤(service_key)로 INSERT → RLS 우회
    - 동일 user_id 중복 시 최신 동의로 upsert
    - IP는 CloudFront X-Forwarded-For 기준으로 서버 측에서 기록
    """
    if not settings.supabase_ready:
        raise HTTPException(
            status_code=503,
            detail={"message": "DB 미설정"},
        )

    client     = get_supabase_client()
    ip_address = _get_client_ip(request)
    user_agent = request.headers.get("User-Agent", "")[:512]  # 길이 제한

    payload = {
        "user_id":           user["id"],
        "agreed_terms_at":   body.agreed_terms_at.isoformat(),
        "agreed_privacy_at": body.agreed_privacy_at.isoformat(),
        "consent_version":   body.consent_version,
        "ip_address":        ip_address,
        "user_agent":        user_agent,
    }

    try:
        resp = await client.post(
            sb_url("consent_records"),
            headers={
                # BC-3: sb_headers(prefer=...)와 수동 Prefer를 동시 사용하면 덮어쓰기됨
                # 올바른 값을 직접 전달하여 중복 방지
                **sb_headers(prefer="resolution=merge-duplicates,return=minimal"),
            },
            json=payload,
        )
        if resp.status_code not in (200, 201):
            logger.error(
                "consent_records 저장 실패 (user=%s, status=%d): %s",
                user["id"], resp.status_code, resp.text[:200],
            )
            raise HTTPException(
                status_code=502,
                detail={"message": "동의 이력 저장에 실패했습니다. 잠시 후 다시 시도해주세요."},
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("consent_records 저장 중 예외 (user=%s): %s", user["id"], e)
        raise HTTPException(
            status_code=500,
            detail={"message": "동의 이력 저장 중 오류가 발생했습니다."},
        )

    logger.info("consent 기록 완료 (user=%s, version=%s)", user["id"], body.consent_version)
    return {"ok": True}
