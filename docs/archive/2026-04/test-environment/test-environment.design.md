---
feature: test-environment
phase: design
architecture: option-b (완전 분리 구조)
status: active
created: 2026-04-02
author: claude-code (pdca design)
---

# test-environment Design

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | CI `pytest tests/ -v`는 통과하지만 실질 검증 없음. ML 코드 추가 후 회귀 위험 증가 |
| **WHO** | 개발자 (자동 품질 게이트 필요), QA Agent (테스트 실행·분석 담당) |
| **RISK** | Supabase 테스트 프로젝트 미구성 시 CI 실패 가능. RLS 정책이 테스트를 막을 수 있음 |
| **SUCCESS** | Backend 주요 API 80% 커버리지, ML 단위 테스트 PASS, CI 모든 단계 그린 |
| **SCOPE** | Backend 3계층 분리, Frontend vitest 커버리지 강제, ML 단위 테스트, E2E 선택 실행 |

---

## 1. 아키텍처 개요 (Option B — 완전 분리 구조)

```
backend/tests/
├── unit/                      # 외부 의존성 없음 (Mock only)
│   ├── conftest.py            # mock fixtures
│   ├── test_claude.py         [이동]
│   ├── test_middleware.py     [이동]
│   ├── test_admin.py          [이동]
│   ├── test_limiter.py        [이동]
│   └── ml/                   # ML 단위 테스트
│       ├── __init__.py
│       ├── test_metrics.py    [신규]
│       ├── test_evaluator.py  [신규]
│       └── test_optimizer.py  [신규]
├── integration/               # 실제 Supabase 연동
│   ├── conftest.py            [신규, real Supabase fixtures]
│   ├── test_auth.py           [신규]
│   └── test_roadmap.py        [신규]
└── conftest.py                [수정: 최소화, 공통 env만]

pytest.ini                     [신규: 마커 정의]

frontend/src/
├── pages/__tests__/
│   ├── OnboardingPage.test.jsx   [신규]
│   └── RoadmapPage.test.jsx      [신규]
├── contexts/__tests__/
│   └── AuthContext.test.jsx      [신규]
vitest.config.js               [수정: coverage 추가]

frontend/e2e/
├── roadmap-flow.spec.ts       [신규]
playwright.config.ts           [신규]

.github/workflows/test.yml     [수정: 3 jobs로 확장]
```

---

## 2. Backend 설계

### 2.1 pytest.ini (마커 정의)

```ini
[pytest]
markers =
    unit: 외부 의존성 없는 단위 테스트 (Mock only)
    integration: 실제 Supabase 연동 통합 테스트
asyncio_mode = auto
```

### 2.2 최상위 conftest.py (공통 env 설정)

기존 conftest.py를 최소화 — 환경변수만 설정, fixture는 각 계층으로 이동.

```python
# backend/tests/conftest.py
import os
os.environ.setdefault("ENV", "test")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-32-chars-minimum!!")
os.environ.setdefault("CLOUDFRONT_SECRET", "test-cf-secret")
```

### 2.3 unit/conftest.py (Mock fixtures)

기존 conftest.py의 fixture들을 여기로 이동.

```python
# backend/tests/unit/conftest.py
import pytest
from unittest.mock import AsyncMock, MagicMock

@pytest.fixture
def app():
    from app.main import app as fastapi_app
    return fastapi_app

@pytest.fixture
def mock_anthropic(monkeypatch):
    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock()
    monkeypatch.setattr("app.services.claude_service._client", mock_client)
    return mock_client

@pytest.fixture
def mock_supabase(monkeypatch):
    mock_client = MagicMock()
    mock_client.get = AsyncMock()
    mock_client.post = AsyncMock()
    monkeypatch.setattr("app.core.supabase_client._client", mock_client)
    return mock_client
```

### 2.4 integration/conftest.py (실제 Supabase)

`SUPABASE_TEST_URL` 환경변수 없으면 skip — 로컬에서 빠른 실행 보장.

