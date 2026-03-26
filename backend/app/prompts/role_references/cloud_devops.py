"""
클라우드/DevOps 엔지니어 로드맵 참조 데이터
출처: 인포그랩 DevOps 블로그 2025, 링커리어 AWS 자격증 가이드, 평생배움 AWS 자격증 2025
"""

REFERENCE = """
[클라우드/DevOps 엔지니어 — 2025 한국 취업 실무 참조]

■ 2025 핵심 기술 스택
- 클라우드: AWS (국내 1위), GCP·Azure (외국계·대기업)
- IaC: Terraform (업계 표준), AWS CDK
- 컨테이너: Docker → Kubernetes (EKS/GKE)
- CI/CD: GitHub Actions (스타트업 표준), Jenkins (대기업·금융 여전히 사용)
- 모니터링: CloudWatch, Prometheus + Grafana, Datadog
- 스크립팅: Python (자동화), Bash 기본
- 네트워크: VPC, 서브넷, 보안그룹, ALB/NLB 설계

■ AWS 자격증 취득 순서 (실무자 추천)
1. AWS Cloud Practitioner (CLF) — 개념 입문, 1~2주 준비
2. AWS Solutions Architect Associate (SAA) — 핵심 자격증, 2~3개월 준비
3. (분기) SysOps Administrator Associate — 운영 중심
    또는 Developer Associate — 개발자 친화 DevOps
4. AWS DevOps Engineer Professional — 고급, 실무 2년+ 권장
※ SAA 없이 DevOps Pro 도전 가능하지만 합격률 낮음

■ 단계별 학습 순서
1단계: Linux 기초 + Bash 스크립팅 + 네트워크 기초 (TCP/IP, DNS, HTTP)
2단계: AWS 핵심 서비스 실습 (EC2, S3, VPC, IAM, RDS, CloudFront)
3단계: Docker 컨테이너 이해 + Docker Compose 로컬 환경 구성
4단계: CI/CD 파이프라인 구축 (GitHub Actions → S3 or EC2 자동 배포)
5단계: Terraform으로 AWS 인프라 코드화 (IaC 입문)
6단계: Kubernetes 기초 (Pod, Service, Deployment, Ingress)
7단계: 모니터링·알림 구성 (CloudWatch, Grafana 대시보드)
8단계: 포트폴리오: 실제 서비스 인프라 구성 + 운영 자동화 문서화

■ 한국 채용 자격증 우선순위
1. AWS SAA (거의 모든 클라우드 JD에 우대/필수)
2. 정보처리기사 (공기업·대기업 클라우드 운영직 필수)
3. CKA — Certified Kubernetes Administrator (k8s 필수 직군)
4. AWS DevOps Engineer Professional (시니어 포지션 차별화)
5. HashiCorp Terraform Associate (IaC 전문성 증명)

■ 회사 유형별 포커스
- MSP(클라우드 관리 서비스): AWS SAA 필수, 고객사 인프라 설계·운영, 비용 최적화 경험
- 스타트업: Docker + GitHub Actions + Terraform, 빠른 배포 자동화
- 대기업: On-premise + 하이브리드 클라우드, Jenkins, 보안 규정 준수
- 외국계: GCP/Azure 경험, k8s, SRE 개념(SLO/SLA/에러버짓)

■ 포트폴리오 핵심 포인트
- 직접 구성한 AWS 아키텍처 다이어그램 (draw.io 또는 Lucidchart)
- Terraform으로 인프라 코드화한 GitHub 레포
- CI/CD 파이프라인 구성 및 자동화 내역
- 비용 최적화 경험 (Reserved Instance, Spot, S3 스토리지 클래스)
- 장애 대응 runbook 문서 작성 경험

■ 기술 면접 핵심 주제
- AWS VPC 설계 (public/private 서브넷, NAT Gateway)
- Blue/Green, Canary 배포 전략 차이
- Kubernetes Pod 스케줄링, HPA 동작 원리
- IaC의 장점과 Terraform state 관리 방법
- 서비스 가용성 99.9% 보장을 위한 아키텍처 설계
"""
