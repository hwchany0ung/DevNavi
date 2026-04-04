# Completion Report: 로드맵 생성 개인화 정밀도 개선

## Executive Summary

| 관점 | 결과 |
|------|------|
| Problem | skills가 list[str]로 숙련도 구분 없이 전달, 실배포/코딩테스트/팀프로젝트 정보 미수집 |
| Solution | SkillItem{name, level} + ExtraProfile + 프롬프트 SKIP/REVIEW/FOCUS 3구간 분류 구현 완료 |
| Delivered | 백엔드 모델·프롬프트 재설계, 프론트엔드 숙련도 뱃지 UI + 추가 프로필 섹션, 5개 role_references 2026 업데이트 |
| Backward Compat | list[str] 하위호환 validator 적용, 기존 테스트 호환 확인 |

---

## 1. Task 완료 현황

| Task | 상태 | 파일 |
|------|------|------|
| Task 1: Plan 문서 생성 | DONE | `docs/01-plan/features/roadmap-personalization.plan.md` |
| Task 2: role_references 2026 업데이트 | DONE | 5개 파일 (backend, frontend, fullstack, ai_ml, cloud_devops) |
| Task 3: 백엔드 모델 + 프롬프트 재설계 | DONE | roadmap.py, builder.py, roadmap router, claude_service.py |
| Task 4: 프론트엔드 온보딩 UI 수정 | DONE | Step2Form.jsx, OnboardingPage.jsx |

---

## 2. Task 1 — Plan 문서

- **파일**: `docs/01-plan/features/roadmap-personalization.plan.md`
- 문제 정의, 해결 방안(3구간 분류), 범위(In/Out), 리스크, 성공 기준 포함

---

## 3. Task 2 — 2026 트렌드 리서치 + role_references 업데이트

WebSearch로 2026 한국 IT 취업 트렌드를 조사한 후 5개 참조 데이터 파일 업데이트.

### 변경된 파일 및 핵심 추가 내용

| 파일 | 핵심 2026 추가 항목 |
|------|---------------------|
| `backend.py` | Spring Boot 3.x + GraalVM 네이티브, Kotlin 부상, gRPC, AI API 연동 경험 가산점, Rust 백엔드 언급 |
| `frontend.py` | React 19 Server Components, TypeScript 5.x 필수, Next.js 15 App Router 표준화, Tailwind v4, Vitest, React Compiler |
| `fullstack.py` | Next.js 15 App Router 표준화, Bun 런타임 부상, tRPC v11, NestJS 표준 확립, AI 챗봇 SaaS 프로젝트 |
| `ai_ml.py` | AI 에이전트 개발 수요 폭발, LangChain/LangGraph, LoRA/QLoRA, LLMOps, LangSmith/Langfuse 트레이싱, Structured Output |
| `cloud_devops.py` | Platform Engineering (IDP), GitOps ArgoCD 표준화, eBPF/Cilium, FinOps, OpenTofu, OpenTelemetry |

---

## 4. Task 3 — 백엔드 모델 + 프롬프트 재설계

### 4.1 모델 변경 (`backend/app/models/roadmap.py`)

| 추가 항목 | 설명 |
|-----------|------|
| `SkillLevel(str, Enum)` | beginner/basic/intermediate/advanced 4단계 |
| `OnboardingSkillItem(BaseModel)` | name + level 쌍, name sanitize 적용 |
| `ExtraProfile(BaseModel)` | has_deployment, coding_test_level, team_project_count |
| `_coerce_skills()` | list[str] -> list[OnboardingSkillItem] 자동 변환 (하위호환) |
| `FullRoadmapRequest.skills` | `list[OnboardingSkillItem]` + validator |
| `FullRoadmapRequest.extra_profile` | `Optional[ExtraProfile] = None` |
| `CareerSummaryRequest` | 동일 변경 적용 |

### 4.2 프롬프트 변경 (`backend/app/prompts/builder.py`)

| 추가 함수/변경 | 설명 |
|--------------|------|
| `_format_skills_with_levels()` | 3구간 분류 텍스트 생성 (SKIP/REVIEW/FOCUS) |
| `_format_extra_profile()` | ExtraProfile -> 프롬프트 텍스트 변환 |
| `_skills_to_str()` | 하위호환 쉼표 구분 문자열 변환 |
| `FULL_SYSTEM` 프롬프트 | 3구간 분류 + 추가 프로필 반영 규칙 추가 |
| `CAREER_SUMMARY_SYSTEM` | 숙련도별 priority 가이드 추가 |
| `build_full_prompt()` | skills, extra_profile 파라미터 추가 |
| `build_full_prompt_partial()` | 동일 확장 (멀티콜용) |
| `build_career_summary_prompt()` | 동일 확장 |

