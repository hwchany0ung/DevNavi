# DevNavi — 멀티 에이전트 운영 규칙

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

## ML 통합 병렬 워크플로우 (ML에이전트 구성.txt 기반)

### Phase 1 — 요구사항 정의
- PM이 일반 기능 명세 + **ML 모델 타겟 지표**를 함께 명시
- 예: "로드맵 생성 정확도 ≥ 85%, 응답 시간 ≤ 3초, Hallucination 비율 ≤ 5%"

### Phase 2 — 시스템 설계
- Architect가 일반 DB 설계 + **ML 데이터 파이프라인(ETL) + 추론 서버 아키텍처** 분리 설계
- DevNavi 적용: Claude API 프롬프트 최적화 파이프라인 + 로드맵 품질 평가 서버

### Phase 3 — 병렬 구현 (핵심)
```
Developer Agent  ─── UI·백엔드 로직·DB 연동 ──────────────┐
                                                            ├─→ 통합
ML Agent ─────── 모델 학습·추론 모듈·Inference API화 ────────┘
```
- 두 에이전트는 **독립적으로 병렬 실행** (서로의 작업에 개입 금지)
- ML Agent 산출물: `backend/app/ml/` 디렉토리 아래 추론 모듈 + API 엔드포인트

### Phase 4 — 하이브리드 검증 루프
QA 에이전트가 두 트랙을 모두 검증:

| 검증 트랙 | 담당 | 기준 | 실패 시 |
|---------|------|------|--------|
| 코드 검증 | code-analyzer / gap-detector | Match Rate ≥ 90% | developer 재수정 |
| **모델 검증** | **qa-monitor (ML 트랙)** | **타겟 지표 달성 + 과적합 없음** | **ML Agent 재학습 (최대 3회)** |

---

## QA 검증 — 테스트 서버 활용 규칙

### `/pdca analyze` 실행 시 필수 절차

QA 에이전트(gap-detector / qa-monitor)는 정적 분석만으로 검증을 종결하지 않는다.
**반드시 아래 순서로 테스트 서버를 기동하고 실제 테스트 스위트를 실행한다.**

#### 1단계 — 백엔드 단위 테스트 (항상 실행)
```bash
cd backend
pytest tests/unit/ -v -m unit --cov=app/ml --cov=app/core --cov=app/models --cov-report=term-missing
```

#### 2단계 — 프론트엔드 단위 테스트 (항상 실행)
```bash
cd frontend
npm test -- --coverage --run
```

#### 3단계 — 통합 테스트 (SUPABASE_TEST_URL 설정 시)
```bash
cd backend
pytest tests/integration/ -v -m integration
# SUPABASE_TEST_URL 미설정 시 conftest.py의 pytest.skip()이 자동 스킵
```

#### 4단계 — E2E 테스트 (프론트+백엔드 서버 기동 후 실행)
```bash
# 터미널 1: 백엔드 기동
cd backend && uvicorn app.main:app --port 8000 &

# 터미널 2: 프론트엔드 빌드+프리뷰 (또는 dev)
cd frontend && npm run build && npm run preview -- --port 4173 &

# E2E 실행 (playwright.config.ts의 webServer가 자동 관리)
cd frontend && npx playwright test
```

#### 서버 기동 없이 정적 분석만 허용되는 경우
- E2E 테스트 파일이 존재하지 않는 경우
- 사용자가 명시적으로 `--static-only` 옵션을 지정한 경우
- 백엔드/프론트엔드가 아직 구현되지 않은 초기 단계(Do 미완료)

### Match Rate 산정 기준 (테스트 서버 사용 시)
```
Overall = (Structural × 0.15) + (Functional × 0.25)
        + (Contract × 0.25) + (Runtime × 0.35)
```
- Runtime 점수는 위 1~4단계 테스트 결과(통과율)를 반영
- 단위 테스트만 실행 가능한 경우: Runtime × 0.20 (나머지 비율 재분배)

---

## PDCA 단계별 게이트 (Phase Gates)

| 단계 | 완료 조건 | 다음 단계 진입 조건 |
|------|----------|-----------------|
| Plan | Plan 문서 생성 + **ML 타겟 지표 포함** | Design 문서 없으면 진행 불가 |
| Design | Design 문서 생성 + **ML 파이프라인 설계 포함** | 설계 문서 검토 완료 |
| Do | 구현 완료 (Developer + ML Agent 병렬) | **gap-detector + 모델 성능 검증 모두 필수** |
| Analyze | Match Rate + **ML 지표** 확인 | 둘 다 ≥ 기준: Report / 미달: iterate (최대 3회) |
| Iterate | 수정 완료 | 3회 초과 시 사용자 판단 요청 |
| Report | 완료 보고서 생성 | 완료 |

---

## DevNavi ML 적용 범위

| ML 기능 | 현재 상태 | ML Agent 역할 |
|---------|---------|-------------|
| 로드맵 생성 | Claude API (claude_service.py) | 프롬프트 파이프라인 최적화, 품질 평가 모델 |
| 커리어 경로 추천 | 미구현 | 사용자 스킬 데이터 기반 추천 모델 |
| 로드맵 품질 평가 | 미구현 | Hallucination 탐지, 일관성 점수 |
| 사용자 성향 분석 | 미구현 | 온보딩 응답 기반 클러스터링 |

### ML Agent 작업 디렉토리
```
backend/app/ml/
├── pipeline/      # 데이터 전처리·Feature Engineering
├── models/        # 학습된 모델 저장
├── inference/     # 추론 로직 모듈
└── evaluation/    # 성능 지표 평가 스크립트
```
