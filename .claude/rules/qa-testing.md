# QA 검증 — 테스트 서버 활용 규칙

> `/pdca analyze` 실행 시 참조

## 필수 테스트 실행 순서

QA 에이전트(gap-detector / qa-monitor)는 정적 분석만으로 검증을 종결하지 않는다.
반드시 아래 순서로 테스트 서버를 기동하고 실제 테스트 스위트를 실행한다.

### 1단계 — 백엔드 단위 테스트 (항상 실행)
```bash
cd backend
pytest tests/unit/ -v -m unit --cov=app/ml --cov=app/core --cov=app/models --cov-report=term-missing
```

### 2단계 — 프론트엔드 단위 테스트 (항상 실행)
```bash
cd frontend
npm test -- --coverage --run
```

### 3단계 — 통합 테스트 (SUPABASE_TEST_URL 설정 시)
```bash
cd backend
pytest tests/integration/ -v -m integration
# SUPABASE_TEST_URL 미설정 시 conftest.py의 pytest.skip()이 자동 스킵
```

### 4단계 — E2E 테스트 (프론트+백엔드 서버 기동 후 실행)
```bash
# 터미널 1: 백엔드 기동
cd backend && uvicorn app.main:app --port 8000 &

# 터미널 2: 프론트엔드 빌드+프리뷰
cd frontend && npm run build && npm run preview -- --port 4173 &

# E2E 실행
cd frontend && npx playwright test
```

### 정적 분석만 허용되는 경우
- E2E 테스트 파일이 존재하지 않는 경우
- 사용자가 명시적으로 `--static-only` 옵션을 지정한 경우
- 백엔드/프론트엔드가 아직 구현되지 않은 초기 단계(Do 미완료)

## Match Rate 산정 기준

```
Overall = (Structural × 0.15) + (Functional × 0.25)
        + (Contract × 0.25) + (Runtime × 0.35)
```
- Runtime 점수는 위 1~4단계 테스트 결과(통과율)를 반영
- 단위 테스트만 실행 가능한 경우: Runtime × 0.20 (나머지 비율 재분배)

---

## Phase 2.5 — Contract-First QA 시나리오 확정 절차

Design 완료 직후, Do 시작 전에 반드시 QA 시나리오를 먼저 확정한다.

```
[Design 완료]
    ↓
[Phase 2.5] qa-strategist 또는 gap-detector가 아래를 작성:
  1. feature 디렉토리의 `.qa-evidence.json` 생성
  2. 각 기능별 Happy Path / Edge Case / Failure Case 시나리오 명시
  3. 사용자(또는 cto-lead) 승인
    ↓ 승인 후
[Do] 구현 시작
```

**`.qa-evidence.json` 위치**: `docs/archive/YYYY-MM/<feature-name>/.qa-evidence.json`

**규칙**:
- `.qa-evidence.json` 없이 Do 단계 진입 금지
- Analyze 단계에서 gap-detector는 `.qa-evidence.json`의 시나리오를 기준으로 검증
- 구현 중 시나리오 변경 시 `.qa-evidence.json`도 함께 업데이트 필수
