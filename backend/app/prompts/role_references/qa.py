"""
QA 엔지니어 로드맵 참조 데이터
출처: 코드잇 QA 직무 분석, SLEXN QA 2025 트렌드, 무신사 QA 엔지니어 블로그, 커리얼리 QA 취준 Q&A
"""

REFERENCE = """
[QA 엔지니어 — 2025 한국 취업 실무 참조]

■ QA 직무 세부 분류
- Manual QA: 수동 테스트 중심, 테스트케이스 설계·실행, 버그 리포팅
- Automation QA: 자동화 테스트 스크립트 작성, CI/CD 통합
- Performance QA: 부하·스트레스 테스트, 성능 병목 분석
- Mobile QA: 앱 테스트, 기기·OS 호환성 검증
※ 신입은 Manual QA로 시작해 Automation으로 성장하는 게 일반적

■ 신입 QA에게 가장 중요한 핵심 역량
1. 논리적 사고력: 버그 재현 → 원인 가설 → 정리 능력
2. 문서화 능력: 테스트케이스, 버그 리포트 작성 (명확하고 재현 가능하게)
3. 소통 역량: 개발팀·기획팀과 버그 협의, 우선순위 조율
4. 디테일 집중력: 엣지 케이스, 경계값 테스트 설계
5. 도메인 이해: 서비스 사용자 관점 + 기술적 동작 원리 이해

■ 단계별 학습 순서
1단계: 소프트웨어 테스트 기초 이론 (ISTQB Foundation Level 기반)
   - 테스트 레벨(단위/통합/시스템/인수), 테스트 기법(동등분할/경계값)
2단계: 테스트 케이스 설계 실습 (실제 앱 사용하며 TC 작성)
3단계: 버그 리포팅 도구 실습 (JIRA, Notion, GitHub Issues)
4단계: API 테스트 기초 (Postman으로 REST API 테스트)
5단계: HTTP 기초 + DB 기초 SQL (기술 커뮤니케이션용)
6단계: 자동화 테스트 입문
   - 웹: Selenium + Python or Playwright + TypeScript
   - API: Postman Collection Runner or Newman
   - 모바일: Appium (선택)
7단계: CI/CD 통합 (GitHub Actions에 자동화 테스트 연결)
8단계: 성능 테스트 기초 (JMeter or k6)

■ 2025 QA 자동화 트렌드 (실무 기준)
- Playwright (Microsoft): Selenium 대체 급부상, TypeScript 기반
- Cypress: E2E 테스트 표준, JS 생태계
- AI 기반 테스트 자동화: Copilot, testRigor 등 AI 도구 부상
- 모바일: Appium → Maestro (새로운 강자), Detox (React Native)
- API: Postman + Newman + GitHub Actions CI 통합

■ 실무 도구 숙련도 목표
- 이슈 트래킹: JIRA (필수), Linear, GitHub Issues
- 테스트 관리: TestRail, Xray (JIRA 플러그인), Zephyr
- 문서 작성: Confluence, Notion
- 자동화: Selenium/Playwright, Postman
- 커뮤니케이션: Slack, Google Meet

■ 자격증 (QA 특화)
- ISTQB Foundation Level (국제 공인, QA 기초 증명 — 이력서 가산점)
- 정보처리기사 (대기업·IT서비스 기업 QA팀 지원 시 우대)
- CSTS (국내 소프트웨어 테스트 전문가 — TTA 시행)

■ 회사 유형별 포커스
- 스타트업: 매뉴얼+자동화 병행, 기획부터 참여하는 QA, Notion 문서화
- 대기업/IT서비스: 프로세스 기반 TC 관리, JIRA/TestRail 활용
- 게임 회사: 게임 클라이언트 테스트, 기기 호환성, 그래픽·물리 버그
- 핀테크/금융: 보안 테스트, 규정 준수 테스트, 성능·부하 테스트

■ 포트폴리오 핵심 포인트 (신입 QA)
- 직접 작성한 테스트 케이스 문서 (공개 앱 대상, 정량화된 항목+PASS/FAIL)
- 버그 리포트 샘플 (스크린샷 + 재현 과정 + 심각도 분류)
- Postman 기반 API 테스트 컬렉션 GitHub 공개
- Selenium/Playwright 자동화 스크립트 (로그인·주요 플로우)
- 테스트 회고 문서 (발견한 인사이트, 개선 제안)

■ 기술 면접 핵심 주제
- 테스트 케이스 설계 기법 (동등분할, 경계값 분석, 결정 테이블)
- 버그 심각도(Severity) vs 우선순위(Priority) 차이
- 회귀 테스트 vs 스모크 테스트 vs 탐색적 테스트 차이
- CI/CD 파이프라인에서 QA 자동화가 어느 단계에 위치하는지
- "왜 QA를 선택했는가" — 서비스 품질·사용자 경험 관점 답변 준비
"""
