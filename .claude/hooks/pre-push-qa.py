#!/usr/bin/env python3
"""
PreToolUse 훅 — git push 전 QA 상태 검증
단위 테스트 실패 시 push 차단 (exit 2)
"""
import sys
import json
import subprocess

try:
    data = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
except Exception:
    data = {}

tool_name = data.get("tool_name", "")
tool_input = data.get("tool_input", {})
command = tool_input.get("command", "") if isinstance(tool_input, dict) else ""

# git push 명령어가 아니면 통과
if tool_name != "Bash" or "git push" not in command:
    sys.exit(0)

# force push는 별도 경고만
if "--force" in command or "-f" in command:
    print(json.dumps({
        "continue": True,
        "reason": "[pre-push-qa] WARNING: force push 감지. 신중하게 진행하세요."
    }))
    sys.exit(0)

# 백엔드 단위 테스트 실행
result = subprocess.run(
    ["python", "-m", "pytest", "tests/unit/", "-q", "-m", "unit", "--tb=no", "--no-header"],
    capture_output=True, text=True,
    cwd="backend"
)

if result.returncode not in (0, 5):  # 5 = no tests collected
    print(json.dumps({
        "continue": False,
        "reason": f"[pre-push-qa] 백엔드 단위 테스트 실패. push 차단.\n{result.stdout[-500:] if result.stdout else result.stderr[-300:]}"
    }))
    sys.exit(2)

# 프론트엔드 테스트
fe_result = subprocess.run(
    ["npm", "test", "--", "--run", "--reporter=dot"],
    capture_output=True, text=True,
    cwd="frontend",
    shell=True
)

if fe_result.returncode not in (0,):
    print(json.dumps({
        "continue": False,
        "reason": f"[pre-push-qa] 프론트엔드 테스트 실패. push 차단.\n{fe_result.stdout[-500:] if fe_result.stdout else ''}"
    }))
    sys.exit(2)

sys.exit(0)
