"""
클라우드/DevOps 엔지니어 로드맵 참조 데이터
출처: 인포그랩 DevOps 블로그 2025-2026, 링커리어 AWS 자격증 가이드, 평생배움 AWS 자격증 2025-2026
"""

REFERENCE = """
[클라우드/DevOps 엔지니어 — 2026 한국 취업 실무 참조]

■ 2026 핵심 기술 스택
- 클라우드: AWS (국내 1위), GCP·Azure (외국계·대기업)
- IaC: Terraform (업계 표준), OpenTofu (오픈소스 대안), Pulumi (프로그래밍 언어 IaC)
- 컨테이너: Docker → Kubernetes 1.30+ (EKS/GKE), Helm 3
- CI/CD: GitHub Actions (스타트업 표준), Jenkins (대기업·금융 여전히 사용)
- GitOps: ArgoCD (사실상 표준), Flux — 선언적 배포 자동화 필수화
- Platform Engineering: 내부 개발자 플랫폼(IDP) 구축 역량 — 2026 최대 트렌드
- 모니터링: CloudWatch, Prometheus + Grafana, Datadog, OpenTelemetry (관찰성 통합)
- 네트워킹: eBPF 기반 네트워크 관찰성·보안 (Cilium), Service Mesh (Istio/Linkerd)
- FinOps: 클라우드 비용 최적화 전문 역할 부상 — 비용 가시성·예산 관리 역량 필수
- 스크립팅: Python (자동화), Go (k8s 관련 도구 개발), Bash 기본

■ AWS 자격증 취득 순서 (실무자 추천)
1. AWS Cloud Practitioner (CLF) — 개념 입문, 1~2주 준비
2. AWS Solutions Architect Associate (SAA) — 핵심 자격증, 2~3개월 준비
3. (분기) SysOps Administrator Associate — 운영 중심
    또는 Developer Associate — 개발자 친화 DevOps
4. AWS DevOps Engineer Professional — 고급, 실무 2년+ 권장
※ SAA 없이 DevOps Pro 도전 가능하지만 합격률 낮음

■ 단계별 학습 순서
1단계: Linux 기초 + Bash 스크립팅 + 네트워크 기초 (TCP/IP, DNS, HTTP)
2단계: AWS 핵심 서비스 실습 (EC2, S3, VPC, IAM, RDS, CloudFront, Lambda)
3단계: Docker 컨테이너 이해 + Docker Compose 로컬 환경 구성
4단계: CI/CD 파이프라인 구축 (GitHub Actions → S3 or EC2 자동 배포)
5단계: Terraform으로 AWS 인프라 코드화 (IaC 입문)
6단계: Kubernetes 1.30+ 기초 (Pod, Service, Deployment, Ingress) + Helm 차트
7단계: GitOps 도입 (ArgoCD/Flux로 선언적 배포 자동화)
8단계: Platform Engineering 기초 (Backstage IDP, 셀프서비스 인프라)
9단계: 모니터링·관찰성 (Prometheus + Grafana + OpenTelemetry)
10단계: 포트폴리오: 실제 서비스 인프라 구성 + GitOps 파이프라인 + FinOps 보고서

■ 한국 채용 자격증 우선순위
1. AWS SAA (거의 모든 클라우드 JD에 우대/필수)
2. CKA — Certified Kubernetes Administrator (k8s 필수 직군, 2026 수요 급증)
3. 정보처리기사 (공기업·대기업 클라우드 운영직 필수)
4. AWS DevOps Engineer Professional (시니어 포지션 차별화)
5. HashiCorp Terraform Associate (IaC 전문성 증명)
6. 리눅스마스터 2급 (MSP·공공기관 우대)

■ 회사 유형별 포커스
- MSP(클라우드 관리 서비스): AWS SAA 필수, 고객사 인프라 설계·운영, FinOps 비용 최적화 경험
- 스타트업: Docker + GitHub Actions + Terraform + ArgoCD, 빠른 GitOps 배포 자동화
- 대기업: On-premise + 하이브리드 클라우드, Jenkins → ArgoCD 전환 중, Platform Engineering 역량
- 외국계: GCP/Azure 경험, k8s, SRE 개념(SLO/SLA/에러버짓), eBPF/Cilium 경험 가산

■ 포트폴리오 핵심 포인트
- 직접 구성한 AWS 아키텍처 다이어그램 (draw.io 또는 Lucidchart)
- Terraform으로 인프라 코드화한 GitHub 레포
- GitOps 파이프라인 구성 (ArgoCD + Helm + GitHub Actions) — 2026 핵심 차별화
- CI/CD 파이프라인 구성 및 자동화 내역
- FinOps 비용 최적화 경험 (Reserved Instance, Spot, Savings Plans, S3 스토리지 클래스)
- 장애 대응 runbook 문서 작성 경험

■ 기술 면접 핵심 주제
- AWS VPC 설계 (public/private 서브넷, NAT Gateway)
- Blue/Green, Canary 배포 전략 차이, ArgoCD Rollout 전략
- Kubernetes Pod 스케줄링, HPA/VPA 동작 원리, k8s 1.30+ 변경사항
- IaC의 장점과 Terraform state 관리 방법, Terraform vs Pulumi 비교
- GitOps 원칙과 ArgoCD Application 구조
- Platform Engineering: IDP 설계, 셀프서비스 인프라 개념
- eBPF 동작 원리, Cilium 기반 네트워크 정책
- 서비스 가용성 99.9% 보장을 위한 아키텍처 설계
"""
