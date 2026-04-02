---
feature: test-environment
phase: plan
status: active
created: 2026-04-02
author: claude-code (pdca plan)
---

# test-environment Plan

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | Backend는 Mock 기반 얕은 테스트, ML은 테스트 0개, Frontend는 커버리지 목표 없음 — CI가 실질적 품질 게이트 역할을 못 함 |
| **Solution** | Supabase 실제 테스트 프로젝트 연동, ML 단위 테스트 추가, Frontend 80% 커버리지 강제, Playwright E2E 선택 실행 |
| **UX Effect** | PR 머지 전 자동으로 회귀 버그를 차단 — 개발자가 수동 검증 없이 배포 신뢰 |
| **Core Value** | 테스트 인프라가 안정된 CI 게이트로 기능하여 ML·Auth·Roadmap 핵심 플로우 보호 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | CI `pytest tests/ -v`는 통과하지만 실질 검증 없음. ML 코드 추가 후 회귀 위험 증가 |
| **WHO** | 개발자 (자동 품질 게이트 필요), QA Agent (테스트 실행·분석 담당) |
| **RISK** | Supabase 테스트 프로젝트 미구성 시 CI 실패 가능. RLS 정책이 테스트를 막을 수 있음 |
| **SUCCESS** | Backend 주요 API 80% 커버리지, ML 단위 테스트 PASS, CI 모든 단계 그린 |
| **SCOPE** | Backend pytest 확대, Frontend vitest 커버리지 강제, ML 단위 테스트, E2E 선택 실행 |

---

## 1. 현재 상태 분석

### 1.1 Backend (`backend/tests/`)

현재 4개 테스트 파일 존재:

| 파일 | 내용 | 상태 |
|------|------|------|
| `test_claude.py` | claude_service inline import 검사, call_reroute 2케이스 | ✅ Mock 기반 |
| `test_middleware.py` | CloudFront 시크릿 미들웨어 검증 | ✅ Mock 기반 |
| `test_admin.py` | Admin API 기본 케이스 | ✅ Mock 기반 |
| `test_limiter.py` | Rate limiter 기본 | ✅ Mock 기반 |

**문제**: `conftest.py`가 Supabase를 Mock으로 처리 → 실제 Auth/DB 동작 미검증. Roadmap 생성 API(`/api/roadmap/generate`)는 테스트 없음.

### 1.2 Frontend (`frontend/src/`)

7개 테스트 파일 존재, Auth 위주 집중:

| 영역 | 테스트 존재 | 커버리지 |
|------|------------|---------|
| `AuthModal` | ✅ | forgot/policy 케이스 |
| `PrivacyConsentModal` | ✅ | - |
| `useAuth.reset` | ✅ | - |
| `useRoadmapStream` | ✅ | - |
| `validation` | ✅ | - |
| `AuthCallbackPage` | ✅ | - |
| `ResetPasswordPage` | ✅ | - |
| **OnboardingPage** | ❌ | 핵심 플로우 미테스트 |
| **RoadmapPage** | ❌ | 핵심 플로우 미테스트 |
| **AuthContext** | ❌ | 인증 상태 전이 미테스트 |

커버리지 리포트·임계값 설정 없음.

### 1.3 ML (`backend/app/ml/`)

| 파일 | 테스트 |
|------|--------|
| `evaluation/metrics.py` | ❌ |
| `inference/roadmap_evaluator.py` | ❌ |
| `pipeline/prompt_optimizer.py` | ❌ |

### 1.4 E2E

Playwright 미설치. 핵심 로드맵 생성 플로우 E2E 없음.

---

## 2. 요구사항

