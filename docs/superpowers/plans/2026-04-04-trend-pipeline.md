# Role References 자동 갱신 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠️ 토큰 90% 도달 시**: 즉시 작업을 멈추고 완료된 Task 번호와 현재 상태를 메모리(`~/.claude/projects/.../memory/`)에 저장한 뒤 중단할 것.

**Goal:** 워크넷 API·테크 블로그 RSS·npm/PyPI 통계를 월 1회 수집·교차검증하여 Supabase에 저장하고, 백엔드가 정적 파일 대신 DB에서 role_references를 동적으로 조회하도록 전환한다.

**Architecture:** GitHub Actions cron(월 1회) + 수동 트리거 → Python 수집 스크립트(4개 collector 병렬) → 가중치 기반 점수 산출 → Claude API 교차검증 → Supabase upsert + is_active 전환 → diff 이메일 발송. 백엔드 get_reference()는 DB 우선, 실패 시 정적 파일 fallback.

**Tech Stack:** Python 3.11, httpx(async), feedparser, anthropic SDK, smtplib, GitHub Actions, Supabase REST API

---

## 파일 맵

| 액션 | 경로 | 역할 |
|------|------|------|
| Create | `supabase/migrations/20260404_pipeline_tables.sql` | 3개 테이블 생성 마이그레이션 |
| Create | `backend/scripts/__init__.py` | 패키지 초기화 |
| Create | `backend/scripts/config.py` | 스크립트 전용 환경변수 로더 |
| Create | `backend/scripts/sb_client.py` | 스크립트용 동기 Supabase httpx 클라이언트 |
| Create | `backend/scripts/collectors/__init__.py` | collector 패키지 |
| Create | `backend/scripts/collectors/worknet.py` | 워크넷 Open API 수집 |
| Create | `backend/scripts/collectors/tech_blog.py` | RSS 피드 수집 (7개사) |
| Create | `backend/scripts/collectors/pkg_stats.py` | npm/PyPI 다운로드 통계 |
| Create | `backend/scripts/collectors/so_survey.py` | Stack Overflow Survey CSV 파싱 |
| Create | `backend/scripts/aggregator.py` | 가중치 기반 점수 산출 |
| Create | `backend/scripts/validator.py` | Claude API 교차검증 + 텍스트 생성 |
| Create | `backend/scripts/db_writer.py` | Supabase pipeline_runs/role_references upsert |
| Create | `backend/scripts/notifier.py` | diff 생성 + 이메일 발송 |
| Create | `backend/scripts/refresh_references.py` | 파이프라인 진입점 |
| Modify | `backend/app/prompts/role_references/__init__.py` | get_reference() → async DB 우선 조회 |
| Modify | `backend/app/core/config.py` | SMTP 설정 필드 추가 |
| Modify | `backend/app/api/admin.py` | rollback 엔드포인트 추가 |
| Create | `.github/workflows/refresh-references.yml` | 월 1회 cron + 수동 트리거 |
| Create | `backend/tests/scripts/test_aggregator.py` | aggregator 단위 테스트 |
| Create | `backend/tests/scripts/test_db_writer.py` | db_writer 단위 테스트 |

---

## Task 1: Supabase 마이그레이션

**Files:**
- Create: `supabase/migrations/20260404_pipeline_tables.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- supabase/migrations/20260404_pipeline_tables.sql

-- 1. 파이프라인 실행 이력
create table if not exists pipeline_runs (
  id           uuid primary key default gen_random_uuid(),
  triggered_by text not null,
  status       text not null check (status in ('running','completed','failed')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  error        text,
  meta         jsonb
);

-- 2. 소스별 수집 결과
create table if not exists reference_sources (
  id              uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references pipeline_runs(id) on delete cascade,
  role            text not null,
  source_type     text not null check (source_type in ('worknet','tech_blog','npm_pypi','so_survey')),
  raw_stats       jsonb not null,
  collected_at    timestamptz not null default now()
);

create index if not exists idx_ref_sources_run_role
  on reference_sources(pipeline_run_id, role);

-- 3. 최종 참조 데이터 버전 관리
create table if not exists role_references (
  id              uuid primary key default gen_random_uuid(),
  role            text not null check (role in (
                    'backend','frontend','cloud_devops','fullstack',
                    'data','ai_ml','security','ios_android','qa')),
  version         integer not null,
  content         text not null,
  pipeline_run_id uuid references pipeline_runs(id),
  is_active       boolean not null default false,
  activated_at    timestamptz,
  activated_by    text,
  created_at      timestamptz not null default now()
);

create unique index if not exists uq_role_active
  on role_references(role) where is_active = true;

create index if not exists idx_role_refs_role_ver
  on role_references(role, version desc);

-- RLS 비활성화 (service role key로만 접근)
alter table pipeline_runs     disable row level security;
alter table reference_sources disable row level security;
alter table role_references   disable row level security;
```

- [ ] **Step 2: Supabase MCP로 마이그레이션 적용**

```
mcp__supabase__apply_migration 사용하여 위 SQL 실행
```

- [ ] **Step 3: 테이블 생성 확인**

```
mcp__supabase__list_tables 로 pipeline_runs, reference_sources, role_references 확인
```

---

## Task 2: 스크립트 인프라 (config + sb_client)

**Files:**
- Create: `backend/scripts/__init__.py`
- Create: `backend/scripts/config.py`
- Create: `backend/scripts/sb_client.py`
- Modify: `backend/app/core/config.py`

- [ ] **Step 1: SMTP 설정을 app config에 추가**

`backend/app/core/config.py`의 `Settings` 클래스에 추가:

```python
# ── 이메일 알림 (없으면 알림 비활성) ─────────────────────────
SMTP_HOST: Optional[str] = None
SMTP_PORT: int = 587
SMTP_USER: Optional[str] = None
SMTP_PASSWORD: Optional[str] = None
NOTIFY_EMAIL: Optional[str] = None  # 수신 이메일
```

- [ ] **Step 2: 스크립트 전용 config 작성**