### 4.3 라우터/서비스 변경

| 파일 | 변경 |
|------|------|
| `backend/app/api/roadmap.py` | extra_profile 전달 추가, OnboardingSkillItem import |
| `backend/app/services/claude_service.py` | stream_full_multicall에 extra_profile 파라미터 추가 |

### 4.4 테스트 업데이트 (`backend/tests/unit/test_coverage_boost.py`)

| 테스트 | 설명 |
|--------|------|
| `test_full_roadmap_request_truncates_skills` (수정) | list[str] -> OnboardingSkillItem 자동 변환 검증 |
| `test_full_roadmap_request_skill_items` (신규) | list[dict] -> OnboardingSkillItem 변환 검증 |
| `test_full_roadmap_request_extra_profile` (신규) | ExtraProfile Optional 필드 검증 |

---

## 5. Task 4 — 프론트엔드 온보딩 UI

### 5.1 Step2Form.jsx

| 변경 | 설명 |
|------|------|
| `SKILL_LEVELS` 상수 | 입문/기초/중급/능숙 4단계 정의 |
| `LEVEL_COLORS` 상수 | 숙련도별 색상 (회색/파랑/노랑/초록) |
| `LevelBadge` 컴포넌트 | 클릭 시 순환 전환되는 숙련도 뱃지 |
| `TagSelector` 확장 | showLevels/onLevelChange 프롭 추가 |
| skills state | `[{name, level}]` 형태로 변경 |
| "더 정교한 로드맵" 섹션 | 접힌 섹션 (실배포 Y/N, 코딩테스트 4지선다, 팀프로젝트 3지선다) |
| `CODING_TEST_OPTIONS`, `TEAM_PROJECT_OPTIONS` | 선택지 상수 정의 |

### 5.2 OnboardingPage.jsx

| 변경 | 설명 |
|------|------|
| `STEP2_INITIAL` | skills: [], extra_profile: null 추가 |
| `_isValidDraft()` | skills [{name, level}] 형태 검증 추가 |
| `computeParamsKey()` | skills `name:level` 형태 키 생성 |
| `_doCareerSummary()` | extra_profile 조건부 포함 |
| `handleStartGenerate()` | extra_profile 조건부 포함 |

---

## 6. 하위호환 보장

| 시나리오 | 동작 |
|---------|------|
| 기존 클라이언트가 `skills: ["React", "Python"]` 전송 | validator가 `[OnboardingSkillItem(name="React", level="basic"), ...]`로 자동 변환 |
| 새 클라이언트가 `skills: [{name: "React", level: "intermediate"}]` 전송 | 그대로 OnboardingSkillItem으로 파싱 |
| `extra_profile` 미전송 | `None` 기본값, 기존 프롬프트 동작 유지 |
| `extra_profile` 전송 | 프롬프트에 추가 컨텍스트 반영 |

---

## 7. 미변경 (Out of Scope 준수)

- DB 스키마 변경 없음
- reroute 프롬프트 미변경 (`build_reroute_prompt` 그대로)
- `data.py`, `security.py`, `ios_android.py`, `qa.py` role_references 미변경
- CSP / rate limit 설정 미변경
- `claude_service.py` 최소 변경 (시그니처 확장만)

---

## 8. 변경 파일 전체 목록 (14개)

### 신규 파일 (2)
1. `docs/01-plan/features/roadmap-personalization.plan.md`
2. `docs/04-report/features/roadmap-personalization.report.md`

### 수정 파일 (12)
3. `backend/app/models/roadmap.py` — SkillLevel, OnboardingSkillItem, ExtraProfile, _coerce_skills 추가
4. `backend/app/prompts/builder.py` — 3구간 분류 헬퍼, 시그니처 확장, SYSTEM 프롬프트 규칙 추가
5. `backend/app/api/roadmap.py` — extra_profile 전달, import 추가
6. `backend/app/services/claude_service.py` — stream_full_multicall extra_profile 파라미터
7. `backend/app/prompts/role_references/backend.py` — 2026 트렌드 업데이트
8. `backend/app/prompts/role_references/frontend.py` — 2026 트렌드 업데이트
9. `backend/app/prompts/role_references/fullstack.py` — 2026 트렌드 업데이트
10. `backend/app/prompts/role_references/ai_ml.py` — 2026 트렌드 업데이트
11. `backend/app/prompts/role_references/cloud_devops.py` — 2026 트렌드 업데이트
12. `backend/tests/unit/test_coverage_boost.py` — 기존 테스트 수정 + 신규 2개 추가
13. `frontend/src/components/onboarding/Step2Form.jsx` — 숙련도 뱃지, 추가 프로필 섹션
14. `frontend/src/pages/OnboardingPage.jsx` — skills/extra_profile 페이로드 변경
