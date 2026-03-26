# CareerPath — 시스템 아키텍처 설계

> v1.2 기준 | 2026.03

---

## 1. Overview

CareerPath는 IT 직군 취준생이 7개 온보딩 질문에 답하면 Claude AI가 개인화된 월별 학습 로드맵을 즉시 생성해주는 웹 서비스다. 무료 사용자는 Claude Haiku로 티저 로드맵을, 유료 구독자는 Claude Sonnet으로 완전한 심화 로드맵을 제공한다.

**핵심 설계 목표:**
- **비용 최소화**: 서버리스(Lambda) + Supabase 무료 플랜으로 초기 월 비용 ~6,000원
- **체감 대기 0초**: SSE 스트리밍으로 AI 응답을 즉시 타이핑 효과로 렌더링
- **확장 가능성**: MAU 100 → 1만 구간을 인프라 교체 없이 수용

**범위 외 (v2.0 이관):**
- 채용 공고 크롤링 / FCM 알림
- Notion / Markdown 내보내기
- B2B 어필리에이트 자동화

---

## 2. 시스템 아키텍처 다이어그램

```mermaid
graph TD
  subgraph Client["클라이언트 브라우저"]
    React["React + Tailwind\n(Vite SPA)"]
    PDF["@react-pdf/renderer\n(lazy import)"]
  end

  subgraph AWS["AWS (ap-northeast-2)"]
    CF["CloudFront CDN"]
    S3["S3\n정적 빌드 호스팅"]
    APIGW["API Gateway\nHTTPS + SSE"]
    Lambda["AWS Lambda\nFastAPI (Python)"]
  end

  subgraph External["외부 서비스"]
    Supabase["Supabase\nPostgreSQL + Auth"]
    ClaudeHaiku["Claude Haiku 4.5\n무료 플랜 · 티저"]
    ClaudeSonnet["Claude Sonnet 4.6\n유료 플랜 · 심화"]
    Toss["토스페이먼츠\n구독 결제"]
  end

  React -->|"HTTPS 정적 파일"| CF
  CF -->|"캐시 미스 시"| S3
  React -->|"SSE / REST"| APIGW
  APIGW -->|"invoke"| Lambda
  Lambda -->|"REST API"| Supabase
  Lambda -->|"SSE 스트림 (무료)"| ClaudeHaiku
  Lambda -->|"SSE 스트림 (유료)"| ClaudeSonnet
  React -->|"결제 위젯"| Toss
  Toss -->|"Webhook"| Lambda
  React -->|"PDF 렌더 (클라이언트)"| PDF
```

---

## 3. 컴포넌트 설명

| 컴포넌트 | 역할 | 기술 선택 이유 |
|---|---|---|
| **React + Tailwind** | SPA UI, SSE 수신, 상태 관리 | 기존 스택 활용, Vite로 빠른 빌드 |
| **S3 + CloudFront** | 정적 파일 전역 배포 | 월 ~1,000원, 포트폴리오 배포 경험 재활용 |
| **API Gateway** | HTTPS 엔드포인트, SSE 지원 | Lambda 앞단 관리형 게이트웨이 |
| **Lambda (FastAPI)** | AI 호출·DB 저장·구독 분기 | 서버리스로 유휴 비용 0원, Python 숙련도 |
| **Supabase** | PostgreSQL DB + Auth | Lambda 커넥션 풀 고갈 방지(REST API 방식), 초기 0원 |
| **Claude Haiku 4.5** | 무료 티저 로드맵 생성 | 저비용·고속, Step 1 응답에 적합 |
| **Claude Sonnet 4.6** | 유료 심화 로드맵 생성 | 정교한 추론, 유료 차별화 핵심 |
| **토스페이먼츠** | 구독 결제·Webhook | 국내 PG, 포트원 경유 가입비 0원 |
| **@react-pdf/renderer** | PDF 다운로드 | 클라이언트 렌더링 → 서버 비용 0원 |

---

## 4. 핵심 시퀀스 다이어그램

### 4-1. Step 1 티저 생성 (SSE 스트리밍)