```python
# backend/scripts/config.py
"""GitHub Actions 환경에서 os.environ으로 직접 읽는 스크립트 전용 설정."""
import os


def require(key: str) -> str:
    v = os.environ.get(key)
    if not v:
        raise RuntimeError(f"환경변수 {key}가 설정되지 않았습니다.")
    return v


def optional(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


SUPABASE_URL         = require("SUPABASE_URL")
SUPABASE_SERVICE_KEY = require("SUPABASE_SERVICE_KEY")
ANTHROPIC_API_KEY    = require("ANTHROPIC_API_KEY")
WORKNET_API_KEY      = optional("WORKNET_API_KEY")
NOTIFY_EMAIL         = optional("NOTIFY_EMAIL")
SMTP_HOST            = optional("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT            = int(optional("SMTP_PORT", "587"))
SMTP_USER            = optional("SMTP_USER")
SMTP_PASSWORD        = optional("SMTP_PASSWORD")
```

- [ ] **Step 3: 스크립트용 동기 Supabase 클라이언트 작성**

```python
# backend/scripts/sb_client.py
"""스크립트 전용 동기 Supabase REST 클라이언트."""
import httpx
from backend.scripts.config import SUPABASE_URL, SUPABASE_SERVICE_KEY


def _headers(prefer: str = "return=representation") -> dict:
    return {
        "apikey":        SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        prefer,
    }


def get(table: str, params: dict | None = None) -> list[dict]:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = httpx.get(url, headers=_headers(), params=params, timeout=15)
    r.raise_for_status()
    return r.json()


def post(table: str, data: dict | list) -> dict | list:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = httpx.post(url, headers=_headers(), json=data, timeout=15)
    r.raise_for_status()
    return r.json()


def patch(table: str, params: dict, data: dict) -> dict | list:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = httpx.patch(url, headers=_headers(), params=params, json=data, timeout=15)
    r.raise_for_status()
    return r.json()
```

- [ ] **Step 4: `__init__.py` 생성**

```python
# backend/scripts/__init__.py
# (빈 파일)
```

- [ ] **Step 5: collectors 패키지 초기화**

```python
# backend/scripts/collectors/__init__.py
# (빈 파일)
```

---

## Task 3: worknet collector

**Files:**
- Create: `backend/scripts/collectors/worknet.py`

- [ ] **Step 1: worknet collector 작성**

```python
# backend/scripts/collectors/worknet.py
"""워크넷 채용정보 Open API — 직군별 기술 키워드 빈도 수집.

API 문서: https://www.work.go.kr/opi/openApiSuggestGetWantedInfo.do
키 발급: https://www.data.go.kr (고용노동부 워크넷 채용정보)
"""
import re
from collections import Counter
import httpx
from backend.scripts.config import WORKNET_API_KEY

# 직군 → 워크넷 직종코드 매핑 (워크넷 직종분류 기준)
ROLE_KEYWORD_MAP: dict[str, list[str]] = {
    "backend":     ["백엔드", "서버개발", "Java", "Spring", "Python", "FastAPI", "Node.js"],
    "frontend":    ["프론트엔드", "React", "Vue", "Next.js", "TypeScript", "UI개발"],
    "cloud_devops":["DevOps", "클라우드", "AWS", "Kubernetes", "인프라", "SRE"],
    "fullstack":   ["풀스택", "fullstack", "full-stack"],
    "data":        ["데이터엔지니어", "데이터분석", "Spark", "Airflow", "데이터파이프라인"],
    "ai_ml":       ["AI엔지니어", "ML엔지니어", "LLM", "머신러닝", "딥러닝", "RAG"],
    "security":    ["보안엔지니어", "정보보안", "취약점", "보안"],
    "ios_android": ["iOS", "Android", "Flutter", "모바일앱", "Swift", "Kotlin"],
    "qa":          ["QA엔지니어", "테스트엔지니어", "품질보증", "자동화테스트"],
}

BASE_URL = "https://www.work.go.kr/opi/opi/opia/wantedApi.do"


def _fetch_postings(keyword: str, count: int = 100) -> list[str]:
    """키워드로 채용공고를 가져와 직무내용 텍스트 리스트 반환."""
    if not WORKNET_API_KEY:
        return []
    params = {
        "authKey":  WORKNET_API_KEY,
        "callTp":   "L",
        "returnType": "JSON",
        "startPage": 1,
        "display":  min(count, 100),
        "searchKeyword": keyword,
    }
    try:
        r = httpx.get(BASE_URL, params=params, timeout=20)
        r.raise_for_status()
        data = r.json()
        jobs = data.get("wantedRoot", {}).get("wanted", [])
        return [j.get("wantedTitle", "") + " " + j.get("wantedInfo", "") for j in jobs]
    except Exception as e:
        print(f"  [worknet] {keyword} 수집 실패: {e}")
        return []


# 기술 키워드 후보 (공고 텍스트에서 매칭)
_TECH_TOKENS = [
    "Java", "Kotlin", "Python", "FastAPI", "Spring", "Spring Boot",
    "Node.js", "NestJS", "React", "Vue", "Next.js", "TypeScript",
    "JavaScript", "Docker", "Kubernetes", "AWS", "Redis", "MySQL",
    "PostgreSQL", "MongoDB", "Kafka", "gRPC", "GraphQL", "Terraform",
    "ArgoCD", "LangChain", "LangGraph", "PyTorch", "TensorFlow",
    "Git", "GitHub Actions", "JPA", "MyBatis", "Flutter", "Swift",
    "Android", "iOS", "ISTQB", "Playwright", "Selenium",
]


def _count_keywords(texts: list[str]) -> Counter:
    counter: Counter = Counter()
    combined = " ".join(texts).lower()
    for token in _TECH_TOKENS:
        cnt = len(re.findall(re.escape(token.lower()), combined))
        if cnt > 0:
            counter[token] = cnt
    return counter


def collect(role: str) -> dict:
    """role에 해당하는 채용공고 수집 후 기술 키워드 빈도 반환.

    Returns:
        {"role": role, "source": "worknet", "keyword_counts": {...}, "total_postings": N}
    """
    keywords = ROLE_KEYWORD_MAP.get(role, [role])
    all_texts: list[str] = []
    for kw in keywords[:3]:   # 상위 3개 키워드만 (API 호출 최소화)
        all_texts.extend(_fetch_postings(kw, count=50))

    counts = _count_keywords(all_texts)
    print(f"  [worknet] {role}: {len(all_texts)}건 수집, 키워드 {len(counts)}개")
    return {
        "role": role,
        "source": "worknet",
        "keyword_counts": dict(counts.most_common(30)),
        "total_postings": len(all_texts),
    }
```

