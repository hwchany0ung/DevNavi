from . import backend, frontend, cloud_devops, fullstack, data, ai_ml, security, ios_android, qa

ROLE_REFERENCE_MAP = {
    "backend":      backend.REFERENCE,
    "frontend":     frontend.REFERENCE,
    "cloud_devops": cloud_devops.REFERENCE,
    "fullstack":    fullstack.REFERENCE,
    "data":         data.REFERENCE,
    "ai_ml":        ai_ml.REFERENCE,
    "security":     security.REFERENCE,
    "ios_android":  ios_android.REFERENCE,
    "qa":           qa.REFERENCE,
}


async def get_reference(role: str) -> str:
    """DB 우선 조회, 없으면 정적 파일 fallback."""
    try:
        from app.core.supabase_client import get_supabase_client, sb_headers, sb_url
        client = get_supabase_client()
        resp = await client.get(
            sb_url("role_references"),
            headers=sb_headers(),
            params={"role": f"eq.{role}", "is_active": "eq.true",
                    "select": "content", "limit": "1"},
        )
        if resp.status_code == 200:
            rows = resp.json()
            if rows:
                return rows[0]["content"]
    except Exception:
        pass  # Supabase 미설정 또는 장애 -> fallback
    return ROLE_REFERENCE_MAP.get(role, "")
