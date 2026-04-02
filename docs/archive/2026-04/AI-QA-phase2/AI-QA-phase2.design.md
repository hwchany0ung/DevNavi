# Design: AI Q&A Phase 2 — 피드백 & Analytics

> **Phase**: Design | **Date**: 2026-04-02 | **Feature**: AI-QA-phase2
> **Architecture**: Option B — Clean Architecture
> Parent Plan: `docs/01-plan/features/AI-QA-phase2.plan.md`

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | Phase 1 SC-01/02/03 달성 여부를 런타임에서 측정하기 위한 필수 데이터 인프라 |
| **WHO** | 사용자(피드백 제공) + 관리자(통계 열람) |
| **RISK** | 피드백 데이터 과다 수집 시 PIPA 이슈, 관리자 페이지 접근 제어 미흡 |
| **SUCCESS** | SC-03 답변 만족도 측정 가능, SC-01 사용률 집계, SC-02 Q&A 후 체크 완료율 비교 |
| **SCOPE** | QAPanel Thumbs UI + qa_feedback 테이블 + qa_events 테이블 + /admin 대시보드 섹션 추가 |

---

## 1. Overview

Phase 1에서 구축한 AI Q&A 기능에 **피드백 수집**과 **Analytics 이벤트 로깅**을 추가하고,
관리자가 Q&A 품질 지표를 실시간으로 모니터링할 수 있는 대시보드 섹션을 구축한다.

### Architecture Decision: Option B — Clean Architecture

| 항목 | 결정 |
|------|------|
| 피드백 UI | `QAFeedback.jsx` — QAPanel 외부 독립 컴포넌트 |
| 이벤트 로깅 | `useAnalytics.js` — 완전 분리 훅 (단방향 fire-and-forget) |
| 피드백 API 호출 | `useFeedback.js` — 완전 분리 훅 |
| 백엔드 서비스 | `feedback_service.py` + `analytics_service.py` — 독립 서비스 모듈 |
| Admin 컴포넌트 | `QAStats.jsx` — AdminPage에 inject, 독립 데이터 페칭 |

---

## 2. 아키텍처 다이어그램

```
Frontend
├── components/
│   ├── qa/
│   │   ├── QAPanel.jsx          (기존 — QAFeedback import 추가)
│   │   └── QAFeedback.jsx       ← 신규: Thumbs up/down UI
│   └── admin/
│       └── QAStats.jsx          ← 신규: Admin Q&A 통계 섹션
├── hooks/
│   ├── useQA.js                 (기존 — logEvent 연동 추가)
│   ├── useFeedback.js           ← 신규: 피드백 API 훅
│   └── useAnalytics.js          ← 신규: 이벤트 로깅 훅
└── pages/
    ├── RoadmapPage.jsx          (기존 — task_checked 이벤트 연동)
    └── AdminPage.jsx            (기존 — QAStats 섹션 주입)

Backend
├── api/
│   └── ai_qa.py                 (기존 — /feedback, /event 엔드포인트 추가)
├── models/
│   └── qa_models.py             (기존 — FeedbackRequest, EventRequest 추가)
└── services/
    ├── qa_service.py            (기존 — 변경 없음)
    ├── feedback_service.py      ← 신규: save_feedback 로직
    └── analytics_service.py    ← 신규: log_event 로직

Supabase
└── migrations/
    └── 006_qa_feedback_events.sql  ← 신규: 2테이블 + RLS + v_qa_stats 뷰
```

---

## 3. 데이터 모델

### 3.1 qa_feedback 테이블

```sql
CREATE TABLE qa_feedback (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id     TEXT NOT NULL,                    -- "1-1-0" format
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    rating      TEXT NOT NULL CHECK (rating IN ('up', 'down')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, task_id, question)           -- upsert 기준 (동일 질문 중복 방지)
);
```

**RLS 정책:**
- `INSERT`: `auth.uid() = user_id` (본인만 등록)
- `SELECT`: `auth.uid() = user_id` (본인 데이터만 조회)
- 전체 조회: `service_role`만 가능 (Admin 대시보드용)

### 3.2 qa_events 테이블

```sql
CREATE TABLE qa_events (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- nullable (비로그인)
    task_id     TEXT,
    event_type  TEXT NOT NULL CHECK (event_type IN ('qa_opened', 'qa_submitted', 'task_checked')),
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS 정책:**
- `INSERT`: 모두 허용 (비로그인 포함) — 단, `user_id` 검증은 백엔드에서 처리
- `SELECT`: `service_role`만 가능

### 3.3 v_qa_stats 집계 뷰

```sql
CREATE VIEW v_qa_stats AS
SELECT
    COUNT(*) FILTER (WHERE event_type = 'qa_submitted') AS total_qa_count,
    ROUND(
        COUNT(*) FILTER (WHERE rating = 'up')::numeric /
        NULLIF(COUNT(*), 0) * 100, 1
    ) AS satisfaction_pct,
    COUNT(*) FILTER (WHERE event_type = 'task_checked') AS task_checked_count