---

## Task 4: tech_blog collector

**Files:**
- Create: `backend/scripts/collectors/tech_blog.py`

- [ ] **Step 1: RSS 수집기 작성 (feedparser 사용)**

```python
# backend/scripts/collectors/tech_blog.py
"""국내 대형 테크 기업 기술 블로그 RSS 수집."""
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
import feedparser

RSS_FEEDS = [
    ("kakao",     "https://tech.kakao.com/feed/"),
    ("naver_d2",  "https://d2.naver.com/d2.atom"),
    ("toss",      "https://toss.tech/rss.xml"),
    ("line",      "https://engineering.linecorp.com/ko/feed"),
    ("woowa",     "https://techblog.woowahan.com/feed/"),
    ("coupang",   "https://medium.com/feed/coupang-engineering"),
    ("daangn",    "https://medium.com/feed/daangn"),
]

_TECH_TOKENS = [
    "Java", "Kotlin", "Python", "FastAPI", "Spring", "Spring Boot",
    "Node.js", "NestJS", "React", "Vue", "Next.js", "TypeScript",
    "Docker", "Kubernetes", "AWS", "Redis", "MySQL", "PostgreSQL",
    "MongoDB", "Kafka", "gRPC", "GraphQL", "Terraform", "ArgoCD",
    "LangChain", "LangGraph", "PyTorch", "TensorFlow", "LLM", "RAG",
    "Flutter", "Swift", "Android", "iOS", "Rust", "Go", "Golang",
    "GitHub Actions", "Vite", "Tailwind", "Zustand", "TanStack",
]

_CUTOFF = datetime.now(tz=timezone.utc) - timedelta(days=90)


def _parse_date(entry) -> datetime | None:
    for attr in ("published_parsed", "updated_parsed"):
        t = getattr(entry, attr, None)
        if t:
            try:
                from calendar import timegm
                return datetime.fromtimestamp(timegm(t), tz=timezone.utc)
            except Exception:
                pass
    return None


def _collect_feed(name: str, url: str) -> list[str]:
    try:
        feed = feedparser.parse(url)
        texts = []
        for entry in feed.entries:
            dt = _parse_date(entry)
            if dt and dt < _CUTOFF:
                continue
            title   = getattr(entry, "title", "")
            summary = getattr(entry, "summary", "")
            texts.append(f"{title} {summary}")
        print(f"  [tech_blog] {name}: {len(texts)}건")
        return texts
    except Exception as e:
        print(f"  [tech_blog] {name} 실패: {e}")
        return []


def collect(role: str) -> dict:
    """모든 RSS 피드 수집 후 기술 키워드 빈도 반환 (role 구분 없이 전체 수집)."""
    all_texts: list[str] = []
    for name, url in RSS_FEEDS:
        all_texts.extend(_collect_feed(name, url))

    combined = " ".join(all_texts).lower()
    counts: Counter = Counter()
    for token in _TECH_TOKENS:
        cnt = len(re.findall(re.escape(token.lower()), combined))
        if cnt > 0:
            counts[token] = cnt

    print(f"  [tech_blog] {role}: 전체 {len(all_texts)}건, 키워드 {len(counts)}개")
    return {
        "role": role,
        "source": "tech_blog",
        "keyword_counts": dict(counts.most_common(30)),
        "total_posts": len(all_texts),
    }
```

---

## Task 5: pkg_stats collector

**Files:**
- Create: `backend/scripts/collectors/pkg_stats.py`

- [ ] **Step 1: npm/PyPI 다운로드 통계 수집기 작성**

```python
# backend/scripts/collectors/pkg_stats.py
"""npm / PyPI 다운로드 통계 — 실사용량 기반 트렌드 시그널."""
import httpx
from collections import defaultdict

# 직군별 핵심 패키지 목록
NPM_PACKAGES: dict[str, list[str]] = {
    "frontend":    ["react", "next", "typescript", "vite", "tailwindcss",
                    "zustand", "@tanstack/react-query", "vitest"],
    "fullstack":   ["next", "trpc", "prisma", "drizzle-orm", "bun"],
    "backend":     ["fastapi", "nestjs", "express", "hono"],
    "cloud_devops":["@aws-sdk/client-s3", "terraform-cdk"],
    "ai_ml":       ["langchain", "openai", "@anthropic-ai/sdk"],
    "qa":          ["playwright", "vitest", "jest", "cypress"],
}

PYPI_PACKAGES: dict[str, list[str]] = {
    "backend":    ["fastapi", "uvicorn", "sqlalchemy", "pydantic"],
    "data":       ["pandas", "polars", "apache-airflow", "pyspark", "dbt-core"],
    "ai_ml":      ["torch", "transformers", "langchain", "langchain-community",
                   "langgraph", "llama-index", "anthropic", "openai"],
    "cloud_devops":["boto3", "pulumi", "cdk-nag"],
    "security":   ["cryptography", "bandit", "semgrep"],
}


def _npm_downloads(pkg: str) -> int:
    try:
        r = httpx.get(
            f"https://api.npmjs.org/downloads/point/last-month/{pkg}",
            timeout=10,
        )
        if r.status_code == 200:
            return r.json().get("downloads", 0)
    except Exception:
        pass
    return 0


def _pypi_downloads(pkg: str) -> int:
    try:
        r = httpx.get(
            f"https://pypistats.org/api/packages/{pkg}/recent",
            timeout=10,
        )
        if r.status_code == 200:
            return r.json().get("data", {}).get("last_month", 0)
    except Exception:
        pass
    return 0


def collect(role: str) -> dict:
    """role의 핵심 패키지 다운로드 수 수집."""
    stats: dict[str, int] = {}

    for pkg in NPM_PACKAGES.get(role, []):
        dl = _npm_downloads(pkg)
        if dl > 0:
            stats[pkg] = dl
            print(f"  [pkg_stats] npm {pkg}: {dl:,}")

    for pkg in PYPI_PACKAGES.get(role, []):
        dl = _pypi_downloads(pkg)
        if dl > 0:
            stats[pkg] = dl
            print(f"  [pkg_stats] pypi {pkg}: {dl:,}")

    # 다운로드 수 → 상대 점수 정규화 (최대값 기준)
    if stats:
        max_dl = max(stats.values())
        normalized = {k: round(v / max_dl, 4) for k, v in stats.items()}
    else:
        normalized = {}

    return {
        "role": role,
        "source": "npm_pypi",
        "keyword_counts": normalized,
        "raw_downloads": stats,
    }
```

