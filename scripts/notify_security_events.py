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
  3. 공격 패턴 탐지 (동일 IP 10건 이상 → 🚨 HIGH SEVERITY)
  4. 있으면 집계 → Telegram 발송 → notified_at 업데이트
"""
import os
import sys
from collections import Counter
from datetime import datetime, timezone

import httpx

# 동일 IP에서 이 수 이상의 이벤트 → HIGH SEVERITY 경보
HIGH_SEVERITY_IP_THRESHOLD = 10
# 전체 이벤트가 이 수 이상 → 대규모 공격 경보
HIGH_SEVERITY_TOTAL_THRESHOLD = 50


def _send_telegram(token: str, chat_id: str, text: str) -> bool:
    try:
        resp = httpx.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
            timeout=10,
        )
        return resp.status_code == 200
    except Exception as e:
        print(f"[security-alert] Telegram 발송 예외: {e}")
        return False


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

    # ── 3. 집계 및 공격 패턴 탐지 ───────────────────────────────
    type_counts = Counter(e["event_type"] for e in events)
    ip_counts = Counter(e["ip"] for e in events)
    top_ips = ip_counts.most_common(5)

    # 공격 패턴: 동일 IP 10건 이상 or 전체 50건 이상
    attack_ips = [(ip, cnt) for ip, cnt in ip_counts.items() if cnt >= HIGH_SEVERITY_IP_THRESHOLD]
    is_high_severity = bool(attack_ips) or len(events) >= HIGH_SEVERITY_TOTAL_THRESHOLD

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # ── 4. HIGH SEVERITY 경보 (별도 메시지로 먼저 발송) ──────────
    if is_high_severity:
        alert_lines = [
            "\U0001F6A8\U0001F6A8 [DevNavi 긴급 보안 경보] \U0001F6A8\U0001F6A8",
            f"시각: {now_str}",
            "",
        ]
        if attack_ips:
            alert_lines.append(f"\U0001F534 단일 IP 집중 공격 감지 ({HIGH_SEVERITY_IP_THRESHOLD}건 이상)")
            for ip, cnt in sorted(attack_ips, key=lambda x: -x[1]):
                alert_lines.append(f"  IP: {ip} → {cnt}건")
        if len(events) >= HIGH_SEVERITY_TOTAL_THRESHOLD:
            alert_lines.append(f"\U0001F534 대규모 이벤트 감지: {len(events)}건 / 5분")
        alert_lines.extend([
            "",
            "\U0001F6E1 즉시 조치 방법:",
            "1. Lambda 콘솔 → 환경변수 → MAINTENANCE_MODE=true 저장",
            "2. CloudFront → WAF → 해당 IP 차단",
            "3. Supabase → 해당 유저 비활성화",
        ])
        high_msg = "\n".join(alert_lines)
        ok = _send_telegram(telegram_token, telegram_chat_id, high_msg)
        if not ok:
            print("[security-alert] HIGH SEVERITY Telegram 발송 실패")

    # ── 5. 일반 집계 메시지 생성 ─────────────────────────────────
    type_labels = {
        "rate_limit_exceeded": "Rate limit 초과",
        "auth_failure": "인증 실패",
    }
    lines = [
        f"\U0001F4CA [DevNavi 보안 리포트] {now_str}",
        f"총 {len(events)}건",
        "",
        "이벤트 유형:",
    ]
    for etype, count in type_counts.most_common():
        label = type_labels.get(etype, etype)
        lines.append(f"- {label}: {count}건")

    if top_ips:
        lines.append("")
        lines.append("\U0001F50D 주요 IP (상위 5개):")
        for ip, count in top_ips:
            marker = " \U0001F534" if count >= HIGH_SEVERITY_IP_THRESHOLD else ""
            lines.append(f"- {ip}: {count}건{marker}")

    lines.append("")
    lines.append("관리자 대시보드에서 전체 내역을 확인하세요.")

    message = "\n".join(lines)

    # ── 6. Telegram 발송 ─────────────────────────────────────────
    ok = _send_telegram(telegram_token, telegram_chat_id, message)
    if not ok:
        print(f"[security-alert] Telegram 발송 실패 — notified_at 업데이트 스킵")
        sys.exit(1)

    print(f"[security-alert] Telegram 발송 완료 ({len(events)}건, high_severity={is_high_severity})")

    # ── 7. notified_at 업데이트 ──────────────────────────────────
    event_ids = [e["id"] for e in events]
    now_iso = datetime.now(timezone.utc).isoformat()

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
    else:
        print(f"[security-alert] notified_at 업데이트 완료 ({len(event_ids)}건)")


if __name__ == "__main__":
    main()
