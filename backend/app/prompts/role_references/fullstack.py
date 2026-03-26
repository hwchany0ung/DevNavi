"""
풀스택 개발자 로드맵 참조 데이터
출처: 코드잇 JS 풀스택 2025, 노마드코더 로드맵, goorm 풀스택 역량, 코드잇 Node.js 백엔드 2025
"""

REFERENCE = """
[풀스택 개발자 — 2025 한국 취업 실무 참조]

■ 2025 채용 기준 핵심 스택
- 프론트: React 18 + TypeScript + Next.js 14
- 백엔드: Node.js + Express/NestJS 또는 Python + FastAPI
- DB: PostgreSQL/MySQL + Prisma ORM (Node.js) or SQLAlchemy (Python)
- 배포: Vercel(프론트) + AWS Lambda or EC2(백엔드) or Railway/Render
- 인증: NextAuth.js / Supabase Auth / JWT
- 상태관리: Zustand + TanStack Query

■ 단계별 학습 순서 (JS 풀스택 기준)
1단계: HTML/CSS + JavaScript ES6+ 기초
2단계: React (Hooks, 컴포넌트 설계) + 간단한 SPA 클론코딩
3단계: Node.js + Express REST API 구현 + MySQL/PostgreSQL 연동
4단계: TypeScript 도입 (프론트·백엔드 동시 적용)
5단계: Next.js (App Router, Server Actions, API Routes)
6단계: 인증/인가 (NextAuth, JWT, 세션 관리)
7단계: 배포 자동화 (GitHub Actions + Vercel + AWS)
8단계: 풀스택 포트폴리오 프로젝트 (실 서비스 수준)

■ 학습 프로젝트 추천 순서 (실무자 검증)
- 1차: TodoList (React 기초 + JSON Server)
- 2차: 트위터 클론 (React + Firebase Auth + Firestore)
- 3차: 단축 URL 서비스 (Next.js + PostgreSQL + 로그인 기능)
- 4차: 풀스택 커머스 or SaaS (결제·인증·대시보드 포함)

■ 2025 주요 채용 트렌드
- NestJS 채택률 급증 — 백엔드 TypeScript 표준화
- Prisma ORM 사용 증가 — Node.js 풀스택 필수 기술로 부상
- tRPC + Next.js 조합 — 타입 안전 풀스택의 신흥 강자
- Supabase/PlanetScale 등 BaaS 활용 증가 (소규모 팀)
- AI 기능 내장(OpenAI/Claude API 연동) 프로젝트 차별화 포인트

■ 자격증 우선순위
1. 정보처리기사 (대기업 지원 시 기본 스펙)
2. AWS Cloud Practitioner or SAA (배포 경험 증명)
3. SQLD (DB 역량 증명)

■ 회사 유형별 포커스
- 스타트업: 빠른 MVP 개발 능력, Next.js + Supabase + Vercel 조합
- 에이전시: 다양한 스택 경험, 빠른 온보딩, 기획→개발 전 과정 소화
- 외국계: 영어 PR 리뷰, 테스트 코드, 문서화 습관

■ 포트폴리오 핵심 포인트
- 프론트·백엔드·DB·배포까지 혼자 완성한 프로젝트
- ERD + API 명세서(Swagger or Postman) 첨부
- 성능 이슈 해결 과정 (예: DB 쿼리 최적화, CDN 적용)
- 실사용자 피드백 반영 이력 (v1 → v2 개선)

■ 기술 면접 핵심 주제
- CSR/SSR/SSG/ISR 차이와 Next.js에서의 선택 기준
- REST API vs GraphQL vs tRPC 트레이드오프
- JWT 인증 흐름, Refresh Token 전략
- DB 정규화, 인덱스 설계, N+1 문제
- 모노레포 구성 (Turborepo, Nx) — 경험 있으면 차별화
"""