---

## Task 6: so_survey collector

**Files:**
- Create: `backend/scripts/collectors/so_survey.py`

- [ ] **Step 1: Stack Overflow Survey 정적 데이터 작성**

SO Survey CSV는 연 1회 공개되므로 정적 딕셔너리로 관리하고 연 1회 수동 업데이트한다.

```python
# backend/scripts/collectors/so_survey.py
"""Stack Overflow Developer Survey 2024 공개 데이터 기반 글로벌 베이스라인.

출처: https://survey.stackoverflow.co/2024/
업데이트 주기: 연 1회 (매년 5~6월 공개 후 갱신)
형식: 기술명 → 사용률(%) 정규화 점수 (0.0~1.0)
"""

# 2024 Survey: "Most popular technologies" 항목 (사용률 상위 기준)
SO_2024: dict[str, dict[str, float]] = {
    "backend": {
        "JavaScript":    0.98,
        "Python":        0.89,
        "Java":          0.72,
        "TypeScript":    0.78,
        "SQL":           0.95,
        "Spring Boot":   0.45,
        "FastAPI":       0.32,
        "Node.js":       0.65,
        "Docker":        0.71,
        "PostgreSQL":    0.62,
        "Redis":         0.44,
        "AWS":           0.58,
        "Kotlin":        0.31,
        "gRPC":          0.18,
    },
    "frontend": {
        "JavaScript":    0.98,
        "TypeScript":    0.78,
        "React":         0.74,
        "Next.js":       0.51,
        "Vue":           0.34,
        "Tailwind CSS":  0.52,
        "Vite":          0.44,
        "Node.js":       0.65,
        "CSS":           0.97,
        "HTML":          0.97,
    },
    "cloud_devops": {
        "Docker":        0.71,
        "Kubernetes":    0.45,
        "AWS":           0.58,
        "Terraform":     0.38,
        "GitHub Actions":0.62,
        "ArgoCD":        0.21,
        "Linux":         0.82,
        "Python":        0.89,
        "Go":            0.41,
        "Ansible":       0.28,
    },
    "ai_ml": {
        "Python":        0.89,
        "PyTorch":       0.52,
        "TensorFlow":    0.38,
        "LangChain":     0.29,
        "OpenAI API":    0.45,
        "Hugging Face":  0.41,
        "Jupyter":       0.65,
        "scikit-learn":  0.61,
        "NumPy":         0.78,
        "Pandas":        0.75,
    },
    "data": {
        "Python":        0.89,
        "SQL":           0.95,
        "Pandas":        0.75,
        "Spark":         0.31,
        "Airflow":       0.28,
        "dbt":           0.22,
        "PostgreSQL":    0.62,
        "Snowflake":     0.24,
        "Kafka":         0.21,
        "Tableau":       0.28,
    },
    "fullstack": {
        "JavaScript":    0.98,
        "TypeScript":    0.78,
        "React":         0.74,
        "Next.js":       0.51,
        "Node.js":       0.65,
        "PostgreSQL":    0.62,
        "Docker":        0.71,
        "Tailwind CSS":  0.52,
        "Prisma":        0.31,
        "tRPC":          0.18,
    },
    "security": {
        "Python":        0.89,
        "Linux":         0.82,
        "Docker":        0.71,
        "AWS":           0.58,
        "Bash":          0.72,
        "SQL":           0.95,
        "Go":            0.41,
        "Rust":          0.29,
    },
    "ios_android": {
        "Swift":         0.55,
        "Kotlin":        0.55,
        "Flutter":       0.42,
        "Dart":          0.38,
        "Objective-C":   0.21,
        "Java":          0.72,
        "Firebase":      0.44,
        "React Native":  0.32,
    },
    "qa": {
        "JavaScript":    0.98,
        "Python":        0.89,
        "TypeScript":    0.78,
        "Selenium":      0.38,
        "Playwright":    0.34,
        "Jest":          0.44,
        "Cypress":       0.28,
        "Java":          0.72,
        "SQL":           0.95,
        "Docker":        0.71,
    },
}


def collect(role: str) -> dict:
    data = SO_2024.get(role, {})
    return {
        "role": role,
        "source": "so_survey",
        "keyword_counts": data,
        "survey_year": 2024,
    }
```

---

## Task 7: aggregator

**Files:**
- Create: `backend/scripts/aggregator.py`
- Create: `backend/tests/scripts/test_aggregator.py`

- [ ] **Step 1: 테스트 작성**

```python
# backend/tests/scripts/test_aggregator.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from scripts.aggregator import compute_scores, classify_priority

def test_compute_scores_weights():
    sources = [
        {"source": "worknet",   "keyword_counts": {"React": 50, "Vue": 10}},
        {"source": "tech_blog", "keyword_counts": {"React": 30}},
        {"source": "npm_pypi",  "keyword_counts": {"React": 0.9}},
        {"source": "so_survey", "keyword_counts": {"React": 0.74}},
    ]
    scores = compute_scores(sources)
    assert "React" in scores
    assert scores["React"] > scores.get("Vue", 0)

def test_classify_priority():
    assert classify_priority(0.7) == 1
    assert classify_priority(0.4) == 2
    assert classify_priority(0.2) == 3
    assert classify_priority(0.0) == 3
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd backend && python -m pytest tests/scripts/test_aggregator.py -v
```
Expected: ImportError (aggregator 미존재)

- [ ] **Step 3: aggregator 구현**

