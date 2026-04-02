# DevNavi — 멀티 에이전트 운영 규칙

## 핵심 철학 (멀티에이전트 구성 메뉴얼.txt 기반)

### 1. 관심사의 분리 (Separation of Concerns)
- 각 에이전트는 부여된 단 하나의 역할만 수행한다
- **cto-lead(Orchestrator)는 절대 직접 코딩·기획 실무를 수행하지 않는다** — 반드시 하위 에이전트에게 위임
- 구현 에이전트(Claude Code)는 설계 문서에 없는 기능을 자의적으로 추가하지 않는다

### 2. 상호 교차 검증 (Cross-Validation) — 필수
- **모든 구현(`/pdca do`) 완료 후, gap-detector 검증을 반드시 거쳐야 다음 단계로 진행 가능**
- 구현한 에이전트가 자기 코드를 스스로 최종 승인하는 것은 금지
- 검증 없이 완료 선언 금지 — `/pdca analyze` 없이 `/pdca report` 실행 불가

### 3. 무한 루프 차단 (Infinite Loop Breaker)
- pdca-iterator(수정-반려 루프)는 **최대 3회**로 제한
- 3회 이후에도 Match Rate < 90%이면 즉시 중단하고 **사용자(인간)에게 판단 요청**
- 자동으로 계속 시도하는 것을 금지

### 4. 기억 연속성 (Working Memory)
- 세션 시작 시 반드시 `~/.claude/projects/.../memory/MEMORY.md`를 확인
- 에이전트 간 전달 사항은 `.bkit/state/`에 기록 유지

---

## PDCA 단계별 게이트 (Phase Gates)

| 단계 | 완료 조건 | 다음 단계 진입 조건 |
|------|----------|-----------------|
| Plan | Plan 문서 생성 | Design 문서 없으면 진행 불가 |
| Design | Design 문서 생성 | 설계 문서 검토 완료 |
| Do | 구현 완료 | **gap-detector 실행 필수** |
| Analyze | Match Rate 확인 | ≥90%: Report / <90%: iterate (최대 3회) |
| Iterate | 수정 완료 | 3회 초과 시 사용자 판단 요청 |
| Report | 완료 보고서 생성 | 완료 |

---

## 에이전트 역할 및 제한

| 에이전트 | 역할 | 제한 |
|---------|------|------|
| cto-lead | 오케스트레이터 — 작업 분배·결정 | 직접 코딩/기획 금지 |
| pm-lead / product-manager | 요구사항 → PRD 번역 | 설계 금지 |
| enterprise-expert / infra-architect / frontend-architect | 기술 명세서 작성 | 코드 구현 금지 |
| Claude Code (본체) | 설계도 기반 구현 | 설계에 없는 기능 추가 금지 |
| code-analyzer / gap-detector / qa-monitor | 독립적 검증 | 구현 금지 |
| pdca-iterator | 자동 수정 루프 | 최대 3회 — 초과 시 중단 |
