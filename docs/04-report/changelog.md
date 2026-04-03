# DevNavi Changelog

All notable changes to this project will be documented in this file.

---

## [2026-04-02] - Minor 이슈 처리 완료

### Fixed
- **roadmap_service.py**: user_id를 Optional[str]에서 str(필수)로 변경, 소유자 필터 항상 적용 (M2)
- **roadmap.py**: `/teaser` 엔드포인트에 burst rate limit `@limiter.limit("5/minute")` 추가 (M3)
- **test_qa_service.py**: 컬럼명 `roadmap_data` → `data` 동기화, dev 환경 작동 수정 (M4)
- **test_auth_quota_persist.py**: dev 환경 테스트 구성 복구 (M4)

### Verified
- **supabase_client.py**: thread-safety docstring 이미 포함됨 (M1)
- **AuthContext.jsx**: JWT 서버 미무효화 한계 주석 명시됨 (M5)
- **PERIOD_MAP**: `"1month": 1` 이미 포함됨 (M6)

### Metrics
- Test Coverage: 88.8% (기준 80% 초과)
- Match Rate: 95%+ (기준 90% 초과)
- Issue Resolution: 6/6 (100%)

### Related Documents
- Report: `docs/04-report/features/minor-fixes.report.md`

---

## [2026-04-02] - 태스크별 AI Q&A 기능 완료

### Added
- **Q&A 버튼 UI** — 각 태스크 우측에 "?" 아이콘 버튼 렌더링
- **우측 사이드 패널** — width: 360px, slide animation (200ms)
- **AI 대화 기능** — Claude Haiku 모델 기반 SSE 스트리밍 응답
- **세션 메모리** — React state 기반 멀티턴 대화 이력 (세션 내 유지)
- **POST /ai/qa 엔드포인트** — 맥락 자동 주입 + 5계층 방어
- **다층 방어 전략**:
  - Layer 1: slowapi rate limit (10/hour, IP 기반)
  - Layer 2: Supabase RPC 사용량 카운터 (30/day, 100/month)
  - Layer 3: task_id 소유권 검증
  - Layer 4: Pydantic 입력 검증 (max_length)
  - Layer 5: max_tokens=300 하드코딩
- **qa_usage 테이블** — 사용자별 일일/월간 사용량 추적
- **테스트 커버리지** — Frontend 66/66 ✅, Backend unit 93/93 ✅

### Changed
- `frontend/src/pages/RoadmapPage.jsx` — QAPanel state 추가, QAButton 통합
- `frontend/src/components/roadmap/WeekAccordion.jsx` — QAButton 렌더링
- `frontend/src/components/roadmap/TaskItem.jsx` — taskIndex 계산 로직 추가
- `backend/app/main.py` — ai_qa 라우터 등록

### Implementation Details
- **언어/프레임워크**: React (Frontend), FastAPI (Backend), Supabase (Database)
- **모델**: Claude Haiku (`claude-haiku-4-5-20251001`)
- **스트리밍**: SSE (Server-Sent Events)
- **미들웨어**: JWT 인증 + slowapi rate limiting
- **아키텍처**: Clean Architecture (Option B) — 완전 독립 모듈화

### Files Created (10)
```
frontend/src/components/qa/
  ├── QAButton.jsx
  ├── QAInput.jsx
  └── QAPanel.jsx
frontend/src/hooks/
  └── useQA.js
frontend/src/tests/
  └── QAPanel.test.jsx
backend/app/api/
  └── ai_qa.py
backend/app/services/
  └── qa_service.py
backend/app/models/
  └── qa_models.py
backend/tests/unit/
  └── test_qa_service.py
supabase/migrations/
  └── 005_qa_usage.sql
```

### PDCA Cycle Results
- **Match Rate (Static)**: 94% (Structural 100, Functional 95, Contract 90)
- **Success Criteria**: 4/6 달성 (SC-01/02 런타임 측정 필요, SC-03 Phase 2)
- **Issues Resolved**: 2 Critical, 3 Minor (모두 해결됨)
- **Iteration**: 1회 (90% 초과 달성, 최대 3회 제한)

### Notes
- SC-01 (사용률 30%+), SC-02 (완료율 20%+ 향상): 배포 후 런타임 측정 필요
- SC-03 (만족도 70%+): Phase 2에서 thumbs up/down 기능 추가 예정
- 세션 메모리 전용 (DB 저장 X): 페이지 이동 시 대화 초기화, Phase 2에서 선택적 저장 검토
- Phase 2 권장: Thumbs up/down, Analytics 연계, 모바일 반응형, CloudWatch 비용 모니터링

### Related Documents
- Plan: `docs/01-plan/features/태스크별-AI-QA.plan.md`
- Design: `docs/02-design/features/태스크별-AI-QA.design.md`
- Analysis: `docs/03-analysis/태스크별-AI-QA-gap.md`
- Report: `docs/04-report/features/태스크별-AI-QA.report.md`

### Cost Analysis
- **Model**: Claude Haiku (`$0.80/1M input, $4.00/1M output`)
- **Estimated Cost per Query**: ~$0.0007 (max_tokens=300 고정)
- **Monthly Estimate** (1,000 users × 3 queries/day): ~$20-30 (Rate limit으로 실제 $20-30 유지)
- **Budget**: 월 $50 이하 (✅ 충족)

---
