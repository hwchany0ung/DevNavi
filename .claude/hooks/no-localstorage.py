#!/usr/bin/env python3
"""
PreToolUse 훅 — localStorage 직접 사용 차단
PIPA 컴플라이언스: 민감 데이터를 localStorage에 저장하는 코드 차단
허용 예외: consent_saved (PIPA 동의 상태), theme (테마 설정)
"""
import sys
import json
import re

ALLOWED_KEYS = {"consent_saved", "theme", "sb-", "supabase"}
SENSITIVE_PATTERNS = [
    r"localStorage\.setItem\(['\"](?!consent_saved|theme|sb-)[^'\"]*['\"]",
    r"localStorage\[(['\"])(?!consent_saved|theme|sb-).*\1\]\s*=",
]

try:
    data = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
except Exception:
    data = {}

tool_name = data.get("tool_name", "")
tool_input = data.get("tool_input", {})

if tool_name not in ("Write", "Edit", "MultiEdit"):
    sys.exit(0)

# 검사할 내용 추출
content_to_check = ""
if tool_name == "Write":
    content_to_check = tool_input.get("content", "")
elif tool_name == "Edit":
    content_to_check = tool_input.get("new_string", "")
elif tool_name == "MultiEdit":
    edits = tool_input.get("edits", [])
    content_to_check = " ".join(e.get("new_string", "") for e in edits)

# JS/JSX 파일 아닐 경우 패스
file_path = tool_input.get("file_path", "")
if not any(file_path.endswith(ext) for ext in (".js", ".jsx", ".ts", ".tsx")):
    sys.exit(0)

# 위험 패턴 검사
violations = []
for pattern in SENSITIVE_PATTERNS:
    matches = re.findall(pattern, content_to_check)
    violations.extend(matches)

if violations:
    print(json.dumps({
        "continue": False,
        "reason": (
            f"[no-localstorage] localStorage 직접 사용 감지: {violations[:3]}\n"
            "허용 키: consent_saved, theme, sb-*\n"
            "민감 데이터는 Supabase 세션 또는 메모리 상태로 관리하세요."
        )
    }))
    sys.exit(2)

sys.exit(0)