FROM qa_events
FULL OUTER JOIN qa_feedback ON TRUE;
```

> 실제 뷰는 migration에서 정확히 구현. 위는 논리적 구조.

### 3.4 qa_events 90일 TTL (pg_cron)

```sql
-- pg_cron이 활성화된 경우
SELECT cron.schedule('cleanup-qa-events', '0 0 * * *',
    $$DELETE FROM qa_events WHERE created_at < NOW() - INTERVAL '90 days'$$
);
```

---

## 4. API 설계

### 4.1 POST /ai/qa/feedback

```
Auth: 필수 (JWT Bearer)
Rate limit: 30/hour (slowapi per IP)
```

**Request:**
```json
{
  "task_id": "1-1-0",
  "question": "Next.js에서 SSR이란?",
  "answer": "SSR은 서버 사이드 렌더링으로...",
  "rating": "up"
}
```

**Response (200):**
```json
{ "saved": true }
```

**Error responses:**
- `401` — 미인증
- `422` — 입력 검증 실패 (rating 값 오류 등)
- `429` — slowapi rate limit 초과

**중복 처리:** `(user_id, task_id, question)` UNIQUE 제약으로 upsert — 동일 질문 재평가 가능

### 4.2 POST /ai/qa/event

```
Auth: 선택 (JWT Bearer — 미인증 시 user_id = null)
Rate limit: 60/hour (slowapi per IP)
```

**Request:**
```json
{
  "task_id": "1-1-0",
  "event_type": "qa_opened",
  "metadata": {}
}
```

**Response (200):**
```json
{ "logged": true }
```

**Error responses:**
- `422` — event_type 유효하지 않음
- `429` — rate limit 초과

**Fire-and-forget 원칙:** 백엔드 DB 저장 실패 시 `{"logged": false}` 반환하되 HTTP 200 유지.
클라이언트는 응답 무관 — 사용자 UX 차단 없음.

### 4.3 GET /admin/qa-stats

```
Auth: 관리자 전용 (기존 isAdmin 미들웨어 재사용)
```

**Response (200):**
```json
{
  "total_qa_count": 1523,
  "satisfaction_rate": 0.82,
  "daily_counts": [
    { "date": "2026-03-27", "count": 45 },
    { "date": "2026-03-28", "count": 67 },
    ...
  ],
  "task_completion_lift": 0.23,
  "recent_feedback": [
    {
      "id": "uuid",
      "task_id": "1-1-0",
      "question": "Next.js에서...",
      "rating": "up",
      "created_at": "2026-04-01T10:00:00Z"
    }
  ]
}
```

---

## 5. 컴포넌트 설계

### 5.1 QAFeedback.jsx

**위치:** `frontend/src/components/qa/QAFeedback.jsx`

**Props:**
```js
{
  taskId: string,      // "1-1-0"
  question: string,    // 마지막 질문 텍스트
  answer: string,      // 마지막 답변 텍스트
  isLoggedIn: boolean, // 미로그인 시 툴팁 표시
}
```

**상태:**
- `rating`: `null | 'up' | 'down'` — 선택된 평가

**동작:**
1. 로그인 상태: 👍/👎 버튼 활성화
2. 비로그인 상태: 버튼 비활성화 + "로그인 후 이용 가능" 툴팁
3. 클릭 시: `useFeedback.sendFeedback()` 호출 → 선택 버튼 하이라이트
4. 동일 버튼 재클릭: 토글 (rating → null, 취소)

**QAPanel 연동:**
- `QAPanel.jsx`의 각 `assistant` 메시지 하단에 렌더링
- `streaming` 완료 후에만 표시 (스트리밍 중 숨김)

### 5.2 QAStats.jsx

**위치:** `frontend/src/components/admin/QAStats.jsx`

**독립 데이터 페칭:** `useEffect` + `request('/admin/qa-stats')` 내부 처리 (AdminPage 상태 불필요)

**레이아웃:**
```
┌─────────────────────────────────────────────────┐
│  Q&A Analytics                                  │
├──────────┬──────────┬──────────┬────────────────┤
│ 총 Q&A   │ 만족도   │ 일별추이  │ 완료율 향상    │
│ 1,523    │ 82%      │ [바차트]  │ +23%           │
├──────────┴──────────┴──────────┴────────────────┤
│  최근 피드백 (최근 20건)                          │
│  질문 요약          평점   날짜                   │
│  Next.js SSR이란?   👍    2026-04-01              │
│  ...                                             │
└─────────────────────────────────────────────────┘
```

### 5.3 useFeedback.js

**위치:** `frontend/src/hooks/useFeedback.js`

```js
export function useFeedback() {
  const sendFeedback = async ({ taskId, question, answer, rating }) => {
    // POST /ai/qa/feedback
    // 실패 시 console.warn만 — UX 차단 없음
  }
  return { sendFeedback }
}
```

### 5.4 useAnalytics.js

**위치:** `frontend/src/hooks/useAnalytics.js`

```js
export function useAnalytics() {
  const logEvent = async (eventType, taskId, metadata = {}) => {
    // POST /ai/qa/event (fire-and-forget)
    // 실패 시 console.warn만
  }
  return { logEvent }
}
```

**이벤트 발생 시점:**

| event_type | 발생 위치 | 연동 방법 |
|-----------|---------|---------|
| `qa_opened` | `useQA.openPanel()` | `useAnalytics` import |
| `qa_submitted` | `useQA.sendMessage()` | `useAnalytics` import |
| `task_checked` | `RoadmapPage.handleToggle()` | Q&A 세션 존재 시만 로깅 |

---

## 6. 백엔드 서비스 설계

### 6.1 feedback_service.py

```python
async def save_feedback(
    user_id: str,
    task_id: str,
    question: str,
    answer: str,
    rating: str,  # 'up' | 'down'
) -> bool:
    """
    qa_feedback 테이블에 upsert.
    (user_id, task_id, question) 중복 시 rating + updated_at UPDATE.
    실패 시 False 반환 (예외 전파 없음).
    """
