# Role References 자동 갱신 파이프라인 설계

**날짜**: 2026-04-04  
**상태**: 승인됨  
**담당**: DevNavi

---

## 목적

`role_references` 데이터(직군별 기술 트렌드 참조)를 실제 채용공고·기술 블로그·패키지 통계 기반으로 자동 갱신하여, Claude 프롬프트에 주입되는 정보의 신선도와 정확도를 유지한다.

기존 정적 Python 파일(`backend/app/prompts/role_references/*.py`) 방식에서 Supabase DB 동적 조회 방식으로 전환한다. 정적 파일은 DB 장애 시 fallback으로 유지한다.

---

## 아키텍처 개요

```
GitHub Actions (월 1회 cron + 수동 트리거)
    ↓
backend/scripts/refresh_references.py
    ├── collectors/ (4개 소스 병렬 수집)
    ├── aggregator.py (가중치 기반 점수 산출)
    ├── validator.py (Claude API 교차검증 + 텍스트 생성)
    ├── db_writer.py (Supabase upsert + 버전 전환)
    └── notifier.py (diff 생성 + 이메일 발송)
         ↓
Supabase DB (pipeline_runs / reference_sources / role_references)
         ↓
백엔드 get_reference() — DB 우선 조회, 없으면 정적 파일 fallback
```

---

## 데이터 수집 레이어

4개 소스를 병렬 수집한다.

| 소스 | 수집 내용 | 신호 성격 |
|------|----------|---------|
| 워크넷 Open API | 직군별 채용공고 최대 100건, 우대/필수 기술 필드 | 한국에서 요구하는 것 |
| 테크 블로그 RSS | 카카오·네이버D2·토스·라인·우아한형제들·쿠팡·당근 최근 90일 포스트 | 실제 쓰는 것 |
| npm/PyPI stats API | 직군별 핵심 패키지 최근 6개월 다운로드, 전분기 대비 증감률 | 전 세계 실사용량 |
| Stack Overflow Survey | 연간 공개 CSV — 언어/프레임워크 선호도 | 개발자 선호 글로벌 베이스라인 |

---

## 교차검증 로직

### 가중치

```python
WEIGHTS = {
    "worknet":   0.40,  # 실제 채용공고 — 가장 직접적 신호
    "tech_blog": 0.30,  # 실제 사용 기술
    "npm_pypi":  0.20,  # 실사용량 수치
    "so_survey": 0.10,  # 글로벌 베이스라인 (연 1회 갱신)
}
```

### Priority 산출

```
기술별 종합 점수 = Σ(소스별 언급빈도 정규화 × 가중치)

score ≥ 0.6  → priority 1 (필수)
score ≥ 0.3  → priority 2 (권장)
score < 0.3  → priority 3 (추천) 또는 제외
```

### Claude API 역할

Claude는 "전체 판단자"가 아닌 **이상값 필터 + 텍스트 포매터**로만 사용한다.

1. 수치 기반 점수 산출 (코드)
2. Claude에게 점수 목록 전달 → 한국 취업 현실과 맞지 않는 이상값 제거
3. 기존 `REFERENCE` 문자열 형식으로 최종 텍스트 생성

---

## Supabase 스키마

### `pipeline_runs` — 실행 이력 (감사 추적)

```sql
create table pipeline_runs (
  id           uuid primary key default gen_random_uuid(),
  triggered_by text not null,  -- 'cron' | 'manual' | 'admin:{email}'
  status       text not null check (status in ('running','completed','failed')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  error        text,
  meta         jsonb   -- Actions run_id, 브랜치 등
);
```

### `reference_sources` — 소스별 수집 결과 (추적 가능성)

```sql
create table reference_sources (
  id              uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references pipeline_runs(id) on delete cascade,
  role            text not null,
  source_type     text not null check (source_type in ('worknet','tech_blog','npm_pypi','so_survey')),
  raw_stats       jsonb not null,  -- 기술 키워드별 빈도, 점수 원본
  collected_at    timestamptz not null default now()
);

create index on reference_sources(pipeline_run_id, role);
```

### `role_references` — 최종 참조 데이터 (버전 관리)

```sql
create table role_references (
  id              uuid primary key default gen_random_uuid(),
  role            text not null check (role in (
                    'backend','frontend','cloud_devops','fullstack',
                    'data','ai_ml','security','ios_android','qa')),
  version         integer not null,
  content         text not null,
  pipeline_run_id uuid references pipeline_runs(id),
  is_active       boolean not null default false,
  activated_at    timestamptz,
  activated_by    text,  -- 'auto' | admin email
  created_at      timestamptz not null default now()
);

-- 직군당 active 버전은 반드시 1개
create unique index uq_role_active on role_references(role) where is_active = true;
create index on role_references(role, version desc);
```