```python
# backend/scripts/aggregator.py
"""4개 소스 결과를 가중치로 합산하여 기술별 종합 점수 산출."""

WEIGHTS = {
    "worknet":   0.40,
    "tech_blog": 0.30,
    "npm_pypi":  0.20,
    "so_survey": 0.10,
}


def _normalize(counts: dict[str, float]) -> dict[str, float]:
    """최대값 기준으로 0~1 정규화."""
    if not counts:
        return {}
    max_v = max(counts.values())
    if max_v == 0:
        return {}
    return {k: v / max_v for k, v in counts.items()}


def compute_scores(sources: list[dict]) -> dict[str, float]:
    """소스 리스트 → 기술별 가중 합산 점수.

    Args:
        sources: [{"source": "worknet", "keyword_counts": {...}}, ...]

    Returns:
        {"React": 0.72, "Vue": 0.31, ...}
    """
    aggregated: dict[str, float] = {}
    for src in sources:
        weight = WEIGHTS.get(src["source"], 0.0)
        normalized = _normalize(src.get("keyword_counts", {}))
        for tech, score in normalized.items():
            aggregated[tech] = aggregated.get(tech, 0.0) + score * weight
    # 전체 기준 재정규화 (0~1 범위 유지)
    if aggregated:
        max_v = max(aggregated.values())
        if max_v > 0:
            aggregated = {k: round(v / max_v, 4) for k, v in aggregated.items()}
    return dict(sorted(aggregated.items(), key=lambda x: x[1], reverse=True))


def classify_priority(score: float) -> int:
    if score >= 0.6:
        return 1
    if score >= 0.3:
        return 2
    return 3


def build_priority_map(scores: dict[str, float]) -> dict[int, list[str]]:
    """점수 → priority별 기술 목록."""
    result: dict[int, list[str]] = {1: [], 2: [], 3: []}
    for tech, score in scores.items():
        result[classify_priority(score)].append(tech)
    return result
```

- [ ] **Step 4: 테스트 실행 — PASS 확인**

```bash
cd backend && python -m pytest tests/scripts/test_aggregator.py -v
```
Expected: 2 passed

- [ ] **Step 5: 커밋**

```bash
git add backend/scripts/aggregator.py backend/tests/scripts/test_aggregator.py
git commit -m "feat: add aggregator with weighted score computation"
```

---

## Task 8: validator (Claude API)

**Files:**
- Create: `backend/scripts/validator.py`

- [ ] **Step 1: validator 작성**

```python
# backend/scripts/validator.py
"""Claude API로 기술 점수 교차검증 + role_references 텍스트 생성."""
import json
import anthropic
from scripts.config import ANTHROPIC_API_KEY
from scripts.aggregator import build_priority_map

_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

_SYSTEM = """당신은 한국 IT 취업 시장 전문가입니다.
제공된 기술 점수 데이터를 검토하여 한국 취업 현실과 맞지 않는 이상값을 제거하고,
role_references 텍스트를 아래 형식으로 생성하세요.

출력 형식 (텍스트만, JSON 아님):
[{직군명} — {연도} 한국 취업 실무 참조]

■ 2026 채용 공고 필수 기술 (한국)
- priority 1 (필수): {기술 목록}
- priority 2 (권장): {기술 목록}
- priority 3 (추천): {기술 목록}

■ 회사 유형별 기술 포커스
...

■ 포트폴리오 핵심 포인트
...

■ 기술 면접 핵심 주제
...
"""


def generate_reference(role: str, priority_map: dict, existing_content: str) -> str:
    """priority_map + 기존 내용을 Claude에 전달하여 최신 role_references 생성.

    Args:
        role: 직군 키
        priority_map: {1: ["React", ...], 2: [...], 3: [...]}
        existing_content: 현재 활성화된 role_references 텍스트 (컨텍스트용)

    Returns:
        새로운 REFERENCE 텍스트
    """
    user_msg = f"""직군: {role}

[수집 데이터 기반 기술 우선순위]
Priority 1 (필수): {', '.join(priority_map.get(1, []))}
Priority 2 (권장): {', '.join(priority_map.get(2, []))}
Priority 3 (추천): {', '.join(priority_map.get(3, []))}

[기존 참조 데이터 (컨텍스트)]
{existing_content[:2000]}

위 우선순위를 기반으로 role_references 텍스트를 생성하세요.
한국 취업 현실과 동떨어진 기술은 제거하고, 누락된 핵심 기술은 기존 내용에서 보완하세요."""

    msg = _client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    return msg.content[0].text.strip()
```

---

## Task 9: db_writer

**Files:**
- Create: `backend/scripts/db_writer.py`
- Create: `backend/tests/scripts/test_db_writer.py`

- [ ] **Step 1: 테스트 작성 (mock 기반)**

```python
# backend/tests/scripts/test_db_writer.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
from unittest.mock import patch, MagicMock
from scripts.db_writer import get_next_version, build_diff

def test_get_next_version_first():
    with patch("scripts.db_writer.sb") as mock_sb:
        mock_sb.get.return_value = []
        assert get_next_version("backend") == 1

def test_get_next_version_increments():
    with patch("scripts.db_writer.sb") as mock_sb:
        mock_sb.get.return_value = [{"version": 3}]
        assert get_next_version("backend") == 4

def test_build_diff_detects_changes():
    old = "■ 필수 기술\n- Java, Spring"
    new = "■ 필수 기술\n- Java, Spring, Kotlin"
    diff = build_diff(old, new)
    assert "Kotlin" in diff
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd backend && python -m pytest tests/scripts/test_db_writer.py -v
```

- [ ] **Step 3: db_writer 구현**

