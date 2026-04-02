# Plan: AI Q&A Phase 2 — 피드백 & Analytics

> **Phase**: Plan | **Date**: 2026-04-02 | **Feature**: AI-QA-phase2
> Parent Feature: 태스크별-AI-QA (Phase 1 완료, Match Rate 94%)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | Phase 1 완료 후 SC-01(사용률), SC-02(완료율 향상), SC-03(만족도) 3개 지표가 런타임 데이터 없어 측정 불가 상태 |
| **Solution** | 답변 하단 Thumbs up/down UI + Supabase 피드백 저장 + Q&A 이벤트 로그 + 관리자 대시보드 통계 시각화 |
| **기능 UX 효과** | 사용자는 답변 품질을 1클릭으로 평가, 관리자는 실시간 통계로 Q&A 품질과 서비스 효과를 모니터링 |
| **Core Value** | "측정할 수 없으면 개선할 수 없다" — Phase 1에서 구축한 Q&A 기능을 데이터 기반으로 검증하고 지속 개선 |

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

## 1. 기능 요구사항

### FR-A: Thumbs up/down 피드백 (SC-03)

**FR-A1: UI**
- QAPanel 내 각 assistant 메시지 하단에 👍 / 👎 버튼
- 클릭 후 선택된 버튼 하이라이트 (토글 가능)
- 로그인 필수 — 비로그인 시 "로그인 후 이용 가능" 툴팁

**FR-A2: 데이터 저장**
```
qa_feedback 테이블:
  - id, user_id (FK → auth.users), task_id, question (text), answer (text)
  - rating: 'up' | 'down'
  - created_at
```

**FR-A3: API**
- `POST /ai/qa/feedback`
- Request: `{ task_id, question, answer, rating }`
- Rate limit: 30/hour (피드백 스팸 방지)
- 동일 user+question 조합 중복 시 UPDATE (upsert)

---

### FR-B: Analytics 이벤트 로그 (SC-01, SC-02)

**FR-B1: 이벤트 수집**
```
qa_events 테이블:
  - id, user_id, task_id, event_type, metadata (JSON), created_at

event_type 종류:
  - 'qa_opened'     : "?" 버튼 클릭 (SC-01 분자)
  - 'qa_submitted'  : 질문 전송
  - 'task_checked'  : Q&A 후 태스크 체크 완료 (SC-02 측정용)
```

**FR-B2: 이벤트 발생 시점**
- `qa_opened`: QAButton 클릭 시 (useQA.openPanel)
- `qa_submitted`: 질문 전송 시 (useQA.sendMessage)
- `task_checked`: 태스크 체크 시 & 해당 taskId로 Q&A 세션이 있었을 때 (RoadmapPage handleToggle 연동)

**FR-B3: 비동기 fire-and-forget**
- 이벤트 로깅 실패가 주 기능(Q&A, 체크)에 영향 주면 안 됨
- `POST /ai/qa/event` — 실패 시 console.warn만, 사용자 UX 차단 없음

---

### FR-C: 관리자 대시보드 — Q&A 통계 섹션

**FR-C1: 통계 카드 4개**
- 총 Q&A 횟수 (전체 기간)
- 일별 Q&A 추이 (7일 미니 차트)
- 만족도: 👍 비율 % (qa_feedback 기준)
- Q&A 후 태스크 완료율 향상 % (qa_events 기준)

**FR-C2: 상세 테이블**
- 최근 피드백 20건 (질문 요약 + 평점 + 날짜)
- 낮은 평점(👎) 답변 목록 → 프롬프트 개선 인사이트

**FR-C3: 접근 제어**
- 기존 관리자 인증 방식 재사용
- Supabase RLS: `qa_feedback`, `qa_events` 테이블은 service_role만 전체 조회 가능

---

## 2. 비기능 요구사항

