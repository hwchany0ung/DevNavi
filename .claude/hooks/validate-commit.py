#!/usr/bin/env python3
"""
PreToolUse 훅 — git commit 메시지 컨벤션 검증
허용 prefix: feat|fix|chore|docs|refactor|test|style|perf|ci|revert
"""
import sys
import json
import re

ALLOWED_TYPES = {"feat", "fix", "chore", "docs", "refactor", "test", "style", "perf", "ci", "revert"}
COMMIT_PATTERN = re.compile(r'^(feat|fix|chore|docs|refactor|test|style|perf|ci|revert)(\(.+\))?: .{3,}', re.MULTILINE)

try:
    data = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
except Exception:
    data = {}

tool_name = data.get("tool_name", "")
tool_input = data.get("tool_input", {})
command = tool_input.get("command", "") if isinstance(tool_input, dict) else ""

# git commit 명령어가 아니면 통과
if tool_name != "Bash" or "git commit" not in command:
    sys.exit(0)

# --amend, --no-edit 등은 메시지 없으므로 통과
if "--no-edit" in command or "--amend" in command and "-m" not in command:
    sys.exit(0)

# -m 플래그에서 메시지 추출
msg_match = re.search(r'-m\s+["\']([^"\']+)["\']', command)
if not msg_match:
    # HEREDOC 패턴이거나 메시지 추출 불가 → 통과
    sys.exit(0)

commit_msg = msg_match.group(1)

if not COMMIT_PATTERN.match(commit_msg):
    print(json.dumps({
        "continue": False,
        "reason": (
            f"[validate-commit] 커밋 메시지 형식 오류: '{commit_msg[:60]}'\n"
            f"허용 형식: <type>(<scope>): <description>\n"
            f"허용 type: {', '.join(sorted(ALLOWED_TYPES))}\n"
            f"예시: feat(auth): 비밀번호 찾기 기능 추가"
        )
    }))
    sys.exit(2)

sys.exit(0)