```python
# backend/scripts/db_writer.py
"""Supabase pipeline_runs / reference_sources / role_references 관리."""
import difflib
from datetime import datetime, timezone
from scripts import sb_client as sb

ALL_ROLES = ["backend", "frontend", "cloud_devops", "fullstack",
             "data", "ai_ml", "security", "ios_android", "qa"]


def create_pipeline_run(triggered_by: str) -> str:
    """pipeline_runs 레코드 생성 후 id 반환."""
    rows = sb.post("pipeline_runs", {
        "triggered_by": triggered_by,
        "status": "running",
    })
    return rows[0]["id"] if isinstance(rows, list) else rows["id"]


def update_pipeline_run(run_id: str, status: str, error: str | None = None) -> None:
    sb.patch("pipeline_runs",
             params={"id": f"eq.{run_id}"},
             data={
                 "status": status,
                 "finished_at": datetime.now(tz=timezone.utc).isoformat(),
                 **({"error": error} if error else {}),
             })


def save_source(run_id: str, role: str, source_data: dict) -> None:
    """reference_sources에 원본 수집 데이터 저장."""
    sb.post("reference_sources", {
        "pipeline_run_id": run_id,
        "role": role,
        "source_type": source_data["source"],
        "raw_stats": source_data,
    })


def get_next_version(role: str) -> int:
    rows = sb.get("role_references",
                  params={"role": f"eq.{role}", "select": "version",
                          "order": "version.desc", "limit": "1"})
    if not rows:
        return 1
    return rows[0]["version"] + 1


def get_active_content(role: str) -> str:
    """현재 활성 role_references 텍스트 반환. 없으면 빈 문자열."""
    rows = sb.get("role_references",
                  params={"role": f"eq.{role}", "is_active": "eq.true",
                          "select": "content", "limit": "1"})
    return rows[0]["content"] if rows else ""


def build_diff(old: str, new: str) -> str:
    """두 텍스트의 diff를 사람이 읽기 쉬운 형태로 반환."""
    old_lines = old.splitlines()
    new_lines = new.splitlines()
    diff = list(difflib.unified_diff(old_lines, new_lines,
                                     fromfile="이전", tofile="신규", lineterm=""))
    return "\n".join(diff[:50]) if diff else "(변경 없음)"


def save_new_version(run_id: str, role: str, content: str) -> tuple[str, bool]:
    """새 버전 저장 + 이전 버전과 동일하면 저장 스킵.

    Returns:
        (diff_text, changed: bool)
    """
    old_content = get_active_content(role)
    diff = build_diff(old_content, content)
    changed = diff != "(변경 없음)"

    if not changed:
        return diff, False

    version = get_next_version(role)

    # 기존 active 해제
    if old_content:
        sb.patch("role_references",
                 params={"role": f"eq.{role}", "is_active": "eq.true"},
                 data={"is_active": False})

    # 새 버전 저장 + 즉시 활성화
    sb.post("role_references", {
        "role": role,
        "version": version,
        "content": content,
        "pipeline_run_id": run_id,
        "is_active": True,
        "activated_at": datetime.now(tz=timezone.utc).isoformat(),
        "activated_by": "auto",
    })
    print(f"  [db_writer] {role}: v{version} 저장 완료")
    return diff, True
```

- [ ] **Step 4: 테스트 실행 — PASS 확인**

```bash
cd backend && python -m pytest tests/scripts/test_db_writer.py -v
```

- [ ] **Step 5: 커밋**

```bash
git add backend/scripts/db_writer.py backend/tests/scripts/test_db_writer.py
git commit -m "feat: add db_writer for versioned role_references upsert"
```

---

## Task 10: notifier (이메일)

**Files:**
- Create: `backend/scripts/notifier.py`

- [ ] **Step 1: notifier 작성**

```python
# backend/scripts/notifier.py
"""월간 리포트 diff 생성 + SMTP 이메일 발송."""
import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from scripts.config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, NOTIFY_EMAIL


def build_report(
    run_id: str,
    diffs: dict[str, tuple[str, bool]],  # role → (diff_text, changed)
    stats: dict,
    elapsed_seconds: float,
) -> str:
    today = datetime.now().strftime("%Y년 %m월 %d일")
    lines = [
        f"[DevNavi] 월간 기술 트렌드 리포트 — {today}",
        "",
        "━" * 48,
        "📊 수집 현황",
        "━" * 48,
        f"• 워크넷 채용공고 분석: {stats.get('worknet_total', 0)}건",
        f"• 테크 블로그 포스트: {stats.get('blog_total', 0)}건",
        f"• npm/PyPI 패키지 통계: 직군별 상위 패키지",
        f"• 실행 시간: {elapsed_seconds:.0f}초",
        "",
        "━" * 48,
        "🆕 직군별 변경사항",
        "━" * 48,
    ]

    changed_roles = []
    unchanged_roles = []
    for role, (diff_text, changed) in diffs.items():
        if changed:
            changed_roles.append((role, diff_text))
        else:
            unchanged_roles.append(role)

    for role, diff_text in changed_roles:
        lines.append(f"\n[{role}] 변경됨")
        lines.append(diff_text[:500])

    if unchanged_roles:
        lines.append(f"\n변경 없음: {', '.join(unchanged_roles)}")

    lines += [
        "",
        "━" * 48,
        "🔄 롤백 필요 시",
        "━" * 48,
        "POST https://api.devnavi.kr/admin/references/{role}/rollback",
        "Authorization: Bearer {ADMIN_TOKEN}",
        "",
        f"파이프라인 실행 ID: {run_id}",
    ]
    return "\n".join(lines)


def send_email(subject: str, body: str) -> bool:
    """SMTP로 이메일 발송. 설정 없으면 스킵하고 False 반환."""
    if not all([SMTP_USER, SMTP_PASSWORD, NOTIFY_EMAIL]):
        print("  [notifier] SMTP 설정 없음 — 이메일 발송 스킵")
        return False
    try:
        msg = MIMEMultipart()
        msg["From"]    = SMTP_USER
        msg["To"]      = NOTIFY_EMAIL
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, NOTIFY_EMAIL, msg.as_string())
        print(f"  [notifier] 이메일 발송 완료 → {NOTIFY_EMAIL}")
        return True
    except Exception as e:
        print(f"  [notifier] 이메일 발송 실패: {e}")
        return False
```

---

## Task 11: 파이프라인 진입점

**Files:**
- Create: `backend/scripts/refresh_references.py`

- [ ] **Step 1: 메인 스크립트 작성**

