# DevNavi ML 통합 워크플로우

> ML 기능 개발 시에만 참조. 일반 BE/FE 작업에는 불필요.

## ML 통합 병렬 워크플로우

### Phase 1 — 요구사항 정의
- PM이 일반 기능 명세 + **ML 모델 타겟 지표**를 함께 명시
- 예: "로드맵 생성 정확도 ≥ 85%, 응답 시간 ≤ 3초, Hallucination 비율 ≤ 5%"

### Phase 2 — 시스템 설계
- Architect가 일반 DB 설계 + **ML 데이터 파이프라인(ETL) + 추론 서버 아키텍처** 분리 설계
- DevNavi 적용: Claude API 프롬프트 최적화 파이프라인 + 로드맵 품질 평가 서버

### Phase 3 — 병렬 구현 (핵심)
```
Developer Agent  ─── UI·백엔드 로직·DB 연동 ──────────────┐
                                                            ├─→ 통합
ML Agent ─────── 모델 학습·추론 모듈·Inference API화 ────────┘
```
- 두 에이전트는 **독립적으로 병렬 실행** (서로의 작업에 개입 금지)
- ML Agent 산출물: `backend/app/ml/` 디렉토리 아래 추론 모듈 + API 엔드포인트

### Phase 4 — 하이브리드 검증 루프

| 검증 트랙 | 담당 | 기준 | 실패 시 |
|---------|------|------|--------|
| 코드 검증 | code-analyzer / gap-detector | Match Rate ≥ 90% | developer 재수정 |
| **모델 검증** | **qa-monitor (ML 트랙)** | **타겟 지표 달성 + 과적합 없음** | **ML Agent 재학습 (최대 3회)** |

---

## DevNavi ML 적용 범위

| ML 기능 | 현재 상태 | ML Agent 역할 |
|---------|---------|-------------|
| 로드맵 생성 | Claude API (claude_service.py) | 프롬프트 파이프라인 최적화, 품질 평가 모델 |
| 커리어 경로 추천 | 미구현 | 사용자 스킬 데이터 기반 추천 모델 |
| 로드맵 품질 평가 | 미구현 | Hallucination 탐지, 일관성 점수 |
| 사용자 성향 분석 | 미구현 | 온보딩 응답 기반 클러스터링 |

### ML Agent 작업 디렉토리
```
backend/app/ml/
├── pipeline/      # 데이터 전처리·Feature Engineering
├── models/        # 학습된 모델 저장
├── inference/     # 추론 로직 모듈
└── evaluation/    # 성능 지표 평가 스크립트
```
