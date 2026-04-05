#!/usr/bin/env python3
"""
PreToolUse 훅 — 서브에이전트 권한 검증
CLAUDE.md 규칙: cto-lead는 직접 코딩 금지, ml-agent는 BE/FE 코드 금지
알려지지 않은 에이전트 타입 경고
"""
import sys
import json

KNOWN_AGENTS = {
    # Orchestrators
    "cto-lead", "manager-orchestrator", "team-orchestrator",
    # Impl
    "architect-designer", "frontend-specialist", "backend-specialist",
    "flutter-developer", "supabase-specialist", "figma-designer",
    "infra-specialist", "api-designer",
    # QA
    "code-reviewer", "bug-fixer", "web-qa-tester", "qa-orchestrator",
    "security-auditor", "mobile-qa-tester", "performance-analyst",
    # Ops
    "telegram-notifier", "docs-writer",
    # bkit built-in
    "frontend-architect", "enterprise-expert", "infra-architect",
    "product-manager", "qa-strategist", "gap-detector", "code-analyzer",
    "security-architect", "pm-lead", "pdca-iterator", "report-generator",
    "Explore", "Plan", "general-purpose",
}

try:
    data = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
except Exception:
    sys.exit(0)

tool_name = data.get("tool_name", "")
tool_input = data.get("tool_input", {})

if tool_name != "Agent":
    sys.exit(0)

subagent_type = tool_input.get("subagent_type", "") if isinstance(tool_input, dict) else ""

if subagent_type and subagent_type not in KNOWN_AGENTS:
    print(f"[subagent-verify] WARNING: 알 수 없는 에이전트 타입 '{subagent_type}'\n"
          f"  등록된 에이전트: {sorted(KNOWN_AGENTS)}\n"
          f"  의도한 에이전트가 맞는지 확인하세요.",
          file=sys.stderr)

# 경고만, 차단하지 않음 (exit 0)
sys.exit(0)