### 2.1 Functional Requirements

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| TR-01 | Backend: Supabase 실제 테스트 프로젝트 연동 (conftest 이중 모드) | P0 |
| TR-02 | Backend: `/api/roadmap/generate` 엔드포인트 통합 테스트 추가 | P0 |
| TR-03 | Backend: Auth 토큰 검증 통합 테스트 (실제 JWT 흐름) | P0 |
| TR-04 | Frontend: vitest 커버리지 80% 임계값 설정 | P0 |
| TR-05 | Frontend: OnboardingPage 폼 제출·유효성 검사 테스트 | P1 |
| TR-06 | Frontend: RoadmapPage 스트리밍 렌더링 테스트 | P1 |
| TR-07 | Frontend: AuthContext 상태 전이(로그인·로그아웃·세션 복원) 테스트 | P1 |
| TR-08 | ML: `metrics.py` evaluate_against_targets() 단위 테스트 | P0 |
| TR-09 | ML: `roadmap_evaluator.py` heuristic_quality_check 단위 테스트 | P0 |
| TR-10 | ML: `prompt_optimizer.py` build_optimized_context 단위 테스트 | P1 |
| TR-11 | E2E: Playwright 설치 및 로드맵 생성 핵심 플로우 테스트 | P2 |
| TR-12 | CI: E2E는 main 브랜치 push 시에만 선택 실행 | P2 |

### 2.2 Non-Functional Requirements

| ID | 요구사항 |
|----|---------|
| NFR-01 | Backend 커버리지 ≥ 80% (pytest-cov) |
| NFR-02 | Frontend 커버리지 ≥ 80% (v8) |
| NFR-03 | 전체 테스트 실행 시간 ≤ 5분 (CI) |
| NFR-04 | E2E는 외부 네트워크(Supabase/Claude) 없이도 unit/integration은 PASS |

---

## 3. 구현 범위

### Phase A — Backend 통합 테스트 인프라 (P0)

**목표**: Supabase 실제 테스트 프로젝트 연동 + Roadmap API 테스트

**변경 파일**:
```
backend/tests/conftest.py          — Supabase 이중 모드 (mock + real)
backend/tests/test_roadmap.py      — [신규] Roadmap API 통합 테스트
backend/tests/test_auth.py         — [신규] Auth 토큰 검증 통합 테스트
backend/requirements-dev.txt       — pytest-cov 추가 확인
.github/workflows/test.yml         — SUPABASE_TEST_* 환경변수 추가
```

**Supabase 이중 모드 전략**:
- `SUPABASE_TEST_URL` 환경변수 있으면 → 실제 Supabase 테스트 프로젝트
- 없으면 → 기존 Mock 유지 (로컬 개발 빠른 테스트)
- 마커 분리: `@pytest.mark.integration` (실제 Supabase), `@pytest.mark.unit` (Mock)

### Phase B — ML 단위 테스트 (P0)

**목표**: metrics.py, roadmap_evaluator.py, prompt_optimizer.py 80% 커버리지

**변경 파일**:
```
backend/tests/ml/                  — [신규 디렉토리]
backend/tests/ml/__init__.py
backend/tests/ml/test_metrics.py   — MLTargetMetrics, evaluate_against_targets 테스트
backend/tests/ml/test_evaluator.py — heuristic_quality_check 엣지케이스 테스트
backend/tests/ml/test_optimizer.py — build_optimized_context 파라미터 매핑 테스트
```

### Phase C — Frontend 커버리지 강제 (P0~P1)

**목표**: 80% 커버리지 임계값 + OnboardingPage/RoadmapPage/AuthContext 테스트

**변경 파일**:
```
frontend/vitest.config.js                          — coverage 설정 추가
frontend/src/pages/__tests__/OnboardingPage.test.jsx — [신규]
frontend/src/pages/__tests__/RoadmapPage.test.jsx    — [신규]
frontend/src/contexts/__tests__/AuthContext.test.jsx — [신규]
```

**커버리지 설정**:
```js
coverage: {
  provider: 'v8',
  thresholds: { lines: 80, functions: 80, branches: 80 },
  reporter: ['text', 'lcov'],
}
```