### 테이블 관계

```
pipeline_runs
    ├── reference_sources (1:N) — 소스별 raw 데이터 보존
    └── role_references   (1:N) — 생성된 참조 데이터와 연결
```

---

## GitHub Actions 워크플로우

**파일**: `.github/workflows/refresh-references.yml`

```yaml
on:
  schedule:
    - cron: '0 2 1 * *'   # 월 1회 (매월 1일 02:00 KST)
  workflow_dispatch:
    inputs:
      roles:
        description: '특정 직군만 (쉼표 구분, 비우면 전체)'
        default: ''

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - name: Run pipeline
        env:
          WORKNET_API_KEY: ${{ secrets.WORKNET_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          NOTIFY_EMAIL: ${{ secrets.NOTIFY_EMAIL }}
        run: python backend/scripts/refresh_references.py
```

---

## 스크립트 구조

```
backend/scripts/refresh_references.py   # 진입점
backend/scripts/collectors/
    worknet.py       # 워크넷 API 호출
    tech_blog.py     # RSS 파싱 (7개사)
    pkg_stats.py     # npm/PyPI stats API
    so_survey.py     # SO Survey CSV 파싱
backend/scripts/aggregator.py           # 가중치 기반 점수 산출
backend/scripts/validator.py            # Claude API 교차검증 + 텍스트 생성
backend/scripts/db_writer.py            # Supabase upsert + is_active 전환
backend/scripts/notifier.py             # diff 생성 + 이메일 발송
```

---

## 백엔드 연동

`backend/app/prompts/role_references/__init__.py`의 `get_reference()`를 수정:

```python
async def get_reference(role: str) -> str:
    db_ref = await fetch_active_reference(role)   # Supabase 조회
    return db_ref or ROLE_REFERENCE_MAP.get(role, "")  # fallback
```

정적 파일은 삭제하지 않고 유지 — DB 장애 시 자동 fallback.

---

## 롤백

`is_active` 플래그 변경만으로 즉시 이전 버전으로 복귀:

```
POST /admin/references/{role}/rollback
Authorization: Bearer {ADMIN_TOKEN}
```

별도 복구 작업 없음. 이전 버전이 DB에 보존돼 있어 언제든 활성화 가능.

---

## 이메일 월간 리포트 형식

```
제목: [DevNavi] 월간 기술 트렌드 리포트 — 2026년 7월

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 수집 현황
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 워크넷 채용공고 분석: 892건
• 테크 블로그 포스트: 143건 (7개사)
• npm/PyPI 패키지 통계: 직군별 상위 20개
• 실행 시간: 8분 32초

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆕 직군별 변경사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[backend] v3 → v4
  ✅ 추가: gRPC (priority 2 신규 등장 — 채용공고 18건 언급)
  ✅ 추가: Rust/Axum (priority 3 — 스타트업 중심 급증)
  ⬇ 변경: MyBatis priority 1 → 2 (신규 공고 언급 감소)
  ─ 유지: Java/Spring Boot, Python/FastAPI, Redis 외 12개

[frontend] v5 → v6
  ✅ 추가: Vite 6 (priority 2 — npm 다운로드 전월 대비 +34%)
  ─ 유지: React 19, TypeScript 5.x, Next.js 15 외 10개

[ai_ml] 변경 없음 (v4 유지)

[cloud_devops, data, security, fullstack, ios_android, qa] 변경 없음

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 롤백 필요 시
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST https://api.devnavi.kr/admin/references/{role}/rollback
Authorization: Bearer {ADMIN_TOKEN}

파이프라인 실행 ID: {pipeline_run_id}
소스 통계 원본: Supabase > reference_sources
```

---

## 오류 처리

| 상황 | 동작 |
|------|------|
| 워크넷 API 타임아웃 | 해당 소스 제외 후 나머지 3개로 계속 진행, 이메일에 경고 포함 |
| Claude API 실패 | 수치 기반 텍스트만으로 저장 (검증 미완 표시) |
| Supabase 연결 실패 | pipeline_run status=failed 기록, 이메일 알림, 기존 active 버전 유지 |
| 모든 소스 실패 | 즉시 종료, 기존 데이터 변경 없음 |

---

## 구현 순서

1. Supabase 마이그레이션 (3개 테이블 생성)
2. `collectors/` 4개 모듈 구현
3. `aggregator.py` 가중치 점수 산출
4. `validator.py` Claude API 연동
5. `db_writer.py` Supabase upsert + 버전 관리
6. `notifier.py` diff + 이메일
7. 백엔드 `get_reference()` DB 조회로 전환
8. GitHub Actions 워크플로우 추가
9. 관리자 rollback 엔드포인트 추가
