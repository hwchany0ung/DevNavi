# Plan: 태스크별 AI Q&A

> **Phase**: Plan | **Date**: 2026-04-02 | **Feature**: 태스크별-AI-QA
> PRD Reference: `docs/00-pm/태스크별-AI-QA.prd.md`

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 사용자가 로드맵 태스크를 보고 "이게 뭔지 몰라서" 이탈 — 현재 외부 검색(구글/ChatGPT) 의존 |
| **Solution** | 각 태스크 옆 Q&A 버튼 → 우측 사이드 패널에서 태스크 맥락(직군·월차·주차·카테고리) 자동 주입 Claude Haiku 답변 |
| **기능 UX 효과** | 외부 이탈 없이 태스크 이해→실행→완료 루프를 단일 화면에서 완성, 태스크 완료율 20%+ 향상 목표 |
| **Core Value** | "AI가 만든 로드맵을 AI가 실행까지 도와준다" — 계획 생성(Plan)에서 실행 지원(Do)으로 가치 체인 확장 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 태스크 수행 가이드 부재로 인한 이탈 및 로드맵 완료율 정체 해소 |
| **WHO** | IT 직군 취업 준비생 (비전공 전환자 Beachhead), 특히 태스크 의미를 모르는 초보 개발자 |
| **RISK** | 악의적 사용자의 API 비용 남용, Q&A 품질이 낮으면 오히려 혼란 야기 |
| **SUCCESS** | Q&A 사용률 30%+, 태스크 완료율 20%+ 향상, 답변 만족도 70%+, API 비용 월 $50 이하 |
| **SCOPE** | 로드맵 페이지 태스크 항목 Q&A 버튼 + 우측 사이드 패널 + 백엔드 /ai/qa 엔드포인트 + 다층 방어 |

---

## 1. 기능 요구사항 (Functional Requirements)

### FR-01: Q&A 트리거 UI
- 각 태스크 항목 우측에 "?" 아이콘 버튼 표시
- 버튼 클릭 → 우측 사이드 패널 슬라이드 인
- 사이드 패널에는 선택한 태스크명 헤더 표시

### FR-02: 태스크 맥락 자동 주입
백엔드 프롬프트에 다음 컨텍스트 자동 포함:
```
직군: {job_type}
현재 월차/주차: {month}개월차 {week}주차
태스크 카테고리: {category}
태스크명: {task_name}
```

### FR-03: Claude Haiku Q&A 응답
- 모델: `claude-haiku-4-5-20251001`
- max_tokens: **300** (비용 상한 고정)
- SSE 스트리밍 응답 (기존 패턴 재사용)
- 세션 내 멀티턴 대화 지원 (이전 메시지 배열 유지)

### FR-04: 세션 메모리 대화 이력
- 대화 이력: React state (세션 메모리만, DB 저장 없음)
- 페이지 이동/새로고침 시 초기화
- 같은 태스크 재클릭 시 이전 대화 유지 (useState Map: taskId → messages)

### FR-05: 다층 방어 전략 (보안 필수)
```
Layer 1 — Rate Limiting (slowapi)
  - 시간당: 10회
  - 일당: 30회
  - 월간: 100회 (free tier)

Layer 2 — 토큰 예산 제한
  - max_tokens=300 하드코딩 (요청으로 변경 불가)

Layer 3 — 사용량 카운터
  - Supabase qa_usage 테이블 or 기존 usage 확장
  - increment_and_check_usage RPC 패턴 재활용
  - 한도 초과 시 HTTP 429 + "오늘 질문 한도를 소진했습니다" 메시지

Layer 4 — 입력 검증
  - question: str = Field(max_length=200)
  - task_id: 소유권 검증 (해당 user의 roadmap에 속하는지 확인)

Layer 5 — 비용 모니터링
  - CloudWatch 알람: 일일 Haiku 호출 임계치 초과 시 알림
```

### FR-06: 사이드 패널 UX
- 화면 우측 슬라이드 인 패널 (width: 360px)
- X 버튼으로 닫기
- 스크롤 가능한 대화 영역
- 하단 고정 입력 폼 (textarea + 전송 버튼)
- 응답 스트리밍 중 입력 비활성화

---

## 2. 비기능 요구사항 (Non-Functional Requirements)

### NFR-01: 성능
- Q&A 첫 토큰 응답: ≤ 2초 (Haiku 모델 기준)
- 사이드 패널 열림 애니메이션: 200ms

