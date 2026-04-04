"""스크립트 전용 동기 Supabase REST 클라이언트."""
import httpx
from scripts.config import SUPABASE_URL, SUPABASE_SERVICE_KEY


def _headers(prefer: str = "return=representation") -> dict:
    return {
        "apikey":        SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        prefer,
    }


def get(table: str, params: dict | None = None) -> list[dict]:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = httpx.get(url, headers=_headers(), params=params, timeout=15)
    r.raise_for_status()
    return r.json()


def post(table: str, data: dict | list) -> dict | list:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = httpx.post(url, headers=_headers(), json=data, timeout=15)
    r.raise_for_status()
    return r.json()


def patch(table: str, params: dict, data: dict) -> dict | list:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = httpx.patch(url, headers=_headers(), params=params, json=data, timeout=15)
    r.raise_for_status()
    return r.json()


def delete(table: str, params: dict) -> list:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = httpx.delete(url, headers=_headers(), params=params, timeout=15)
    r.raise_for_status()
    return r.json() if r.text else []
