# DevNavi 전체 코드베이스 보안/품질 리뷰 보고서

**작성일:** 2026-04-05
**리뷰 범위:** backend/app/{api,services,middleware,core,models}/ + frontend/src/{pages,components,contexts,lib}/
**리뷰어:** Claude Code (claude-sonnet-4-6)

---

## 심각도 분류 기준

| 등급 | 기준 |
|------|------|
| CRIT | 즉시 악용 가능한 보안 취약점 또는 데이터 손실 위험 |
| HIGH | 런타임 장애 가능성이 높거나 중요한 보안 결함 |
| MED  | UX 저하, 성능 문제, silent failure |
| LOW  | 코드 스멜, dead code, 경미한 타입 문제 |

---

## CRIT 이슈

| SEVERITY | FILE:LINE | CATEGORY | DESCRIPTION | RECOMMENDED FIX |
|----------|-----------|----------|-------------|-----------------|
| CRIT | backend/app/api/admin.py:398~422 | 보안 — 비원자적 롤백 | rollback_reference 엔드포인트가 현재 버전 비활성화와 이전 버전 활성화를 두 번의 별도 PATCH로 수행한다. 두 PATCH 사이 서버/네트워크 장애 시 role_references에 active 레코드가 0개인 상태가 되어 해당 직군의 로드맵 생성이 완전히 중단된다. | Supabase RPC(rpc/rollback_role_reference)를 만들어 트랜잭션 내에서 두 UPDATE를 원자적으로 처리할 것. |

---

## HIGH 이슈

| SEVERITY | FILE:LINE | CATEGORY | DESCRIPTION | RECOMMENDED FIX |
|----------|-----------|----------|-------------|-----------------|
| HIGH | frontend/src/pages/RoadmapPage.jsx:336~348 | API 계약 불일치 | /roadmap/reroute 요청 바디에 roadmap_id가 포함되지 않는다. 백엔드 RerouteRequest 모델에 roadmap_id 필드가 있어 서버측 완료율 검증(I-3)이 가능한데, 프론트가 이를 전송하지 않아 클라이언트가 보낸 completion_rate가 그대로 사용된다. | 요청 바디에 roadmap_id: id를 추가할 것. (id는 useParams()에서 이미 추출된 값) |
| HIGH | frontend/src/components/qa/QAHistoryPanel.jsx:44~46 | 에러 핸들링 / API 계약 | VITE_API_BASE_URL이 없을 때 undefined/ai/qa/history로 fetch가 호출된다. api.js의 request() 함수는 BASE_URL을 /api로 fallback하지만 이 컴포넌트는 raw fetch()를 직접 사용해 fallback이 없다. 401 자동 재시도 로직도 누락된다. | fetch() 직접 호출을 request() 호출로 교체할 것. |
| HIGH | backend/app/api/admin.py:193~199 | 성능 — 집계 데이터 truncation | get_stats에서 user_rows_resp와 roadmap_rows_resp가 최대 limit=1000으로 반환된다. 데이터가 1000건을 초과하면 daily_signups, daily_roadmaps 차트 데이터가 부정확해진다. | Supabase DB 뷰에서 날짜별 집계를 수행하고 집계 결과만 반환하도록 변경할 것. |
| HIGH | backend/app/services/qa_service.py:62~65 | 보안 — prompt injection 방어 불완전 | _sanitize_prompt_input이 {}만 제거한다. 개행 문자(
, )와 유니코드 방향 제어 문자(U+202E 등)는 제거되지 않아 시스템 프롬프트 구조를 왜곡할 수 있다. | 제어 문자(unicode category Cc, Cf) 전체 제거를 추가하거나 QATaskContext.job_type을 Literal 열거형으로 제한할 것. |

---

## MED 이슈

| SEVERITY | FILE:LINE | CATEGORY | DESCRIPTION | RECOMMENDED FIX |
|----------|-----------|----------|-------------|-----------------|
| MED | backend/app/api/roadmap.py:183~196 | 에러 핸들링 — streaming exception | /roadmap/full에서 stream_full/stream_full_multicall 생성기가 HTTP 200 이후 예외를 발생시키면 [DONE] 없이 조용히 끊긴다. 서버 로그에도 원인이 기록되지 않는다. | _with_usage_check 래퍼에서 스트리밍 예외를 잡아 error SSE 이벤트를 yield하고 logger.exception으로 기록할 것. |
| MED | frontend/src/pages/OnboardingPage.jsx:301~326 | 보안 — 민감 데이터 localStorage 저장 | 로드맵 전체 JSON(스킬, 학습계획 포함)을 devnavi_roadmap_ 키로 localStorage에 저장한다. XSS 간접 경로로 유출 가능하다. | 단기: 저장 데이터에서 개인식별 정보 최소화. 장기: roadmap_id만 로컬에 저장하고 데이터는 서버에서 항상 조회하는 방식으로 전환. |
| MED | backend/app/api/admin.py:291~325 | 에러 핸들링 — partial failure | get_qa_stats의 asyncio.gather 실패 시 전체를 0 반환하여 일부 성공한 쿼리 결과도 버린다. | asyncio.gather(return_exceptions=True)를 사용하고 각 결과를 개별 처리할 것. |
| MED | backend/app/services/claude_service.py:20~25 | 성능 — Lambda BUFFERED SSE 제약 | Lambda BUFFERED 모드에서 SSE keepalive가 클라이언트에 전달되지 않아 1year_plus 생성(60s 이상) 시 CloudFront idle timeout으로 연결이 끊길 수 있다. | Lambda Response Streaming(RESPONSE_STREAM) 모드 전환을 검토하거나, 장기 생성 시 예상 소요시간 UI 안내를 추가할 것. |
| MED | backend/app/api/admin.py:258~260 | 에러 핸들링 — 예외 구분 없음 | get_qa_stats의 except Exception이 Supabase 장애와 프로그래밍 오류를 동일하게 처리한다. | AttributeError 등 예상치 못한 예외는 logger.exception으로 스택트레이스를 기록할 것. |
| MED | backend/app/services/roadmap_service.py:~line 53 | 에러 핸들링 | persist_roadmap이 supabase_ready=False일 때 랜덤 UUID를 반환하여 이후 조회가 404를 반환한다. 이 동작이 침묵적으로 실패한다. | supabase_ready=False일 때 HTTP 503을 반환하거나 동작을 명확히 문서화할 것. |
| MED | frontend/src/pages/RoadmapPage.jsx:186 | 에러 핸들링 — UI 표시 누락 가능 | request('/roadmap/') 실패 시 setError(e.message)가 호출되지만 error 상태에 대한 UI 렌더 분기가 있는지 전체 JSX에서 추가 확인이 필요하다. | error 상태 시 명시적 에러 UI(재시도 버튼 포함)가 표시되는지 확인할 것. |

