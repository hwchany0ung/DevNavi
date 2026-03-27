# DevNavi

> **AI가 설계하는 나만의 IT 커리어 로드맵**
> Personalized AI-powered career roadmap generator for IT professionals

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Claude](https://img.shields.io/badge/Powered_by-Claude_Sonnet-blueviolet)](https://anthropic.com)

**[devnavi.kr](https://devnavi.kr)** 에서 바로 사용해보세요

---

## 프로젝트 소개

DevNavi는 **Claude AI**를 활용하여 IT 직군 취업·이직을 준비하는 개발자에게 개인화된 학습 로드맵을 실시간으로 생성해주는 웹 서비스입니다.

목표 직군, 준비 기간, 현재 실력, 보유 스킬을 입력하면 AI가 **월별·주별 구체적인 학습 계획**을 즉시 스트리밍으로 제공합니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **AI 로드맵 생성** | Claude Sonnet으로 월별·주별 세분화된 학습 계획 실시간 스트리밍 |
| **페르소나 카드** | 입력 정보 기반 AI 커리어 페르소나 자동 생성 |
| **GPS 재탐색** | 진행률을 반영해 남은 기간 로드맵을 자동 재조정 |
| **커리어 분석** | 보완할 스킬·취득 자격증·어필 포인트 분석 |
| **잔디 캘린더** | 365일 학습 활동 시각화 (GitHub 스타일) |
| **태스크 체크** | 주차별 태스크 완료 토글 및 진행률 추적 |
| **PDF 내보내기** | 로드맵 전체를 PDF로 다운로드 |
| **다크모드** | 시스템 테마 연동 및 수동 전환 |

### 지원 직군 (9종)
`Backend` `Frontend` `Cloud/DevOps` `Fullstack` `Data` `AI/ML` `Security` `iOS/Android` `QA`

---

## 기술 스택

### Frontend
- **React 18** + **Vite** — SPA 빌드
- **React Router 6** — 클라이언트 라우팅
- **Tailwind CSS** — 유틸리티 퍼스트 스타일링
- **Supabase JS** — 인증 및 실시간 세션 관리
- **@react-pdf/renderer** — 클라이언트 사이드 PDF 생성
- **SSE (Server-Sent Events)** — 실시간 스트리밍 UI

### Backend
- **FastAPI** (Python 3.12) — REST API + SSE 스트리밍
- **Anthropic SDK** — Claude Haiku / Sonnet 호출
- **Mangum** — Lambda ASGI 어댑터
- **PyJWT + JWKS** — Supabase JWT 검증 (ES256/HS256)
- **slowapi** — 엔드포인트별 Rate Limiting
- **httpx** — 비동기 Supabase REST 클라이언트

### Database & Auth
- **Supabase (PostgreSQL)** — DB + Auth + RLS 정책
- **Row Level Security** — 테이블별 사용자 격리

### Infrastructure (AWS)
- **Lambda** — 서버리스 FastAPI 실행 (512MB, Python 3.12)
- **CloudFront** — 글로벌 CDN + 보안 헤더 + Origin 시크릿 검증
- **S3** — React 정적 빌드 호스팅
- **SSM Parameter Store** — 시크릿 관리
- **ACM + Route53** — HTTPS 인증서 및 DNS
- **Terraform** — 인프라 IaC 관리

---

## 시스템 아키텍처

```
사용자 브라우저
      │
      ▼
┌─────────────────────────────────────┐
│         CloudFront (CDN)            │
│  - React SPA 캐싱/서빙              │
│  - API 프록시 (/roadmap/*)          │
│  - 보안 헤더 정책                   │
│  - X-CF-Secret 헤더 주입            │
└────────────┬──────────────┬─────────┘
             │              │
             ▼              ▼
      ┌──────────┐   ┌────────────┐
      │  S3      │   │  Lambda    │
      │ (React)  │   │ (FastAPI)  │
      └──────────┘   │            │
                     │ ┌────────┐ │
                     │ │Claude  │ │
                     │ │Sonnet  │ │
                     │ └────────┘ │
                     │ ┌────────┐ │
                     │ │Supabase│ │
                     │ │  DB    │ │
                     │ └────────┘ │
                     └────────────┘
```

---

## API 엔드포인트

| 엔드포인트 | 메서드 | 인증 | 설명 |
|------------|--------|------|------|
| `/health` | GET | No | 헬스체크 |
| `/roadmap/teaser` | POST | No | 미리보기 로드맵 스트리밍 (Claude Haiku) |
| `/roadmap/full` | POST | Yes | 전체 로드맵 스트리밍 (Claude Sonnet) |
| `/roadmap/career-summary` | POST | Yes | 커리어 분석 JSON |
| `/roadmap/persist` | POST | Yes | 스트리밍 완료 후 DB 저장 |
| `/roadmap/reroute` | POST | Yes | GPS 재탐색 스트리밍 |
| `/roadmap/my` | GET | Yes | 내 최신 로드맵 ID 조회 |
| `/roadmap/activity/me` | GET | Yes | 365일 활동 데이터 (잔디) |
| `/roadmap/{id}` | GET | Yes | 로드맵 상세 조회 (본인 소유) |
| `/roadmap/{id}/completions` | POST/GET | Yes | 태스크 완료 토글/조회 |

---

## 로컬 개발 환경 설정

### 사전 요구사항
- Node.js 20+
- Python 3.12+
- Supabase 계정 (무료 플랜 가능)
- Anthropic API 키

### 1. 저장소 클론

```bash
git clone https://github.com/hwchany0ung/DevNavi.git
cd DevNavi
```

### 2. 백엔드 설정

```bash
cd backend

# 가상환경 생성 및 활성화
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정
cp .env.example .env
# .env 파일을 열어 실제 값 입력

# 개발 서버 실행
uvicorn app.main:app --reload --port 8000
```

### 3. 프론트엔드 설정

```bash
cd frontend

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 파일을 열어 실제 값 입력

# 개발 서버 실행
npm run dev
```

### 4. Supabase DB 설정

[Supabase 대시보드](https://app.supabase.com) → SQL Editor에서 순서대로 실행:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_atomic_usage_rpc.sql
```

---

## 환경변수

### Backend (`backend/.env`)

```env
ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Claude API
ANTHROPIC_API_KEY=sk-ant-api03-...

# CORS (쉼표 구분 or JSON 배열)
CORS_ORIGINS=["http://localhost:5173"]

# CloudFront 시크릿 (개발 환경에서는 생략 가능)
# CLOUDFRONT_SECRET=your-secret
```

### Frontend (`frontend/.env.local`)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> `VITE_SUPABASE_ANON_KEY`는 Supabase 설계상 프론트엔드에 공개되는 키입니다.
> Service Role Key는 절대 프론트엔드에 포함하지 마세요.

---

## 보안 설계

- **JWT 검증**: JWKS 엔드포인트 기반 ES256/HS256 자동 감지 (`PyJWKClient`)
- **RLS**: 모든 Supabase 테이블에 Row Level Security 활성화 — 타 사용자 데이터 접근 불가
- **CloudFront Origin 보호**: Lambda URL 직접 접근 차단 (`X-CF-Secret` 헤더 검증)
- **보안 헤더**: HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy
- **입력 검증**: Pydantic Literal 타입으로 화이트리스트 검증 + 프롬프트 인젝션 Sanitize
- **Rate Limiting**: 엔드포인트별 시간당 횟수 제한 + 일일 사용량 원자적 RPC 차단
- **API 스키마**: 프로덕션 환경 `/openapi.json` 비공개

---

## 프로젝트 구조

```
DevNavi/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI 라우터
│   │   ├── core/         # 설정·Supabase·Rate Limiter
│   │   ├── middleware/   # JWT 인증 미들웨어
│   │   ├── models/       # Pydantic 요청/응답 모델
│   │   ├── prompts/      # Claude 프롬프트 빌더
│   │   └── services/     # 비즈니스 로직
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/   # UI 컴포넌트
│       ├── contexts/     # Theme Context
│       ├── hooks/        # useAuth, useRoadmapStream
│       ├── lib/          # api.js, supabase.js
│       └── pages/        # Landing, Onboarding, Roadmap 등
├── supabase/
│   └── migrations/       # DB 스키마 및 RPC 함수
├── terraform/            # AWS 인프라 IaC
└── docs/                 # 아키텍처 설계 문서
```

---

## 라이선스

[GNU Affero General Public License v3.0](./LICENSE) © 2025 DevNavi
