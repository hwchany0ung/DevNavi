# DevNavi — 멀티 에이전트 운영 규칙

## 코드 탐색 규칙 (qmd 우선)

파일을 읽기 전에 반드시 qmd로 먼저 검색한다.

- `qmd search "query" -c devnavi` — 키워드 검색 (80% 사용)
- `qmd vsearch "query" -c devnavi` — 개념적 질문 (예: "에러 처리 방식")
- `qmd query "query" -c devnavi` — 복잡한 탐색적 질문 (최고 품질)

qmd 결과로 충분하지 않을 때만 Read/Glob/Grep 사용.

---

## 오케스트레이터 자동 선택 로직

작업 시작 시 필요한 specialist 수를 먼저 파악하고, 아래 규칙에 따라 오케스트레이터를 자동 선택한다.

| 조건 | 선택 오케스트레이터 | 설명 |
|------|-----------------|------|
| specialist **2개 이하** | **cto-lead 단독** | 소규모 작업, 오버헤드 최소화 |
| specialist **3개 이상** | **cto-lead + 팀 에이전트 풀 가동** | 대규모 작업, 병렬 실행 |

> **판단 기준**: 구현(developer) + 검증(code-reviewer/gap-detector)만 필요 → cto-lead 단독.
> PM + 설계 + 구현 + 검증 + ML 등 복합 작업 → 팀 전체 가동.

---

## 파일 기반 컨텍스트 전달 원칙

에이전트 간 컨텍스트 전달 시 **외부 시스템(MCP 등)에 의존하지 않고 파일 시스템을 진실의 원천으로 사용**한다.

- Orchestrator(cto-lead)는 하위 에이전트에게 작업을 위임할 때 반드시 관련 파일 경로를 명시한다
- 설계 문서(`docs/02-design/`), Plan 문서(`docs/01-plan/`), QA 시나리오(`.qa-evidence.json`)를 직접 읽어 specialist에게 전달
- 에이전트 간 구두(텍스트) 요약 전달보다 파일 경로 직접 참조를 우선

---

## 핵심 철학 (멀티에이전트 구성 메뉴얼.txt 기반)

### 1. 관심사의 분리 (Separation of Concerns)
- 각 에이전트는 부여된 단 하나의 역할만 수행한다
- **cto-lead(Orchestrator)는 절대 직접 코딩·기획 실무를 수행하지 않는다** — 반드시 하위 에이전트에게 위임
- 구현 에이전트(Claude Code)는 설계 문서에 없는 기능을 자의적으로 추가하지 않는다
- **ML Agent는 일반 백엔드/프론트엔드 코드를 작성하지 않는다** — 모델·데이터 파이프라인 전담

### 2. 상호 교차 검증 (Cross-Validation) — 필수
- **모든 구현(`/pdca do`) 완료 후, gap-detector 검증을 반드시 거쳐야 다음 단계로 진행 가능**
- 구현한 에이전트가 자기 코드를 스스로 최종 승인하는 것은 금지
- 검증 없이 완료 선언 금지 — `/pdca analyze` 없이 `/pdca report` 실행 불가
- **ML 모델은 타겟 성능 지표 달성 전까지 다음 단계로 진행 불가** (QA 에이전트가 판단)

### 3. 무한 루프 차단 (Infinite Loop Breaker)
- pdca-iterator(수정-반려 루프)는 **최대 3회**로 제한
- 3회 이후에도 Match Rate < 90%이면 즉시 중단하고 **사용자(인간)에게 판단 요청**
- ML 재학습 루프도 동일하게 **최대 3회** — 초과 시 사용자 판단 요청

### 4. 기억 연속성 (Working Memory)
- 세션 시작 시 반드시 `~/.claude/projects/.../memory/MEMORY.md`를 확인
- 에이전트 간 전달 사항은 `.bkit/state/`에 기록 유지

---

## 팀 에이전트 코딩·디버깅 작업 필수 검증 워크플로우

> 사용자가 팀 에이전트로 **코딩 또는 디버깅 작업**을 지시할 때 **반드시** 아래 2단계 검증을 거쳐야 한다.

### 구성 — 필수 포함 에이전트

| 역할 | 에이전트 | 조건 |
|------|---------|------|
| 구현 | frontend-architect / code-analyzer 등 | 작업에 맞게 선택 |
| **1차 검증** | **code-reviewer 또는 qa-strategist** | **항상 필수** |
| **2차 최종 승인** | **cto-lead** | **항상 필수** |