---

## LOW 이슈

| SEVERITY | FILE:LINE | CATEGORY | DESCRIPTION | RECOMMENDED FIX |
|----------|-----------|----------|-------------|-----------------|
| LOW | backend/app/api/roadmap.py + backend/app/api/ai_qa.py | 코드 품질 — 상수 중복 | SSE_HEADERS 딕셔너리가 roadmap.py와 ai_qa.py 두 곳에 동일하게 정의되어 있다. | app/core/constants.py에 공통 상수로 이동할 것. |
| LOW | frontend/src/pages/LandingPageMockup.jsx | 코드 품질 — dead code | 프로덕션에서 전혀 사용되지 않는 목업 파일이다. | 삭제하거나 src/dev/ 하위로 이동할 것. |
| LOW | backend/app/models/roadmap.py | 코드 품질 — validator 중복 | FullRoadmapRequest와 CareerSummaryRequest가 동일한 coerce_skills_items, truncate_certs validator를 각각 독립 정의한다. | 공통 Mixin 또는 base class로 추출할 것. |
| LOW | backend/app/services/usage_service.py:41~45 | 코드 품질 — 모듈 로드 부수효과 | _DEV_BYPASS_USERS가 모듈 임포트 시 즉시 평가되어 Lambda 웜 인스턴스에서 DEV_BYPASS_USERS 환경변수 갱신이 반영되지 않는다. | check_and_increment 내부에서 settings에서 직접 읽도록 변경할 것. |
| LOW | backend/app/api/roadmap.py:58 | 코드 품질 — 타입 힌트 불완전 | _ALLOWED_JOB_ROLES: frozenset 에서 원소 타입이 누락되어 있다. | frozenset[str]으로 수정할 것. |
| LOW | frontend/src/lib/validation.js:1 | 코드 품질 — 정규식 이스케이프 | PASSWORD_RE 내 ]가 이스케이프 없이 사용되어 일부 엔진에서 경고를 유발할 수 있다. | \]로 이스케이프할 것. |
| LOW | frontend/src/contexts/AuthContext.jsx:48~64 | 코드 품질 — 멀티탭 동의 경쟁 조건 | devnavi_consent_sent_ 낙관적 잠금이 멀티탭 환경에서 두 번째 탭의 동의 재전송을 차단할 수 있다. | 주석에 한계를 명시하고 필요 시 서버측 idempotency로 보완할 것. |

---

## SUMMARY

### 이슈 건수 요약

| 심각도 | 건수 |
|--------|------|
| CRIT   | 1    |
| HIGH   | 4    |
| MED    | 7    |
| LOW    | 7    |
| **합계** | **19** |

### Top 3 가장 중요한 발견

1. **[CRIT] admin.py:398 — rollback 비원자적 처리**: 두 PATCH 사이에 장애 발생 시 특정 직군의 active role_references가 0개가 되어 해당 직군 로드맵 생성이 완전히 차단된다. Supabase RPC 트랜잭션으로 즉시 교체 필요.

2. **[HIGH] RoadmapPage.jsx:336 — reroute 요청에 roadmap_id 미전송**: 백엔드 I-3 수정(서버측 완료율 검증)이 프론트 미전송으로 무력화된다. roadmap_id: id 한 줄 추가로 해결된다.

3. **[HIGH] QAHistoryPanel.jsx:44 — raw fetch() 직접 사용**: api.js의 공통 에러 처리, BASE_URL fallback, 401 자동 재시도가 모두 우회된다.

### 권장 첫 번째 조치

RoadmapPage.jsx reroute 바디에 roadmap_id: id 추가(1줄 변경) → QAHistoryPanel.jsx raw fetch를 request() 교체 → admin.py rollback RPC 원자화(Supabase migration 추가) 순으로 진행 권장.