```python
# backend/tests/integration/conftest.py
import os
import pytest
import httpx

SUPABASE_TEST_URL = os.environ.get("SUPABASE_TEST_URL")
SUPABASE_TEST_SERVICE_KEY = os.environ.get("SUPABASE_TEST_SERVICE_KEY")

if not SUPABASE_TEST_URL:
    pytest.skip(
        "SUPABASE_TEST_URL not set — skipping integration tests",
        allow_module_level=True,
    )

@pytest.fixture(scope="session")
def sb_headers():
    return {
        "apikey": SUPABASE_TEST_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_TEST_SERVICE_KEY}",
        "Content-Type": "application/json",
    }

@pytest.fixture(scope="session")
def sb_url():
    return SUPABASE_TEST_URL

@pytest.fixture(scope="session")
def app():
    os.environ["SUPABASE_URL"] = SUPABASE_TEST_URL
    os.environ["SUPABASE_SERVICE_KEY"] = SUPABASE_TEST_SERVICE_KEY
    from app.main import app as fastapi_app
    return fastapi_app

@pytest.fixture
async def async_client(app):
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

@pytest.fixture(autouse=True)
async def cleanup_test_data(sb_headers, sb_url):
    """각 테스트 후 테스트 데이터 삭제."""
    yield
    # test_ 이메일로 생성된 사용자 정리
    async with httpx.AsyncClient() as client:
        await client.delete(
            f"{sb_url}/rest/v1/users?email=like.test_%",
            headers=sb_headers,
        )
```

### 2.5 ML 단위 테스트 설계

#### test_metrics.py

```python
# backend/tests/unit/ml/test_metrics.py
import pytest
from app.ml.evaluation.metrics import (
    MLTargetMetrics, MLEvaluationResult, evaluate_against_targets
)

class TestMLTargetMetrics:
    def test_default_values(self):
        m = MLTargetMetrics()
        assert m.roadmap_quality_score == 85.0
        assert m.hallucination_rate_max == 5.0
        assert m.response_time_max_sec == 3.0
        assert m.consistency_score == 80.0

class TestEvaluateAgainstTargets:
    def _make_result(self, quality, hallucination, response_time, consistency):
        return MLEvaluationResult(
            passed=False,
            roadmap_quality_score=quality,
            hallucination_rate=hallucination,
            avg_response_time_sec=response_time,
            consistency_score=consistency,
            iteration_count=1,
        )

    def test_all_pass(self):
        result = self._make_result(90.0, 3.0, 2.0, 85.0)
        assert evaluate_against_targets(result, MLTargetMetrics()) is True

    def test_quality_fail(self):
        result = self._make_result(80.0, 3.0, 2.0, 85.0)
        assert evaluate_against_targets(result, MLTargetMetrics()) is False

    def test_hallucination_fail(self):
        result = self._make_result(90.0, 6.0, 2.0, 85.0)
        assert evaluate_against_targets(result, MLTargetMetrics()) is False

    def test_response_time_fail(self):
        result = self._make_result(90.0, 3.0, 4.0, 85.0)
        assert evaluate_against_targets(result, MLTargetMetrics()) is False

    def test_boundary_pass(self):
        """경계값 — 정확히 목표치 달성 시 PASS."""
        result = self._make_result(85.0, 5.0, 3.0, 80.0)
        assert evaluate_against_targets(result, MLTargetMetrics()) is True

class TestMLEvaluationResultSummary:
    def test_summary_pass_format(self):
        result = MLEvaluationResult(
            passed=True,
            roadmap_quality_score=90.0,
            hallucination_rate=3.0,
            avg_response_time_sec=1.5,
            consistency_score=88.0,
            iteration_count=1,
        )
        summary = result.summary()
        assert "PASS" in summary
        assert "90.0%" in summary
```

#### test_evaluator.py

```python
# backend/tests/unit/ml/test_evaluator.py
import pytest
from app.ml.inference.roadmap_evaluator import _heuristic_quality_check

class TestHeuristicQualityCheck:
    def test_perfect_roadmap(self):
        roadmap = {
            "role": "백엔드 개발자",
            "period": "6months",
            "level": "beginner",
            "months": [{"month": 1}, {"month": 2}, {"month": 3}],
        }
        assert _heuristic_quality_check(roadmap) == 100.0

    def test_missing_required_key(self):
        roadmap = {"role": "백엔드", "period": "6months", "months": [1, 2, 3]}
        # "level" 누락 → -15
        assert _heuristic_quality_check(roadmap) == 85.0

    def test_empty_months(self):
        roadmap = {"role": "x", "period": "x", "level": "x", "months": []}
        assert _heuristic_quality_check(roadmap) == 70.0  # -30

    def test_few_months(self):
        roadmap = {"role": "x", "period": "x", "level": "x", "months": [1]}
        assert _heuristic_quality_check(roadmap) == 90.0  # -10

    def test_empty_roadmap(self):
        assert _heuristic_quality_check({}) == 0.0  # -60 (4 keys) -30 (0 months)
```

#### test_optimizer.py