### 검증 순서 (반드시 준수)

```
구현 완료
    ↓
[1차] code-reviewer 또는 qa-strategist 검증
    ↓ 통과              ↓ 문제 발견
    ↓                코드 수정
    ↓                    ↓
    ↓              [1차] 재검증 (스킵 금지)
    ↓                    ↓ 통과
[2차] cto-lead 최종 보고 및 승인
    ↓ 승인              ↓ 문제 발견
완료                  코드 수정
                         ↓
                   [1차] 재검증 (2차에서 문제 발견되어도 반드시 1차부터 재시작)
                         ↓ 통과
                   [2차] cto-lead 재보고
```

### 규칙

1. **1차 검증 없이 2차(cto-lead) 바로 진행 금지**
2. **검증 단계 스킵 금지** — 수정 후에는 반드시 1차→2차 순서 재이행
3. **cto-lead는 1차 검증 통과 보고서를 받은 후에만 최종 승인 가능**
4. 루프 제한: 수정-재검증 사이클은 **최대 3회** — 초과 시 사용자에게 판단 요청

---

## 에이전트 모델 설정

| 에이전트 | 모델 | 조건 |
|---------|------|------|
| `cto-lead` | **opus** | 항상 |
| `security-architect` | **opus** | 항상 |
| `gap-detector` | **opus** | 항상 |
| `pm-lead` | **opus** | 사용자가 신규 서비스 기획을 명시적으로 요청할 때만 |
| `pm-lead` | sonnet | 그 외 일반 PM 분석·PRD 수정 작업 |
| 나머지 모든 에이전트 | sonnet | 항상 |

> **pm-lead opus 전환 트리거**: 사용자 메시지에 "신규 서비스", "새 서비스 기획", "새 프로덕트", "신규 프로젝트 기획" 등 명시적 표현이 있을 때.
> 기존 DevNavi 기능 개선·버그 수정·PRD 업데이트는 sonnet 유지.

---

## 에이전트 역할 및 제한 (7인 구조)

| 에이전트 | 역할 | 제한 |
|---------|------|------|
| cto-lead | 오케스트레이터 — 작업 분배·결정 | 직접 코딩/기획 금지 |
| pm-lead / product-manager | 요구사항 → PRD + **ML 타겟 지표 명시** | 설계 금지 |
| enterprise-expert / infra-architect / frontend-architect | 기술 명세서 + **ML 데이터 파이프라인·추론 서버 설계** | 코드 구현 금지 |
| Claude Code (developer) | 설계도 기반 UI·백엔드·DB 구현 | 설계에 없는 기능 추가 금지, ML 모델 학습 금지 |
| **ml-agent (신규)** | **데이터 전처리·Feature Engineering·모델 학습·추론 API화** | 일반 백엔드/프론트엔드 코드 작성 금지 |
| code-analyzer / gap-detector / qa-monitor | 코드 검증 + **모델 성능 지표 검증** | 구현 금지 |
| pdca-iterator | 자동 수정 루프 | 최대 3회 — 초과 시 중단 |

---

## QA 검증

> `/pdca analyze` 시 테스트 실행 순서·Match Rate 산정 기준: `.claude/rules/qa-testing.md` 참조

---

## PDCA 단계별 게이트 (Phase Gates)

| 단계 | 완료 조건 | 다음 단계 진입 조건 |
|------|----------|-----------------|
| Plan | Plan 문서 생성 + **ML 타겟 지표 포함** | Design 문서 없으면 진행 불가 |
| Design | Design 문서 생성 + **ML 파이프라인 설계 포함** | 설계 문서 검토 완료 |
| **Phase 2.5** | **`.qa-evidence.json` QA 시나리오 확정** | **구현(Do) 시작 전 반드시 완료** |
| Do | 구현 완료 (Developer + ML Agent 병렬) | **gap-detector + 모델 성능 검증 모두 필수** |
| Analyze | Match Rate + **ML 지표** 확인 | 둘 다 ≥ 기준: Report / 미달: iterate (최대 3회) |
| Iterate | 수정 완료 | 3회 초과 시 사용자 판단 요청 |
| Report | 완료 보고서 생성 | 완료 |


> Phase 2.5 상세 절차: `.claude/rules/qa-testing.md` 참조

---

> ML 통합 워크플로우·적용 범위 상세: `.claude/rules/ml-workflow.md` 참조