### Phase D — E2E (P2, 선택 실행)

**목표**: Playwright 로드맵 생성 핵심 플로우 (main push 시만 실행)

**변경 파일**:
```
frontend/e2e/roadmap-flow.spec.ts  — [신규] 온보딩→로드맵 생성 플로우
frontend/playwright.config.ts      — [신규] Playwright 설정
.github/workflows/test.yml         — e2e job 추가 (main 조건부)
```

---

## 4. 아키텍처 결정

### 4.1 Backend DB 전략: 이중 모드

```
[Unit Tests]     → conftest mock_supabase fixture (빠름, 격리)
[Integration Tests] → SUPABASE_TEST_URL 실제 프로젝트 (느림, 현실적)

CI test.yml:
  unit:      항상 실행 (mock, SUPABASE_TEST_URL 불필요)
  integration: SUPABASE_TEST_URL 시크릿 있을 때만 실행
```

**CI 환경변수 추가 (GitHub Secrets)**:
- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_ANON_KEY`
- `SUPABASE_TEST_SERVICE_KEY`

### 4.2 Frontend 커버리지: v8 (Vite 기본)

vitest v8 제공자 사용 — 별도 패키지 설치 불필요(`@vitest/coverage-v8`만 추가).

### 4.3 E2E 조건부 실행

```yaml
# test.yml 수정
test-e2e:
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  needs: [test-backend, test-frontend]
```

---

## 5. Success Criteria

| 기준 | 측정 방법 | 목표 |
|------|----------|------|
| Backend 커버리지 | `pytest --cov=app --cov-report=term --cov-fail-under=80` | ≥ 80% |
| Frontend 커버리지 | `npm run test -- --coverage` | ≥ 80% |
| ML 테스트 PASS | `pytest tests/ml/ -v` | 0 failures |
| CI 그린 | GitHub Actions test.yml | all jobs PASS |
| Integration 테스트 | Supabase 실제 프로젝트 연결 | Auth/Roadmap API PASS |
| E2E 핵심 플로우 | Playwright headless | roadmap-flow PASS |

---

## 6. 위험 요소

| 위험 | 가능성 | 대응 |
|------|--------|------|
| Supabase 테스트 프로젝트 RLS 차단 | 중간 | service_role key 사용, RLS 우회 픽스처 |
| 커버리지 80% 초기 미달 | 높음 | 단계적 적용 (현재 임계값 확인 후 설정) |
| RoadmapPage 스트리밍 테스트 복잡도 | 중간 | msw(Mock Service Worker) 또는 vi.fn()으로 SSE mock |
| E2E 외부 API 의존성 (Claude) | 높음 | E2E는 선택 실행, Mock 서버 사용 |

---

## 7. 구현 순서

```
1. Phase B (ML 단위 테스트) — 가장 간단, 외부 의존성 없음 [~2시간]
2. Phase C (Frontend 커버리지 임계값 + 핵심 페이지 테스트) [~3시간]
3. Phase A (Backend conftest 이중 모드 + 통합 테스트) [~3시간]
4. Phase D (E2E) [~2시간]
5. CI test.yml 통합 업데이트 [~1시간]
```

---

## 8. 참조 파일

| 파일 | 역할 |
|------|------|
| `backend/tests/conftest.py` | 현재 mock 픽스처 (확장 예정) |
| `backend/requirements-dev.txt` | pytest-cov 포함 여부 확인 필요 |
| `frontend/vitest.config.js` | 커버리지 설정 추가 위치 |
| `.github/workflows/test.yml` | CI 통합 업데이트 위치 |
| `backend/app/ml/evaluation/metrics.py` | ML 테스트 타겟 |
| `backend/app/ml/inference/roadmap_evaluator.py` | ML 테스트 타겟 |
| `backend/app/ml/pipeline/prompt_optimizer.py` | ML 테스트 타겟 |