### NFR-02: 비용
- Q&A 1회당 예상 비용: ~$0.0007 (Haiku)
- 월 1,000 활성 사용자 × 일평균 3회 × 30일 = ~$63 → Rate limit으로 실제 $20-30 수준 유지

### NFR-03: 보안
- 인증된 사용자만 접근 (기존 JWT 미들웨어)
- CORS: 기존 정책 동일
- Rate limit 초과 로그 기록 (감사 목적)

---

## 3. 기술 스택 및 통합 포인트

### Frontend
- `frontend/src/pages/RoadmapPage.jsx` — QAPanel 컴포넌트 마운트
- `frontend/src/components/roadmap/QAPanel.jsx` — 신규 컴포넌트
- `frontend/src/components/roadmap/QAButton.jsx` — 태스크별 버튼
- 기존 `streamSSE` 유틸리티 재사용

### Backend
- `backend/app/api/ai_qa.py` — 신규 라우터 (`/ai/qa`)
- `backend/app/services/qa_service.py` — 맥락 주입 + Haiku 호출
- `backend/app/models/qa_models.py` — 요청/응답 Pydantic 모델
- slowapi rate limit 데코레이터 적용
- 기존 `increment_and_check_usage` RPC 재활용

### DB (Supabase)
- 기존 `usage_counts` 테이블에 `qa_daily_count` 컬럼 추가 또는 별도 `qa_usage` 테이블
- RPC: `increment_and_check_qa_usage(user_id, daily_limit, monthly_limit)`

---

## 4. API 설계

### POST /ai/qa
```
Request:
{
  "task_id": "1-1-0",           // "${month}-${week}-${taskIndex}" 형식
  "question": "이게 뭔가요?",    // max_length=200
  "messages": [                  // 이전 대화 이력 (세션 메모리)
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}

Response: SSE 스트리밍
data: {"type": "delta", "content": "Docker는..."}
data: {"type": "done"}
data: {"type": "error", "message": "한도 초과"}
```

### Rate Limit 응답
```
HTTP 429
{
  "detail": "오늘 질문 한도(30회)를 소진했습니다. 내일 다시 이용해주세요."
}
```

---

## 5. 리스크

| 리스크 | 가능성 | 영향 | 대응 |
|--------|-------|------|------|
| 악의적 API 남용 | 중 | 高 | 다층 방어 (FR-05) 필수 구현 |
| Haiku 품질 부족 | 중 | 중 | 맥락 주입 프롬프트 최적화 |
| task_id 검증 우회 | 저 | 중 | DB 소유권 쿼리 필수 |
| SSE 스트리밍 중단 | 저 | 저 | 기존 패턴 재사용으로 검증됨 |

---

## 6. 성공 기준 (Success Criteria)

| SC | 지표 | 목표 |
|----|------|------|
| SC-01 | Q&A 버튼 사용률 | 로드맵 방문자의 30%+ |
| SC-02 | 태스크 완료율 변화 | Q&A 사용 그룹 20%+ 향상 |
| SC-03 | 답변 만족도 | 70%+ (thumbs up 기준) |
| SC-04 | API 비용 | 월 $50 이하 유지 |
| SC-05 | Rate limit 응답 시간 | 429 응답 ≤ 100ms |
| SC-06 | 보안 | task_id 소유권 우회 0건 |

---

## 7. 구현 범위 (MVP)

**Phase 1 (1주, MVP)**
- FR-01: Q&A 버튼 + 사이드 패널 기본 UI
- FR-02: 맥락 자동 주입
- FR-03: Haiku 스트리밍 응답
- FR-05: Layer 1~4 방어 (필수)

**Phase 2 (추후)**
- FR-06: 패널 UX 개선 (thumbs up/down 피드백)
- Layer 5: CloudWatch 비용 알람
- 프리미엄 플랜 한도 확장 (결제 기능과 연계)

---

## 8. 관련 파일 (기존 참조)

- `backend/app/api/auth.py` — rate limit 패턴 참조 (5/minute → Q&A는 10/hour)
- `backend/app/services/claude_service.py` — SSE 스트리밍 패턴 참조
- `backend/supabase/migrations/003_increment_and_check_usage_rpc.sql` — RPC 패턴 참조
- `frontend/src/pages/RoadmapPage.jsx` — 태스크 구조 (months, doneSet) 참조