| NFR | 내용 |
|-----|------|
| NFR-01 성능 | 이벤트 로깅 API 응답 ≤ 200ms (비동기 처리) |
| NFR-02 보안 | qa_feedback: user_id 본인 데이터만 INSERT/SELECT (RLS) |
| NFR-03 PIPA | 질문/답변 텍스트 저장 동의 — 기존 consent_records 약관에 포함 여부 확인 필요 |
| NFR-04 가용성 | 이벤트 로깅 실패 시 사용자 기능 차단 없음 (fire-and-forget) |

---

## 3. 기술 스택 및 통합 포인트

### Frontend 수정/추가
- `frontend/src/components/qa/QAPanel.jsx` — Thumbs 버튼 추가
- `frontend/src/hooks/useQA.js` — sendFeedback, logEvent 함수 추가
- `frontend/src/pages/AdminPage.jsx` — Q&A 통계 섹션 추가
- `frontend/src/pages/RoadmapPage.jsx` — handleToggle에 qa_events 'task_checked' 연동

### Backend 추가
- `backend/app/api/ai_qa.py` — POST /ai/qa/feedback, POST /ai/qa/event 엔드포인트 추가
- `backend/app/models/qa_models.py` — FeedbackRequest, EventRequest 모델 추가
- `backend/app/services/qa_service.py` — save_feedback, log_event 함수 추가

### DB Migration
- `supabase/migrations/006_qa_feedback_events.sql`
  - qa_feedback 테이블 + RLS
  - qa_events 테이블 + RLS
  - 집계용 뷰: `v_qa_stats` (관리자 대시보드용)

---

## 4. API 설계

### POST /ai/qa/feedback
```json
Request: { "task_id": "1-1-0", "question": "...", "answer": "...", "rating": "up" }
Response: { "saved": true }
Rate limit: 30/hour
Auth: 필수 (로그인 사용자만)
```

### POST /ai/qa/event
```json
Request: { "task_id": "1-1-0", "event_type": "qa_opened", "metadata": {} }
Response: { "logged": true }
Rate limit: 60/hour
Auth: 선택 (비로그인 시 user_id = null)
```

### GET /admin/qa-stats
```json
Response: {
  "total_qa_count": 1523,
  "satisfaction_rate": 0.82,
  "daily_counts": [...],
  "task_completion_lift": 0.23,
  "recent_feedback": [...]
}
Auth: 관리자 전용
```

---

## 5. 리스크

| 리스크 | 가능성 | 대응 |
|--------|-------|------|
| PIPA: 질문/답변 텍스트 저장 | 중 | 약관 업데이트 + consent_version 갱신 |
| 이벤트 과다 수집으로 DB 용량 | 저 | qa_events 90일 TTL 정책 (pg_cron) |
| 관리자 페이지 접근 제어 미흡 | 저 | 기존 isAdmin 체크 재사용 |

---

## 6. 성공 기준

| SC | 지표 | 목표 |
|----|------|------|
| SC-03 | 답변 만족도 측정 가능 | qa_feedback 데이터 수집 시작 |
| SC-01 | Q&A 사용률 집계 | qa_events 'qa_opened' 30%+ 달성 확인 |
| SC-02 | 완료율 향상 측정 | Q&A 사용 그룹 vs 미사용 그룹 완료율 비교 |
| SC-NEW | 관리자 대시보드 가용 | /admin에서 Q&A 통계 조회 가능 |

---

## 7. 구현 범위 (MVP)

**Phase 2 전체 (1주)**
- M1: DB migration (006_qa_feedback_events.sql)
- M2: Backend 엔드포인트 2개 (/feedback, /event)
- M3: QAPanel Thumbs UI
- M4: useQA logEvent + sendFeedback 추가
- M5: RoadmapPage task_checked 이벤트 연동
- M6: AdminPage Q&A 통계 섹션
- M7: 단위 테스트

---

## 8. 관련 파일 참조

- `backend/app/api/ai_qa.py` — 기존 패턴 확장
- `frontend/src/pages/AdminPage.jsx` — 관리자 페이지 구조 파악
- `backend/app/services/qa_service.py` — 기존 서비스 확장
- `supabase/migrations/003_increment_and_check_usage_rpc.sql` — RPC 패턴 참조