```

### 6.2 analytics_service.py

```python
async def log_event(
    event_type: str,
    task_id: str | None,
    user_id: str | None,
    metadata: dict,
) -> bool:
    """
    qa_events 테이블에 INSERT.
    비로그인 시 user_id = None.
    실패 시 False 반환 (예외 전파 없음 — fire-and-forget).
    """
```

### 6.3 qa_models.py 추가 모델

```python
class FeedbackRequest(BaseModel):
    task_id: str = Field(pattern=r"^\d+-\d+-\d+$")
    question: str = Field(min_length=1, max_length=200)
    answer: str = Field(min_length=1, max_length=2000)
    rating: Literal["up", "down"]

class EventRequest(BaseModel):
    task_id: str | None = Field(default=None, pattern=r"^\d+-\d+-\d+$")
    event_type: Literal["qa_opened", "qa_submitted", "task_checked"]
    metadata: dict = Field(default_factory=dict)
```

---

## 7. 보안 설계

### RLS 정책 요약

| 테이블 | INSERT | SELECT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `qa_feedback` | `auth.uid() = user_id` | `auth.uid() = user_id` | — | — |
| `qa_events` | anon 허용 (백엔드 처리) | service_role만 | — | — |

### 관리자 대시보드 접근 제어
- `/admin/qa-stats` 엔드포인트: 기존 `isAdmin` 미들웨어 재사용
- 프론트엔드: `AdminPage.jsx`의 기존 관리자 인증 플로우에 `QAStats` 컴포넌트 추가

### Rate Limit

| 엔드포인트 | Limit | 이유 |
|-----------|-------|------|
| `POST /ai/qa/feedback` | 30/hour | 피드백 스팸 방지 |
| `POST /ai/qa/event` | 60/hour | 이벤트 스팸 방지 |

---

## 8. 테스트 계획

### 8.1 백엔드 단위 테스트 (`tests/unit/test_feedback_analytics.py`)

| 테스트 | 검증 항목 |
|--------|---------|
| `test_save_feedback_up` | rating='up' 정상 저장 |
| `test_save_feedback_down` | rating='down' 정상 저장 |
| `test_save_feedback_upsert` | 동일 (user_id, task_id, question) → rating UPDATE |
| `test_save_feedback_db_error` | DB 실패 시 False 반환, 예외 전파 없음 |
| `test_log_event_qa_opened` | qa_opened 이벤트 저장 |
| `test_log_event_task_checked` | task_checked 이벤트 저장 |
| `test_log_event_anonymous` | user_id=None 저장 |
| `test_log_event_db_error` | DB 실패 시 False 반환 |
| `test_feedback_endpoint_auth` | 미인증 → 401 |
| `test_feedback_endpoint_invalid_rating` | rating='neutral' → 422 |
| `test_event_endpoint_anonymous` | 비로그인 → 200 |
| `test_event_endpoint_invalid_type` | event_type='click' → 422 |

### 8.2 프론트엔드 단위 테스트 (`tests/QAFeedback.test.jsx`)

| 테스트 | 검증 항목 |
|--------|---------|
| `renders thumbs buttons` | 👍/👎 버튼 렌더링 |
| `shows tooltip when not logged in` | 비로그인 툴팁 표시 |
| `highlights selected rating` | 클릭 시 하이라이트 |
| `toggles rating on re-click` | 재클릭 시 토글 |
| `calls sendFeedback on click` | useFeedback 호출 확인 |
| `hidden during streaming` | streaming=true 시 숨김 |

### 8.3 E2E 테스트 (`tests/e2e/AI-QA-phase2.spec.ts`)

| 시나리오 | 검증 항목 |
|---------|---------|
| Q&A 후 Thumbs up 클릭 | 피드백 저장 API 호출 확인 |
| 동일 질문 재평가 | upsert 동작 확인 |
| 관리자 대시보드 Q&A 통계 | StatCard 4개 + 피드백 테이블 렌더링 |
| 비관리자 qa-stats 접근 | 401/403 반환 확인 |

---

## 9. 비기능 요구사항 구현

| NFR | 구현 방법 |
|-----|---------|
| NFR-01 성능 ≤200ms | analytics_service: INSERT 비동기, 응답 즉시 반환 |
| NFR-02 RLS | qa_feedback: user_id 본인만 INSERT/SELECT |
| NFR-03 PIPA | 기존 consent_records 약관 포함 여부 확인 후 migration 배포 |
| NFR-04 가용성 | fire-and-forget: 이벤트 실패 시 console.warn만 |

---

## 10. 마이그레이션 계획

**파일:** `supabase/migrations/006_qa_feedback_events.sql`

**실행 순서:**
1. `qa_feedback` 테이블 + UNIQUE constraint + RLS
2. `qa_events` 테이블 + check constraint + RLS
3. `v_qa_stats` 집계 뷰 (관리자 대시보드용)
4. pg_cron 90일 TTL (환경에 따라 optional)
5. Rollback: `DROP TABLE qa_feedback CASCADE; DROP TABLE qa_events CASCADE;`

---

## 11. 구현 가이드

### 11.1 구현 순서

```
M1: 006_qa_feedback_events.sql (DB 먼저)
  └→ M2: qa_models.py — FeedbackRequest, EventRequest 추가
      └→ M3: feedback_service.py + analytics_service.py 신규 생성
          └→ M4: ai_qa.py — /feedback, /event 엔드포인트 추가
              ├→ M5: useFeedback.js + useAnalytics.js 신규 생성
              ├→ M6: QAFeedback.jsx 신규 생성 + QAPanel 연동
              ├→ M7: useQA.js — logEvent 연동 (qa_opened, qa_submitted)
              ├→ M8: RoadmapPage.jsx — task_checked 이벤트 연동
              └→ M9: QAStats.jsx 신규 생성 + AdminPage 주입
