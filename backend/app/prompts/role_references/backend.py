"""
백엔드 개발자 로드맵 참조 데이터
출처: 인프런·코드잇·스파르타·내일배움캠프 2025-2026 로드맵, 코드트리 채용트렌드 2025-2026
"""

REFERENCE = """
[백엔드 개발자 — 2026 한국 취업 실무 참조]

■ 언어 선택 전략 (한국 시장 기준)
- Java + Spring Boot 3.x: 대기업·금융·SI에서 압도적 수요. GraalVM 네이티브 이미지 빌드 도입 가속.
- Kotlin + Spring Boot: 대기업·핀테크 중심 Kotlin 전환 가속 (카카오·토스·라인 등). Java 대비 코드 간결성과 코루틴 비동기 처리 이점.
- Python + FastAPI: 스타트업·AI 기반 서비스·데이터 연계 백엔드. LLM 연동 백엔드에서 사실상 표준.
- Node.js + NestJS: 스타트업·MSP·외국계, JS 풀스택 팀에서 선호.
- Rust 백엔드: 고성능·시스템 프로그래밍 수요 증가. Axum/Actix 프레임워크 — 아직 채용 소수지만 차별화 포인트.
- 진입 속도: Python > Node.js > Kotlin > Java 순. 대기업 목표 시 Java/Kotlin 필수.

■ 단계별 학습 순서 (실무자 추천)
1단계 (기초): 언어 문법 + OOP 개념 + 자료구조/알고리즘 기초
2단계 (웹 기초): HTTP/REST API 개념 + Git + Linux 기본 명령어
3단계 (프레임워크): Spring Boot 3.x 또는 FastAPI로 CRUD API 구현
4단계 (DB): SQL(PostgreSQL/MySQL) + ORM(JPA/SQLAlchemy) + 인덱스·트랜잭션
5단계 (인증/보안): JWT, OAuth2.0, Spring Security or FastAPI auth
6단계 (인프라 기초): Docker 컨테이너화 + AWS EC2/RDS 배포 경험
7단계 (심화): 캐시(Redis), 메시지큐(Kafka/RabbitMQ), gRPC, 성능 최적화
8단계 (AI 연동): LLM API 연동 경험 (OpenAI/Claude API + RAG 기초)
9단계 (포트폴리오): GitHub에 실서비스 수준 API 프로젝트 1~2개

■ 2026 채용 공고 필수 기술 (한국)
- Java/Kotlin + Spring Boot 3.x, Python/FastAPI, RESTful API 설계
- JPA/Hibernate, MyBatis (대기업·금융), QueryDSL
- MySQL/PostgreSQL, Redis, MongoDB (NoSQL 수요 증가)
- Docker, Kubernetes 기초, AWS (EC2/S3/RDS/Lambda)
- Git, GitHub Actions (CI/CD 기초), ArgoCD (DevOps 연계)
- gRPC / GraphQL — 마이크로서비스 간 통신 수요 증가
- 코딩테스트: 프로그래머스 Lv2~3 수준 (Kotlin 지원 기업 증가)
- AI 연동: Claude/OpenAI API 호출 경험 가산점 (2026 신규 트렌드)

■ 한국 시장 자격증 우선순위
1. 정보처리기사 (공기업·대기업 필수, 취업 전 취득 권장)
2. SQLD (SQL 능력 증명, DB 업무 지원 시 유리)
3. AWS Cloud Practitioner (클라우드 기초 이해 증명)
4. AWS SAA (클라우드 심화, 스타트업·MSP 가산점)

■ 회사 유형별 기술 포커스
- 대기업/금융: Java/Kotlin + Spring Boot 3.x + MyBatis + Oracle/MySQL, 정보처리기사 필수
- 스타트업: Python/Node.js + Docker + AWS + CI/CD, AI API 연동 경험 중요
- MSP: AWS 서비스 이해 + Terraform 기초 + 모니터링(CloudWatch)
- SI: Java + Spring + 전자정부프레임워크, 공공 도메인 이해
- 외국계: 영어 소통 + gRPC/GraphQL + 마이크로서비스 경험

■ 포트폴리오 핵심 포인트 (2026 채용 기준)
- 단순 CRUD를 넘어 성능 최적화·트레이드오프 설명 가능해야 함
- README에 아키텍처 다이어그램, API 명세서(Swagger) 필수
- 실제 배포 링크 or AWS 배포 경험 증명
- 코드 리뷰 경험(PR), 테스트 코드(JUnit/pytest) 작성 여부
- AI 기능 연동 프로젝트 (LLM API 활용) — 2026 차별화 핵심

■ 기술 면접 핵심 주제
- JVM 메모리 구조, GC 동작 방식 (Java/Kotlin)
- Spring IoC/DI, AOP, 트랜잭션 관리, Spring Boot 3.x 변경사항
- DB 인덱스 동작 원리, N+1 문제 해결
- HTTP 1.1/2.0/3.0 차이, REST vs GraphQL vs gRPC
- 동시성 처리(Thread, Lock, 낙관적/비관적 잠금, Kotlin 코루틴)
- 마이크로서비스 아키텍처 설계 원칙, 이벤트 드리븐 패턴
"""