```python
# backend/tests/unit/ml/test_optimizer.py
import pytest
from app.ml.pipeline.prompt_optimizer import build_optimized_context

class TestBuildOptimizedContext:
    def test_level_normalization(self):
        ctx = build_optimized_context("backend", "6months", "beginner", [], [], "any")
        assert ctx["level"] == "입문자 (0~1년)"

    def test_period_normalization(self):
        ctx = build_optimized_context("backend", "3months", "basic", [], [], "any")
        assert ctx["period"] == "3개월"

    def test_skills_context_empty(self):
        ctx = build_optimized_context("backend", "6months", "basic", [], [], "any")
        assert "기초부터 학습" in ctx["skills_context"]

    def test_skills_context_filled(self):
        ctx = build_optimized_context("backend", "6months", "basic", ["Python", "Django"], [], "any")
        assert "Python" in ctx["skills_context"]
        assert "Django" in ctx["skills_context"]

    def test_company_hint_startup(self):
        ctx = build_optimized_context("backend", "6months", "basic", [], [], "startup")
        assert "스타트업" in ctx["company_hint"]

    def test_company_hint_any_empty(self):
        ctx = build_optimized_context("backend", "6months", "basic", [], [], "any")
        assert ctx["company_hint"] == ""

    def test_cert_context_empty(self):
        ctx = build_optimized_context("backend", "6months", "basic", [], [], "any")
        assert ctx["cert_context"] == ""

    def test_cert_context_filled(self):
        ctx = build_optimized_context("backend", "6months", "basic", [], ["정보처리기사"], "any")
        assert "정보처리기사" in ctx["cert_context"]

    def test_unknown_level_passthrough(self):
        ctx = build_optimized_context("backend", "6months", "expert", [], [], "any")
        assert ctx["level"] == "expert"
```

### 2.6 Integration 테스트 설계

#### test_auth.py

```python
# backend/tests/integration/test_auth.py
import pytest
from httpx import AsyncClient, ASGITransport

pytestmark = pytest.mark.integration

@pytest.mark.asyncio
async def test_auth_required_endpoints_return_401(async_client):
    """인증 없이 보호된 엔드포인트 접근 시 401."""
    protected = ["/api/roadmap/generate", "/api/roadmap/history"]
    for path in protected:
        resp = await async_client.post(path, json={})
        assert resp.status_code == 401, f"{path}: expected 401, got {resp.status_code}"

@pytest.mark.asyncio
async def test_invalid_jwt_returns_401(async_client):
    """유효하지 않은 JWT 토큰 → 401."""
    resp = await async_client.get(
        "/api/roadmap/history",
        headers={"Authorization": "Bearer invalid.token.here"}
    )
    assert resp.status_code == 401
```

#### test_roadmap.py

```python
# backend/tests/integration/test_roadmap.py
import pytest

pytestmark = pytest.mark.integration

@pytest.mark.asyncio
async def test_roadmap_generate_requires_auth(async_client):
    """인증 없이 로드맵 생성 → 401."""
    resp = await async_client.post("/api/roadmap/generate", json={
        "role": "백엔드 개발자",
        "period": "6months",
        "level": "beginner",
        "skills": [],
    })
    assert resp.status_code == 401

@pytest.mark.asyncio
async def test_roadmap_generate_invalid_payload(async_client):
    """필수 필드 누락 → 422."""
    resp = await async_client.post(
        "/api/roadmap/generate",
        json={"role": "백엔드"},  # period, level 누락
        headers={"Authorization": "Bearer valid-but-fake"},
    )
    # 인증 전에 Pydantic 검증이 먼저 실패하는지 확인
    assert resp.status_code in (401, 422)
```

---

## 3. Frontend 설계

### 3.1 vitest.config.js 업데이트

```js
// frontend/vitest.config.js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/main.jsx',
        'src/assets/**',
        'src/**/__tests__/**',
        'src/test-setup.js',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
      },
      reporter: ['text', 'lcov'],
    },
  },
})
```

### 3.2 OnboardingPage.test.jsx 설계

OnboardingPage는 폼 입력 → 제출 플로우 테스트.

```jsx
// 테스트 케이스 목록:
// 1. 초기 렌더링: 역할 선택 필드 표시
// 2. 역할 선택 없이 제출 → 유효성 오류 표시
// 3. 필드 채우고 제출 → onSubmit 호출
// 4. 로딩 중 버튼 비활성화

// mock 대상:
// - useAuth (user, loading)
// - useNavigate
// - API 호출 (fetch or axios)
```

### 3.3 RoadmapPage.test.jsx 설계

