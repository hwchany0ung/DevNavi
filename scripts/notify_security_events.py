"""
Telegram 보안 알람 스크립트.

Design Ref: security-monitoring-infra.design.md §3
Plan SC: GitHub Actions 5분 Cron으로 미알람 이벤트 Telegram 발송

환경변수:
  SUPABASE_URL          — Supabase 프로젝트 URL
  SUPABASE_SERVICE_KEY  — service_role 키 (RLS 우회)
  TELEGRAM_BOT_TOKEN    — Telegram Bot API 토큰
  TELEGRAM_CHAT_ID      — 알람 수신 채팅 ID

동작:
  1. notified_at IS NULL 이벤트 조회 (최대 100건)
  2. 이벤트 없으면 exit 0 (조용히 종료)
  3. 있으면 집계 → Telegram 발송 → notified_at 업데이트
"""
import os
import sys
from collections import Counter
from datetime import datetime, timezone

import httpx


def main():
    # ── 환경변수 로드 ────────────────────────────────────────────
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    telegram_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    telegram_chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")

    if not all([supabase_url, supabase_key, telegram_token, telegram_chat_id]):
        print("[security-alert] 환경변수 누락 — 스킵")
        sys.exit(0)  # CI 실패 방지

    rest_url = f"{supabase_url}/rest/v1"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    # ── 1. 미알람 이벤트 조회 ────────────────────────────────────
    resp = httpx.get(
        f"{rest_url}/security_events",
        params={
            "select": "id,event_type,ip,path,method,status_code,created_at",
            "notified_at": "is.null",
            "order": "created_at.desc",
            "limit": "100",
        },
        headers=headers,
        timeout=15,
    )

    if resp.status_code != 200:
        print(f"[security-alert] Supabase 조회 실패: {resp.status_code} {resp.text[:200]}")
        sys.exit(1)

    events = resp.json()

    # ── 2. 이벤트 없으면 조용히 종료 ─────────────────────────────
    if not events:
        print("[security-alert] 새 이벤트 없음 — 종료")
        sys.exit(0)

    # ── 3. 집계 ──────────────────────────────────────────────────
    type_counts = Counter(e["event_type"] for e in events)
    ip_counts = Counter(e["ip"] for e in events)
    top_ips = ip_counts.most_common(5)

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # ── 4. 메시지 생성 ───────────────────────────────────────────
    lines = [
        f"\U0001F6A8 [DevNavi 보안 알람] {now_str}",
        "",
        "\U0001F4CA 최근 5분 감지 이벤트",
    ]
    type_labels = {
        "rate_limit_exceeded": "Rate limit 초과",
        "auth_failure": "인증 실패",
    }
    for etype, count in type_counts.items():
        label = type_labels.get(etype, etype)
        lines.append(f"- {label}: {count}건")

    if top_ips:
        lines.append("")
        lines.append("\U0001F50D 주요 IP")
        for ip, count in top_ips:
            lines.append(f"- {ip} ({count}건)")

    lines.append("")
    lines.append("관리자 대시보드에서 확인하세요.")

    message = "\n".join(lines)

    # ── 5. Telegram 발송 ─────────────────────────────────────────
    tg_resp = httpx.post(
        f"https://api.telegram.org/bot{telegram_token}/sendMessage",
        json={
            "chat_id": telegram_chat_id,
            "text": message,
            "parse_mode": "HTML",
        },
        timeout=10,
    )

    if tg_resp.status_code != 200:
        print(f"[security-alert] Telegram 발송 실패: {tg_resp.status_code} {tg_resp.text[:200]}")
        # notified_at 업데이트 하지 않음 — 다음 주기에 재시도
        sys.exit(1)

    print(f"[security-alert] Telegram 발송 완료 ({len(events)}건)")

    # ── 6. notified_at 업데이트 ──────────────────────────────────
    event_ids = [e["id"] for e in events]
    now_iso = datetime.now(timezone.utc).isoformat()

    # Supabase REST API: id IN (...) 필터로 일괄 업데이트
    # PATCH /security_events?id=in.(id1,id2,...)
    id_filter = ",".join(event_ids)
    patch_resp = httpx.patch(
        f"{rest_url}/security_events",
        params={"id": f"in.({id_filter})"},
        json={"notified_at": now_iso},
        headers={**headers, "Prefer": "return=minimal"},
        timeout=15,
    )

    if patch_resp.status_code not in (200, 204):
        print(f"[security-alert] notified_at 업데이트 실패: {patch_resp.status_code}")
        # 다음 주기에 중복 발송될 수 있으나, 누락보다 안전
    else:
        print(f"[security-alert] notified_at 업데이트 완료 ({len(event_ids)}건)")


if __name__ == "__main__":
    main()
