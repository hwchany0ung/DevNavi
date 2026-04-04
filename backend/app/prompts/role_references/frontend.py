"""
프론트엔드 개발자 로드맵 참조 데이터
출처: 멋쟁이사자처럼·코드잇·스파르타·내일배움캠프 2025-2026 로드맵, 패스트캠퍼스
"""

REFERENCE = """
[프론트엔드 개발자 — 2026 한국 취업 실무 참조]

■ 2026 핵심 기술 스택 (한국 채용 기준)
- HTML5/CSS3 + Flexbox/Grid + 반응형 웹 (필수 기초)
- JavaScript ES6+ (비동기/Promise/async await, 클로저, 프로토타입)
- React 19 (Server Components 실무화, use() 훅, Actions API, 자동 메모이제이션)
- TypeScript 5.x (모든 규모 기업에서 사실상 필수화, satisfies 연산자 등 최신 기능)
- Next.js 15 (App Router 완전 표준화, Server Actions 실무 도입, Partial Prerendering)
- Tailwind CSS v4 (CSS 변수 기반 리팩토링, 성능 개선) 또는 CSS Modules
- Zustand / TanStack Query v5 (서버 상태관리 — 주류 유지)
- Vite 6 (빌드 도구 표준 확립, Rolldown 엔진 전환 예정)
- Vitest (Jest 대체 — Vite 생태계 테스트 러너로 급부상)

■ 단계별 학습 순서
1단계: HTML/CSS 기초 + Git + 정적 페이지 클론코딩
2단계: JavaScript 핵심 문법 + DOM 조작 + 비동기 처리
3단계: React 기초 (컴포넌트·Props·State·Hooks) + 간단한 SPA 제작
4단계: TypeScript 5.x 병행 + React 심화 (라우팅·상태관리·API 통신)
5단계: Next.js 15 (App Router·Server Components·Server Actions, SEO 최적화)
6단계: 성능 최적화 (Code Splitting, Lazy Loading, Web Vitals, React Compiler)
7단계: 테스트 (Vitest + React Testing Library + Playwright E2E)
8단계: 포트폴리오 프로젝트 (실사용 가능 수준 서비스 + AI 기능 연동)

■ 2026 채용 트렌드 특이사항
- React 19 Server Components — 클라이언트/서버 컴포넌트 분리 설계 역량 필수
- TypeScript 5.x 미사용 프로젝트는 경쟁력 약화 — 입문부터 병행 필수
- Next.js 15 App Router 완전 표준화 — Pages Router 레거시 취급 시작
- AI API 연동 경험(OpenAI, Claude) 가산점 → 2026년부터 우대 명시 공고 증가
- React Compiler(자동 메모이제이션) 도입 — useMemo/useCallback 감소 추세
- Vitest가 Jest를 대체하는 추세 — Vite 기반 프로젝트에서 사실상 표준
- 웹 접근성(WAI-ARIA) 이해 — 중견기업 이상 체크, 공공기관 필수
- Storybook + Chromatic — 시각적 회귀 테스트 경험 차별화

■ 자격증 (프론트엔드 특화)
- 정보처리기사 (대기업·공기업 지원 시 유리)
- GTQ(그래픽기술자격) — UI/UX 겸직 시 참고
- AWS Cloud Practitioner — 배포 이해 증명용

■ 회사 유형별 포커스
- 대기업: TypeScript 필수, React 19 SSR/SSG 이해, 접근성 준수, 레거시 jQuery 유지보수
- 스타트업: React 19 + Next.js 15 + Tailwind v4, 빠른 기능 구현 능력, AI 기능 내장
- 외국계: 영어 문서 독해, Vitest/Playwright 테스트, PR 리뷰 경험
- 에이전시/SI: 반응형 퍼블리싱, jQuery 여전히 요구하는 곳 존재

■ 포트폴리오 핵심 포인트
- 단순 TodoList X → 실 서비스 수준 (로그인·검색·무한스크롤 포함)
- Lighthouse 성능 점수 90+ 최적화 과정 설명 가능
- 반응형 구현 + 크로스브라우저 테스트 완료
- GitHub PR 기록 + 커밋 메시지 컨벤션 유지
- Server Components 활용 프로젝트 — 2026 차별화 핵심

■ 기술 면접 핵심 주제
- 브라우저 렌더링 파이프라인 (Critical Rendering Path)
- Virtual DOM 동작 원리, React 재조정(Reconciliation), React 19 변경사항
- Client Components vs Server Components 차이, use() 훅
- CSR vs SSR vs SSG vs ISR, Partial Prerendering(PPR) 개념
- 클로저, 호이스팅, this 바인딩, 이벤트 루프
- HTTP 캐싱, CORS, 쿠키 vs localStorage vs sessionStorage
- React Compiler가 해결하는 문제와 기존 메모이제이션 패턴 비교
"""
