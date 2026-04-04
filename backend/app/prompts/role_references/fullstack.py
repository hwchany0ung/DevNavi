"""
풀스택 개발자 로드맵 참조 데이터
출처: 코드잇 JS 풀스택 2025-2026, 노마드코더 로드맵, goorm 풀스택 역량, 코드잇 Node.js 백엔드 2025-2026
"""

REFERENCE = """
[풀스택 개발자 — 2026 한국 취업 실무 참조]

■ 2026 채용 기준 핵심 스택
- 프론트: React 19 + TypeScript 5.x + Next.js 15 (App Router 표준화)
- 백엔드: Node.js + NestJS (TypeScript 표준) 또는 Python + FastAPI
- DB: PostgreSQL/MySQL + Prisma ORM (Node.js) or SQLAlchemy (Python)
- 배포: Vercel(프론트) + AWS Lambda or EC2(백엔드) or Railway/Render
- 인증: NextAuth.js v5 / Supabase Auth / JWT
- 상태관리: Zustand + TanStack Query v5
- 런타임: Node.js 22 LTS / Bun 1.x (대안 런타임으로 부상)
- 타입 안전: tRPC v11 — 풀스택 타입 공유의 사실상 표준

■ 단계별 학습 순서 (JS 풀스택 기준)
1단계: HTML/CSS + JavaScript ES6+ 기초
2단계: React (Hooks, 컴포넌트 설계) + 간단한 SPA 클론코딩
3단계: Node.js + Express/NestJS REST API 구현 + PostgreSQL 연동
4단계: TypeScript 5.x 도입 (프론트·백엔드 동시 적용)
5단계: Next.js 15 (App Router, Server Components, Server Actions)
6단계: 인증/인가 (NextAuth v5, JWT, 세션 관리) + tRPC 타입 안전 API
7단계: 배포 자동화 (GitHub Actions + Vercel + AWS)
8단계: AI 연동 (OpenAI/Claude API) + 풀스택 포트폴리오 프로젝트

■ 학습 프로젝트 추천 순서 (실무자 검증)
- 1차: TodoList (React 기초 + JSON Server)
- 2차: 트위터/스레드 클론 (React + Firebase Auth + Firestore)
- 3차: 단축 URL 서비스 (Next.js 15 + PostgreSQL + tRPC + 로그인)
- 4차: AI 챗봇 SaaS (LLM API + RAG + 결제·인증·대시보드 포함)

■ 2026 주요 채용 트렌드
- Next.js 15 App Router 완전 표준화 — Pages Router 레거시 전환 가속
- NestJS → 백엔드 TypeScript 표준 지위 확립, Express 레거시화
- tRPC v11 + Next.js 15 조합 — 타입 안전 풀스택의 사실상 표준
- Bun 런타임 채택 증가 — 빌드 속도·패키지 관리 이점, 스타트업 도입 확대
- Prisma ORM 5.x — 관계 쿼리 성능 대폭 개선, 풀스택 ORM 표준
- Supabase/Neon 등 Serverless DB + BaaS 활용 증가 (소규모 팀 필수)
- AI 기능 내장(OpenAI/Claude API + RAG 연동) 프로젝트 — 2026 면접 차별화 핵심
- Monorepo (Turborepo/Nx) 경험이 중견기업 이상에서 우대 사항화

■ 자격증 우선순위
1. 정보처리기사 (대기업 지원 시 기본 스펙)
2. AWS Cloud Practitioner or SAA (배포 경험 증명)
3. SQLD (DB 역량 증명)

■ 회사 유형별 포커스
- 스타트업: 빠른 MVP 개발 능력, Next.js 15 + Supabase + Vercel 조합, AI 기능 연동
- 에이전시: 다양한 스택 경험, 빠른 온보딩, 기획→개발 전 과정 소화
- 외국계: 영어 PR 리뷰, 테스트 코드(Vitest/Playwright), 문서화 습관
- 대기업: TypeScript + React + NestJS, 모노레포 경험, 코딩테스트 필수

■ 포트폴리오 핵심 포인트
- 프론트·백엔드·DB·배포까지 혼자 완성한 프로젝트
- ERD + API 명세서(Swagger or Postman or tRPC 문서) 첨부
- 성능 이슈 해결 과정 (예: DB 쿼리 최적화, CDN 적용, React Profiler)
- AI 기능 연동 경험 (LLM API 호출 + 스트리밍 처리) — 2026 핵심 차별화
- 실사용자 피드백 반영 이력 (v1 → v2 개선)

■ 기술 면접 핵심 주제
- Server Components vs Client Components, React 19 변경사항
- CSR/SSR/SSG/ISR/PPR 차이와 Next.js 15에서의 선택 기준
- REST API vs GraphQL vs tRPC 트레이드오프
- JWT 인증 흐름, Refresh Token 전략
- DB 정규화, 인덱스 설계, N+1 문제
- 모노레포 구성 (Turborepo, Nx) — 경험 있으면 차별화
- Bun vs Node.js 차이, ESM/CJS 호환성 이슈
"""