```mermaid
sequenceDiagram
  actor User
  participant FE as React FE
  participant APIGW as API Gateway
  participant Lambda as Lambda (FastAPI)
  participant Haiku as Claude Haiku 4.5
  participant DB as Supabase

  User->>FE: Q1·Q2·Q3 입력 후 제출
  FE->>APIGW: POST /roadmap/teaser (SSE 요청)
  APIGW->>Lambda: invoke
  Lambda->>Lambda: 프롬프트 조합 (직군·기간·수준)
  Lambda->>Haiku: messages.create(stream=True)
  Haiku-->>Lambda: SSE 청크 스트림
  Lambda-->>APIGW: SSE 청크 전달
  APIGW-->>FE: text/event-stream
  FE-->>User: 타이핑 효과 실시간 렌더링
  Lambda->>DB: 티저 로드맵 임시 저장
```

### 4-2. Step 2 심화 로드맵 생성 (유료)

```mermaid
sequenceDiagram
  actor User
  participant FE as React FE
  participant Lambda as Lambda (FastAPI)
  participant Sonnet as Claude Sonnet 4.6
  participant DB as Supabase

  User->>FE: Q4~Q7 추가 입력
  FE->>Lambda: POST /roadmap/full (Bearer JWT)
  Lambda->>DB: 구독 상태 확인 (is_premium)
  alt 유료 구독자
    Lambda->>Sonnet: messages.create(stream=True)
    Sonnet-->>Lambda: SSE 청크
    Lambda-->>FE: 스트리밍 응답
    Lambda->>DB: 로드맵 저장 (버전 히스토리)
  else 무료 사용자
    Lambda-->>FE: 402 Upgrade Required
    FE-->>User: 업그레이드 유도 모달
  end
```

### 4-3. GPS 재탐색

```mermaid
sequenceDiagram
  actor User
  participant FE as React FE
  participant Lambda as Lambda (FastAPI)
  participant Sonnet as Claude Sonnet 4.6
  participant DB as Supabase

  User->>FE: GPS 재탐색 버튼 클릭
  FE->>Lambda: POST /roadmap/reroute
  Lambda->>DB: 현재 로드맵·체크리스트 조회
  Lambda->>Lambda: 완료율·잔여 기간 계산
  Lambda->>Sonnet: 재조정 프롬프트 (SSE)
  Sonnet-->>Lambda: 새 스케줄 스트림
  Lambda-->>FE: 스트리밍 응답
  Lambda->>DB: 로드맵 버전 업데이트
  FE-->>User: 재조정된 로드맵 렌더링
```

### 4-4. 결제 Webhook

```mermaid
sequenceDiagram
  participant Toss as 토스페이먼츠
  participant Lambda as Lambda (FastAPI)
  participant DB as Supabase

  Toss->>Lambda: POST /webhook/toss (구독 확정)
  Lambda->>Lambda: HMAC 서명 검증
  Lambda->>DB: UPDATE users SET is_premium=true
  Lambda-->>Toss: 200 OK
```

---

## 5. 배포 토폴로지

```mermaid
graph TD
  User["사용자 브라우저"]
  CF["CloudFront (글로벌 엣지)"]
  S3["S3 — careerpath-frontend"]
  APIGW["API Gateway"]
  Lambda["Lambda — careerpath-api\nPython 3.12 · 512MB · 30s timeout"]
  SupaAuth["Supabase Auth"]
  SupaDB["PostgreSQL (PostgREST)"]
  ClaudeAPI["Claude API (Haiku / Sonnet)"]

  User -->|HTTPS| CF
  CF --> S3
  User -->|SSE / REST| APIGW
  APIGW --> Lambda
  Lambda --> SupaAuth
  Lambda --> SupaDB
  Lambda --> ClaudeAPI
```

---

## 6. 오픈 이슈

| 항목 | 비고 |
|---|---|
| Lambda SSE 지원 | API Gateway HTTP API + Lambda Response Streaming 조합 필요 |
| Supabase RLS | 사용자별 로드맵 격리 필수 |
| Claude API Rate Limit | 무료 사용자 일일 3회 제한으로 급증 방어 |
| 토스페이먼츠 사업자 등록 | M5 착수 전 신청 (처리 약 1주) |
