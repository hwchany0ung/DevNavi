#!/usr/bin/env python3
"""
Telegram 알림 훅 — Claude Code Stop 이벤트 시 자동 발송
환경변수 설정 필요:
  TELEGRAM_BOT_TOKEN  : BotFather에서 발급받은 봇 토큰
  TELEGRAM_CHAT_ID    : 알림받을 채팅 ID (개인 DM 또는 그룹)
"""
import os
import sys
import json
import urllib.request
import urllib.parse

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

if not BOT_TOKEN or not CHAT_ID:
    sys.exit(0)  # 토큰 미설정 시 조용히 종료

try:
    hook_data = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
except Exception:
    hook_data = {}

session_id = hook_data.get("session_id", "")
stop_reason = hook_data.get("stop_reason", "end_turn")

# stop_reason이 error인 경우만 별도 표시
if stop_reason == "error":
    status_icon = "❌"
    status_text = "오류 발생"
elif stop_reason == "end_turn":
    status_icon = "✅"
    status_text = "작업 완료"
else:
    status_icon = "⏹"
    status_text = f"중단 ({stop_reason})"

message = (
    f"{status_icon} *DevNavi Claude Code*\n"
    f"상태: {status_text}\n"
    f"세션: `{session_id[:8] if session_id else 'N/A'}`"
)

url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
payload = json.dumps({
    "chat_id": CHAT_ID,
    "text": message,
    "parse_mode": "Markdown"
}).encode("utf-8")

req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
try:
    urllib.request.urlopen(req, timeout=5)
except Exception:
    pass  # 알림 실패가 작업 흐름을 막지 않도록

sys.exit(0)