```

### 11.2 핵심 주의사항

1. **Fire-and-forget 철저히**: `useAnalytics.logEvent`는 절대 await 체이닝 없이 독립 호출
2. **QAFeedback 숨김 조건**: `streaming === true` 동안 null 반환
3. **task_checked 조건부 로깅**: RoadmapPage에서 `qaSessionMap.has(taskId)` 체크 후 이벤트 발송
4. **admin 엔드포인트**: 기존 `isAdmin` 미들웨어 import 재사용 (새로 구현 금지)
5. **FeedbackRequest answer 길이**: Claude Haiku max_tokens=300 → 답변 최대 ~1200자 → `max_length=2000` 여유

### 11.3 Session Guide

| Module | 파일 수 | 예상 변경 | 설명 |
|--------|--------|---------|------|
| Module 1 (DB) | 1 | ~70 lines | migration SQL |
| Module 2 (Backend) | 3 | ~120 lines | models + 서비스 2개 |
| Module 3 (API) | 1 | ~40 lines | 엔드포인트 2개 추가 |
| Module 4 (Frontend Hooks) | 2 | ~60 lines | useFeedback + useAnalytics |
| Module 5 (Frontend UI) | 2 | ~120 lines | QAFeedback + QAPanel 연동 |
| Module 6 (Integration) | 2 | ~30 lines | RoadmapPage + useQA 연동 |
| Module 7 (Admin) | 2 | ~130 lines | QAStats + AdminPage 주입 |

**추천 세션 분할:**
- Session 1: Module 1 + 2 + 3 (Backend 전체)
- Session 2: Module 4 + 5 + 6 (Frontend 피드백·이벤트)
- Session 3: Module 7 (Admin 대시보드)

---

## 12. 관련 파일 참조

- `backend/app/api/ai_qa.py` — 기존 router 패턴 (slowapi limiter, SSE_HEADERS)
- `backend/app/services/qa_service.py` — increment_and_check_qa_usage 패턴 참조
- `frontend/src/hooks/useQA.js` — openPanel, sendMessage 훅 패턴 참조
- `frontend/src/components/qa/QAPanel.jsx` — QAFeedback 삽입 위치
- `frontend/src/pages/AdminPage.jsx` — StatCard, BarChart 컴포넌트 재사용
- `supabase/migrations/005_qa_usage.sql` — RLS 패턴 참조
