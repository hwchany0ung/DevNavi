"""
AI/ML 엔지니어 로드맵 참조 데이터
출처: 코드잇 AI엔지니어 취업 2025-2026, 코드트리 AI개발자 로드맵, 모두의연구소 ML엔지니어 커리어, 요즘IT AI엔지니어 스킬
"""

REFERENCE = """
[AI/ML 엔지니어 — 2026 한국 취업 실무 참조]

■ 2026 AI 취업 시장 현황
- AI/ML 직군 채용 비율 급증 — 투자 확보 기업의 34%가 AI 인력 모집 (코드트리 2026 채용 트렌드)
- AI 에이전트 개발자 수요 폭발 — 단순 LLM 호출을 넘어 자율 에이전트 설계 역량 필수
- 대기업: 모델 연구자 < AI 응용 엔지니어 채용 비중 역전 (LLM 활용 비즈니스 문제 해결 중심)
- RAG + LangChain 경험이 거의 모든 AI 공고에서 필수 요구
- MLOps + LLMOps 역량 있는 엔지니어 수요 급증
- 수학(선형대수·확률·통계) 기초 없이는 면접 통과 어려움

■ 세부 직무 분리 (지원 전 명확히)
- AI 에이전트 개발자: LLM 기반 자율 에이전트 설계·구현 (2026 최고 수요)
- ML 엔지니어: 모델 학습·배포·최적화 (연구+엔지니어링 혼합)
- MLOps/LLMOps 엔지니어: ML/LLM 파이프라인 자동화, 모델 서빙·모니터링 인프라
- AI 응용 개발자: LLM API 활용, RAG 시스템 구축, AI 서비스 개발
- 연구자(Researcher): 논문 구현, 신규 모델 개발 (대학원 경력 유리)

■ 단계별 학습 순서 (취업 지향 실용 로드맵)
1단계: Python 기초 + NumPy/Pandas + 수학 기초(선형대수·미적분·확률)
2단계: ML 기초 (scikit-learn — 회귀·분류·클러스터링 직접 구현)
3단계: 딥러닝 기초 (신경망 구조, 역전파, PyTorch 기초)
4단계: 주요 아키텍처 (CNN, RNN, Transformer 논문 구현)
5단계: NLP 심화 (BERT, GPT, 허깅페이스 Transformers 활용)
6단계: LLM 파인튜닝 (LoRA/QLoRA, PEFT — 효율적 미세 조정 기법 실무화)
7단계: RAG 아키텍처 설계 (검색 파이프라인·리랭킹·Fact-Checking 모듈)
8단계: AI 에이전트 개발 (LangChain/LangGraph, Tool Use, Multi-Agent 시스템)
9단계: MLOps/LLMOps (MLflow/Wandb 실험 추적, 모델 서빙, 프롬프트 버전 관리)
10단계: Kaggle 대회 참가 + AI 에이전트 사이드 프로젝트 포트폴리오

■ 2026 필수 기술 스택 (한국 채용 JD 분석)
- Python (필수), PyTorch (주류 확립, TensorFlow 채용 급감)
- 허깅페이스 Transformers, PEFT (LoRA/QLoRA 미세 조정)
- LangChain / LangGraph (AI 에이전트 프레임워크 — 2026 거의 필수)
- LlamaIndex (RAG 특화 프레임워크)
- OpenAI API, Anthropic Claude API (AI 서비스 개발)
- Vector DB: Pinecone, Weaviate, pgvector, Chroma (RAG 구현)
- MLflow / W&B (Wandb) — 실험 추적·모델 레지스트리 (MLOps)
- Docker + FastAPI + AWS SageMaker or Lambda (모델 서빙)
- LLM 관찰성: LangSmith, Langfuse (프롬프트·에이전트 트레이싱 시스템)
- Structured Output: OpenAI/Claude Tool Use, JSON Mode — 에이전트 개발 필수

■ 자격증 (AI/ML 특화)
- 자격증보다 Kaggle 입상·논문·GitHub·RAG 구현 경험이 훨씬 중요
- AICE (KT·한국경제신문 주관, 연 6회, 국내 AI 자격증)
- 빅데이터분석기사 (데이터 기반 역량 증명)
- ADsP/ADP — 데이터 분석 역량 증명
- TensorFlow Developer Certificate — 구글 공인, 딥러닝 기초 증명
- AWS Machine Learning Specialty — MLOps 클라우드 경험 증명
- 정보처리기사 — 대기업 공채 지원 시 기본 스펙

■ Kaggle 활용 전략 (포트폴리오 핵심)
- Titanic (입문) → House Prices (회귀) → NLP 대회 → LLM 대회 순 권장
- Gold/Silver 메달 1개 이상이면 서류에서 확실한 차별화
- Notebook 공개 후 Upvote 쌓으면 커뮤니티 기여도 증명

■ 회사 유형별 포커스
- AI 스타트업: LLM 에이전트 개발 능력, RAG 설계, 빠른 프로토타이핑
- 대기업 AI 팀: PyTorch 모델 개발, 논문 구현, MLOps/LLMOps 파이프라인, 에이전트 Tracing 시스템
- 플랫폼 기업(네이버/카카오): 추천 시스템, 검색 AI, 실시간 서빙 최적화, AI 에이전트 서비스
- 제조/금융 도메인: 이상 탐지, 예측 모델, 설명 가능한 AI(XAI), RAG 기반 문서 QA
- 법률/의료 도메인: RAG 고도화 + Fact-Checking 모듈 + 도메인 특화 파인튜닝

■ 포트폴리오 핵심 포인트
- 문제 정의 → 데이터 수집 → 모델링 → 배포까지 전 과정 포함
- GitHub에 Jupyter Notebook + 설명 문서 + 성능 비교 표
- 실제 서비스에 배포한 AI 기능 (API 형태) 경험 차별화
- AI 에이전트 프로젝트 (Tool Use + Multi-Step 추론) — 2026 핵심 차별화
- RAG 파이프라인 구현 + 정확도 개선 과정 문서화
- 논문 1~2편 구현 경험 (arXiv 논문 코드 재현)

■ 기술 면접 핵심 주제
- Transformer Attention 메커니즘 직접 설명
- 과적합 방지 방법 (Dropout, L1/L2, Batch Normalization)
- RAG vs Fine-tuning 선택 기준, Hybrid RAG 아키텍처
- LoRA/QLoRA 파인튜닝 원리와 적용 시나리오
- AI 에이전트 아키텍처: ReAct, Plan-and-Execute, Multi-Agent
- LLM 평가 지표: Hallucination 탐지, BLEU/ROUGE, 인간 평가 vs 자동 평가
- 모델 경량화 기법 (Quantization, Pruning, Distillation)
- 추천 시스템 설계 (Content-Based vs Collaborative Filtering)
"""