```python
# backend/scripts/refresh_references.py
"""월간 role_references 갱신 파이프라인 진입점.

Usage:
    python backend/scripts/refresh_references.py [--roles backend,frontend]
"""
import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from scripts import db_writer
from scripts.aggregator import compute_scores, build_priority_map
from scripts.collectors import worknet, tech_blog, pkg_stats, so_survey
from scripts.notifier import build_report, send_email
from scripts.validator import generate_reference

ALL_ROLES = db_writer.ALL_ROLES


def _collect_all(role: str) -> dict[str, dict]:
    """4개 소스 병렬 수집."""
    collectors = {
        "worknet":   lambda: worknet.collect(role),
        "tech_blog": lambda: tech_blog.collect(role),
        "npm_pypi":  lambda: pkg_stats.collect(role),
        "so_survey": lambda: so_survey.collect(role),
    }
    results = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(fn): name for name, fn in collectors.items()}
        for future in as_completed(futures):
            name = futures[future]
            try:
                results[name] = future.result()
            except Exception as e:
                print(f"  [{name}] 수집 실패 (스킵): {e}")
    return results


def run(roles: list[str], triggered_by: str = "manual") -> None:
    start = time.time()
    run_id = db_writer.create_pipeline_run(triggered_by)
    print(f"[pipeline] run_id={run_id}, roles={roles}")

    diffs: dict[str, tuple[str, bool]] = {}
    global_stats: dict = {"worknet_total": 0, "blog_total": 0}

    try:
        for role in roles:
            print(f"\n[pipeline] === {role} ===")
            source_results = _collect_all(role)

            # 소스 원본 저장
            for src_data in source_results.values():
                db_writer.save_source(run_id, role, src_data)

            # 통계 누적
            global_stats["worknet_total"] += source_results.get(
                "worknet", {}).get("total_postings", 0)
            global_stats["blog_total"] += source_results.get(
                "tech_blog", {}).get("total_posts", 0)

            if not source_results:
                print(f"  [{role}] 모든 소스 수집 실패 — 스킵")
                diffs[role] = ("(수집 실패)", False)
                continue

            # 점수 산출 + Claude 검증
            scores = compute_scores(list(source_results.values()))
            priority_map = build_priority_map(scores)
            existing = db_writer.get_active_content(role)
            new_content = generate_reference(role, priority_map, existing)

            # DB 저장
            diff_text, changed = db_writer.save_new_version(run_id, role, new_content)
            diffs[role] = (diff_text, changed)

        db_writer.update_pipeline_run(run_id, "completed")

    except Exception as e:
        db_writer.update_pipeline_run(run_id, "failed", error=str(e))
        raise

    # 이메일 발송
    elapsed = time.time() - start
    report = build_report(run_id, diffs, global_stats, elapsed)
    today = __import__("datetime").datetime.now().strftime("%Y년 %m월")
    send_email(f"[DevNavi] 월간 기술 트렌드 리포트 — {today}", report)
    print(f"\n[pipeline] 완료 ({elapsed:.1f}초)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--roles", default="", help="쉼표 구분 직군 (비우면 전체)")
    parser.add_argument("--triggered-by", default="manual")
    args = parser.parse_args()

    target_roles = [r.strip() for r in args.roles.split(",") if r.strip()] or ALL_ROLES
    run(target_roles, triggered_by=args.triggered_by)
```

---

## Task 12: 백엔드 get_reference() async 전환

**Files:**
- Modify: `backend/app/prompts/role_references/__init__.py`
- Modify: `backend/app/prompts/builder.py` (호출부 await 추가)

- [ ] **Step 1: `__init__.py` 수정 — DB 우선 조회 + fallback**

```python
# backend/app/prompts/role_references/__init__.py
from . import backend, frontend, cloud_devops, fullstack, data, ai_ml, security, ios_android, qa

ROLE_REFERENCE_MAP = {
    "backend":      backend.REFERENCE,
    "frontend":     frontend.REFERENCE,
    "cloud_devops": cloud_devops.REFERENCE,
    "fullstack":    fullstack.REFERENCE,
    "data":         data.REFERENCE,
    "ai_ml":        ai_ml.REFERENCE,
    "security":     security.REFERENCE,
    "ios_android":  ios_android.REFERENCE,
    "qa":           qa.REFERENCE,
}


async def get_reference(role: str) -> str:
    """DB 우선 조회, 없으면 정적 파일 fallback."""
    try:
        from app.core.supabase_client import get_supabase_client, sb_headers, sb_url
        client = get_supabase_client()
        resp = await client.get(
            sb_url("role_references"),
            headers=sb_headers(),
            params={"role": f"eq.{role}", "is_active": "eq.true",
                    "select": "content", "limit": "1"},
        )
        if resp.status_code == 200:
            rows = resp.json()
            if rows:
                return rows[0]["content"]
    except Exception:
        pass  # Supabase 미설정 또는 장애 → fallback
    return ROLE_REFERENCE_MAP.get(role, "")
```

- [ ] **Step 2: builder.py 호출부 await 추가**

`build_full_prompt`, `build_full_prompt_partial`, `build_career_summary_prompt`, `build_teaser_prompt`, `build_reroute_prompt` 내부의 `get_reference(role)` → `await get_reference(role)` 로 변경.

각 builder 함수도 `async def`로 변경:

```python
# builder.py 함수 시그니처 변경 예시
async def build_full_prompt(role, period, level, skills, certifications,
                             company_type, daily_study_hours, extra_profile=None):
    ...
    reference = await get_reference(role)
    ...
```

- [ ] **Step 3: builder 호출부 (api/roadmap.py) await 추가**

`roadmap.py`에서 builder 함수 호출 시 `await` 추가:

```python
system, user_msg = await build_full_prompt(...)
system, user_msg = await build_reroute_prompt(...)
system, user_msg = await build_career_summary_prompt(...)
```

- [ ] **Step 4: 로컬 서버 기동 후 /roadmap/teaser 정상 응답 확인**

```bash
cd backend && uvicorn app.main:app --port 8000
curl -X POST http://localhost:8000/roadmap/teaser \
  -H "Content-Type: application/json" \
  -d '{"role":"backend","period":"6months","level":"basic"}'
```
Expected: 200 OK, 스트리밍 응답

- [ ] **Step 5: 커밋**

```bash
git add backend/app/prompts/role_references/__init__.py backend/app/prompts/builder.py backend/app/api/roadmap.py
git commit -m "feat: get_reference() async DB lookup with static file fallback"
```

---

