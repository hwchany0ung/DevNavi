# /cc-sync

Claude Code 에이전트·훅·스킬·설정을 백업하거나 복원합니다.

## 사용법
```
/cc-sync backup    # 현재 설정 백업
/cc-sync restore   # 백업에서 복원
/cc-sync status    # 현재 구성 요약 출력
/cc-sync diff      # 마지막 백업과 현재 diff
```

## backup — 현재 구성 백업

백업 대상:
```
.claude/agents/          → 프로젝트 에이전트 (6+6개)
.claude/commands/        → 커스텀 커맨드
.claude/hooks/           → 훅 스크립트
.claude/settings.json    → 프로젝트 설정
~/.claude/settings.json  → 글로벌 설정 (enabledPlugins)
~/.claude/plugins/local-skills/skills/  → 로컬 스킬
```

백업 명령:
```bash
BACKUP_DATE=$(date +%Y%m%d-%H%M)
BACKUP_DIR="docs/archive/cc-config/$BACKUP_DATE"
mkdir -p "$BACKUP_DIR"

# 에이전트
cp -r .claude/agents/ "$BACKUP_DIR/agents/"
# 커맨드
cp -r .claude/commands/ "$BACKUP_DIR/commands/"
# 훅
cp -r .claude/hooks/ "$BACKUP_DIR/hooks/"
# 설정
cp .claude/settings.json "$BACKUP_DIR/project-settings.json"
cp ~/.claude/settings.json "$BACKUP_DIR/global-settings.json"

echo "백업 완료: $BACKUP_DIR"
```

## status — 현재 구성 요약

```
에이전트 (12개):
  orch: manager-orchestrator, team-orchestrator
  impl: architect-designer, frontend-specialist, backend-specialist,
        flutter-developer, supabase-specialist, figma-designer,
        infra-specialist, api-designer
  qa:   code-reviewer, bug-fixer, web-qa-tester, qa-orchestrator,
        security-auditor, mobile-qa-tester, performance-analyst
  ops:  telegram-notifier, docs-writer

훅 (7개):
  PreToolUse: validate-commit, no-localstorage, subagent-verify, pre-push-qa
  PostToolUse: usage-tracker
  Stop: task-qa-gate
  UserPromptSubmit: auto-skill-trigger (글로벌)

스킬 (로컬, 6개 신규):
  qa-scenario-gen, vulnerability-scanner, prompt-engineering,
  reducing-entropy, changelog-gen, parallel-agents

플러그인:
  활성: superpowers, bkit, code-review, frontend-design, searchfit-seo,
         codex, agent-toolkit (7종), local-skills (24개)
```

## diff — 변경 감지
```bash
# 마지막 백업과 비교
LAST_BACKUP=$(ls docs/archive/cc-config/ | sort | tail -1)
diff -r ".claude/agents/" "docs/archive/cc-config/$LAST_BACKUP/agents/" --brief
```