RoadmapPage는 SSE 스트리밍 렌더링 테스트 — `useRoadmapStream` mock 필요.

```jsx
// 테스트 케이스 목록:
// 1. 로딩 상태 표시
// 2. 스트리밍 완료 후 로드맵 렌더링
// 3. 에러 상태 표시
// 4. 월별 진행도 표시

// mock 대상:
// - useRoadmapStream (hook mock)
// - useParams (roadmapId)
```

### 3.4 AuthContext.test.jsx 설계

```jsx
// 테스트 케이스 목록:
// 1. 초기 상태: user null, loading true
// 2. 세션 복원 성공 → user 설정
// 3. 로그아웃 → user null
// 4. onAuthStateChange 이벤트 반응

// mock 대상:
// - supabase (isSupabaseReady, supabase.auth.*)
```

---

## 4. E2E 설계 (Playwright)

### 4.1 playwright.config.ts

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})
```

### 4.2 roadmap-flow.spec.ts 핵심 시나리오

```ts
// 시나리오 1: 로그인 → 온보딩 → 로드맵 생성 흐름
// - Mock Service Worker로 API 응답 모킹 (Claude API 불필요)
// - 실제 Supabase 인증 흐름 (테스트 계정 사용)

// 시나리오 2: 미인증 사용자 리다이렉트
// - 보호된 페이지 접근 시 로그인 페이지로 리다이렉트
```

---

## 5. CI 업데이트 설계

### 5.1 test.yml 3-job 구조

```yaml
jobs:
  test-backend-unit:
    # 항상 실행, mock only, 빠름 (~1분)
    run: pytest tests/unit/ -v --cov=app --cov-fail-under=80

  test-backend-integration:
    # SUPABASE_TEST_URL secret 있을 때만
    if: secrets.SUPABASE_TEST_URL != ''
    needs: test-backend-unit
    run: pytest tests/integration/ -v -m integration
    env:
      SUPABASE_TEST_URL: ${{ secrets.SUPABASE_TEST_URL }}
      SUPABASE_TEST_SERVICE_KEY: ${{ secrets.SUPABASE_TEST_SERVICE_KEY }}

  test-frontend:
    # 항상 실행, coverage 포함
    run: npm test -- --coverage

  test-e2e:
    # main push 시만
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: [test-backend-unit, test-frontend]
    run: npx playwright test
```

---

## 6. 패키지 추가 목록

### Backend

```
# backend/requirements-dev.txt 추가
pytest-cov>=5.0
```

### Frontend

```bash
npm install --save-dev @vitest/coverage-v8
npm install --save-dev @playwright/test   # E2E용
```

---

## 7. 위험 대응

| 위험 | 대응 설계 |
|------|----------|
| 기존 테스트 이동 시 import 오류 | 최상위 conftest.py가 env 설정 유지 → 이동 후도 동일하게 import 가능 |
| integration 테스트 CI에서 항상 실행 | `pytest.skip` + `if: secrets.SUPABASE_TEST_URL` 이중 방어 |
| Frontend 80% 미달 초기 실패 | 빌드 실패 전 `--reporter=verbose` 로 미달 항목 확인 후 단계적 추가 |
| Playwright 설치 CI 시간 | `cache: 'npm'` + `npx playwright install --with-deps` 캐시 활용 |

---

## 8. 구현 순서 (Session Guide)

### Module Map

| 모듈 | 파일 수 | 내용 |
|------|--------|------|
| module-1 | 3 | pytest.ini + conftest 분리 (최상위/unit/integration) |
| module-2 | 4 | ML 단위 테스트 (test_metrics, test_evaluator, test_optimizer) + __init__ |
| module-3 | 2 | 기존 테스트 파일 unit/로 이동 |
| module-4 | 2 | integration 테스트 (test_auth, test_roadmap) |
| module-5 | 4 | Frontend: vitest coverage + OnboardingPage + RoadmapPage + AuthContext 테스트 |
| module-6 | 3 | E2E: playwright.config.ts + roadmap-flow.spec.ts + package 설치 |
| module-7 | 1 | CI test.yml 통합 업데이트 |

### Recommended Session Plan

```
Session 1: module-1 + module-2 + module-3 (인프라 + ML 테스트)
Session 2: module-4 + module-5 (통합 + Frontend)
Session 3: module-6 + module-7 (E2E + CI)
```

### 11.3 Session Guide

```
/pdca do test-environment --scope module-1,module-2,module-3
/pdca do test-environment --scope module-4,module-5
/pdca do test-environment --scope module-6,module-7
```