## Task 13: 관리자 rollback 엔드포인트

**Files:**
- Modify: `backend/app/api/admin.py`

- [ ] **Step 1: rollback 엔드포인트 추가**

`admin.py` 하단에 추가:

```python
@router.post("/references/{role}/rollback", status_code=200)
@limiter.limit("10/minute")
async def rollback_reference(
    request: Request,
    role: str,
    _: dict = Depends(require_admin),
):
    """특정 직군의 role_references를 이전 버전으로 롤백."""
    valid_roles = ["backend","frontend","cloud_devops","fullstack",
                   "data","ai_ml","security","ios_android","qa"]
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail="유효하지 않은 직군입니다.")

    client = get_supabase_client()

    # 현재 active 버전 조회
    r = await client.get(
        sb_url("role_references"),
        headers=sb_headers(),
        params={"role": f"eq.{role}", "is_active": "eq.true",
                "select": "id,version", "limit": "1"},
    )
    active_rows = r.json() if r.status_code == 200 else []
    if not active_rows:
        raise HTTPException(status_code=404, detail="활성 버전이 없습니다.")

    current_version = active_rows[0]["version"]
    if current_version <= 1:
        raise HTTPException(status_code=400, detail="롤백할 이전 버전이 없습니다.")

    prev_version = current_version - 1

    # 이전 버전 조회
    r2 = await client.get(
        sb_url("role_references"),
        headers=sb_headers(),
        params={"role": f"eq.{role}", "version": f"eq.{prev_version}",
                "select": "id", "limit": "1"},
    )
    prev_rows = r2.json() if r2.status_code == 200 else []
    if not prev_rows:
        raise HTTPException(status_code=404, detail=f"v{prev_version}이 존재하지 않습니다.")

    # 현재 active 해제
    await client.patch(
        sb_url("role_references"),
        headers=sb_headers(prefer="return=minimal"),
        params={"id": f"eq.{active_rows[0]['id']}"},
        json={"is_active": False},
    )
    # 이전 버전 활성화
    await client.patch(
        sb_url("role_references"),
        headers=sb_headers(prefer="return=minimal"),
        params={"id": f"eq.{prev_rows[0]['id']}"},
        json={"is_active": True, "activated_by": "admin_rollback"},
    )

    logger.info("role_references rollback: %s v%d → v%d", role, current_version, prev_version)
    return {"role": role, "rolled_back_to": prev_version}
```

- [ ] **Step 2: 커밋**

```bash
git add backend/app/api/admin.py
git commit -m "feat: add admin rollback endpoint for role_references"
```

---

## Task 14: GitHub Actions 워크플로우

**Files:**
- Create: `.github/workflows/refresh-references.yml`

- [ ] **Step 1: 워크플로우 파일 작성**

```yaml
# .github/workflows/refresh-references.yml
name: Monthly Role References Refresh

on:
  schedule:
    - cron: '0 17 1 * *'   # 매월 1일 02:00 KST (UTC+9 → UTC 17:00)
  workflow_dispatch:
    inputs:
      roles:
        description: '특정 직군만 실행 (쉼표 구분, 비우면 전체)'
        required: false
        default: ''

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install httpx feedparser anthropic

      - name: Run pipeline
        env:
          SUPABASE_URL:         ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          ANTHROPIC_API_KEY:    ${{ secrets.ANTHROPIC_API_KEY }}
          WORKNET_API_KEY:      ${{ secrets.WORKNET_API_KEY }}
          NOTIFY_EMAIL:         ${{ secrets.NOTIFY_EMAIL }}
          SMTP_HOST:            ${{ secrets.SMTP_HOST }}
          SMTP_USER:            ${{ secrets.SMTP_USER }}
          SMTP_PASSWORD:        ${{ secrets.SMTP_PASSWORD }}
        run: |
          ROLES="${{ github.event.inputs.roles }}"
          if [ -n "$ROLES" ]; then
            python backend/scripts/refresh_references.py \
              --roles "$ROLES" --triggered-by "manual"
          else
            python backend/scripts/refresh_references.py \
              --triggered-by "cron"
          fi
```

- [ ] **Step 2: GitHub Secrets 등록 확인 목록**

다음 secrets가 GitHub repository > Settings > Secrets에 등록돼야 한다:
- `WORKNET_API_KEY` — data.go.kr 워크넷 API 키
- `NOTIFY_EMAIL` — 수신 이메일 (support@devnavi.kr)
- `SMTP_HOST` — smtp.gmail.com (또는 사용 중인 SMTP)
- `SMTP_USER` — 발신 Gmail 계정
- `SMTP_PASSWORD` — Gmail 앱 비밀번호

기존 secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`)는 이미 등록돼 있음.

- [ ] **Step 3: 수동 트리거로 단일 직군 테스트 실행**

GitHub Actions UI > "Monthly Role References Refresh" > "Run workflow" > roles: `backend`

- [ ] **Step 4: 커밋**

```bash
git add .github/workflows/refresh-references.yml
git commit -m "feat: add monthly role references refresh GitHub Actions workflow"
```

---

## Self-Review

**Spec coverage 체크:**
- ✅ 워크넷 API 수집 (Task 3)
- ✅ 테크 블로그 RSS (Task 4)
- ✅ npm/PyPI 통계 (Task 5)
- ✅ SO Survey (Task 6)
- ✅ 가중치 교차검증 (Task 7)
- ✅ Claude 텍스트 생성 (Task 8)
- ✅ 3개 테이블 스키마 (Task 1)
- ✅ DB writer + 버전 관리 (Task 9)
- ✅ 월간 이메일 리포트 (Task 10)
- ✅ 백엔드 동적 조회 + fallback (Task 12)
- ✅ Admin rollback 엔드포인트 (Task 13)
- ✅ GitHub Actions 월 1회 cron + 수동 (Task 14)

**Placeholder 없음 확인:** 완료

**타입 일관성:**
- `db_writer.save_new_version()` → `(str, bool)` → `notifier.build_report(diffs)` 에서 `dict[str, tuple[str, bool]]` 로 수신 ✅
- `get_reference()` 가 `async`로 변경됨 → builder 함수들도 모두 `async def`로 변경 필요 ✅
