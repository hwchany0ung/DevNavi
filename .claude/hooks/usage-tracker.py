#!/usr/bin/env python3
"""
PostToolUse 훅 — Agent 도구 사용량 추적
opus 에이전트(cto-lead, security-architect, gap-detector) 호출 횟수 기록
비용 모니터링 목적
"""
import sys
import json
import os
from datetime import datetime

OPUS_AGENTS = {"cto-lead", "security-architect", "gap-detector"}

try:
    data = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
except Exception:
    sys.exit(0)

tool_name = data.get("tool_name", "")
tool_input = data.get("tool_input", {})

if tool_name != "Agent":
    sys.exit(0)

subagent_type = tool_input.get("subagent_type", "") if isinstance(tool_input, dict) else ""

# 로그 파일 경로
log_path = os.path.join(
    os.path.dirname(__file__), "..", "..", ".bkit", "audit",
    f"{datetime.now().strftime('%Y-%m-%d')}.usage.jsonl"
)
log_path = os.path.normpath(log_path)

entry = {
    "ts": datetime.now().isoformat(),
    "agent": subagent_type,
    "model": "opus" if subagent_type in OPUS_AGENTS else "sonnet",
    "is_opus": subagent_type in OPUS_AGENTS
}

try:
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
except Exception:
    pass

sys.exit(0)
