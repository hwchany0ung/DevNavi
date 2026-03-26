"""
데이터 엔지니어/분석가 로드맵 참조 데이터
출처: 코드잇 데이터분석가 2025, shcDE 데이터엔지니어링 로드맵, 인프런 데이터엔지니어, GeekNews 2024 DE 로드맵
"""

REFERENCE = """
[데이터 엔지니어/분석가 — 2025 한국 취업 실무 참조]

■ 직무 분리 이해 (지원 전 명확히 구분)
- 데이터 분석가: SQL + Python(Pandas) + 시각화 + 통계 → 비즈니스 인사이트 도출
- 데이터 엔지니어: 파이프라인 설계 + ETL + Spark + 데이터 레이크하우스 구축
- 두 직무 모두 SQL과 Python이 공통 기반

■ 데이터 분석가 학습 순서 (2025 채용 기준)
1단계: SQL 핵심 (SELECT, JOIN, 서브쿼리, 윈도우 함수, GROUP BY)
2단계: Python 기초 + Pandas/NumPy 데이터 조작
3단계: 통계 기초 (평균/분산/가설검정/A-B테스트 개념)
4단계: 시각화 (Matplotlib/Seaborn, Tableau or Looker Studio)
5단계: 실무 분석 프로젝트 (공공데이터 or Kaggle 데이터)
6단계: BI 도구 (Tableau, Redash, Metabase) + Excel 고급
7단계: ML 기초 (회귀·분류 모델, scikit-learn) — 선택

■ 데이터 엔지니어 학습 순서 (신입 기준)
1단계: SQL 고급 + Python 핵심 (필수 공통)
2단계: 데이터베이스 심화 (PostgreSQL 설계, 인덱스, 파티셔닝)
3단계: 배치 처리 이해 + ETL 파이프라인 직접 구현
4단계: Apache Spark 기초 (PySpark) — 현업 표준 프레임워크
5단계: 오케스트레이션 (Apache Airflow DAG 작성)
6단계: 클라우드 데이터 스택 (AWS S3, Redshift, Glue / GCP BigQuery)
7단계: 데이터 레이크하우스 개념 (Delta Lake, Iceberg)
8단계: 실시간 처리 기초 (Kafka 개념 이해, Flink 선택)

■ 2025 채용 필수 기술 (데이터 엔지니어 JD 분석)
- SQL: 고급 쿼리 최적화 (실행계획 이해)
- Python: Pandas, PySpark, 데이터 파이프라인 스크립팅
- Airflow: DAG 설계·운영 (업계 표준 오케스트레이터)
- Spark: 대용량 데이터 처리
- 클라우드: AWS (S3, Glue, Redshift, EMR) or GCP (BigQuery)
- dbt: 데이터 변환 표준으로 급부상 — 2025 필수 기술로 정착

■ 자격증 우선순위 (취업 효용 순)
1. SQLD (SQL 능력 증명, 데이터 직군 기본 스펙)
2. 정보처리기사 (공기업·대기업 지원 필수)
3. ADsP (데이터분석 준전문가 — 분석가 지원 시 가산점)
4. AWS SAA or GCP Professional Data Engineer (데이터 엔지니어)
5. ADP (데이터분석 전문가 — 차별화용, 난이도 높음)

■ 자격증 취득 권장 순서
SQLD → 정보처리기사 필기 → 정보처리기사 실기 → ADsP → (ADP or AWS)

■ 회사 유형별 포커스
- 스타트업: Python + Airflow + AWS S3/Redshift + dbt, 빠른 분석 환경 구축
- 대기업: Hadoop/Spark 대규모 클러스터, 내부 데이터 플랫폼, 사내 BI 도구
- 컨설팅/분석 전문 회사: SQL 고급 + 시각화 + 비즈니스 스토리텔링
- 플랫폼 기업(카카오·네이버 등): Hive, Presto, 대규모 실시간 데이터 처리

■ 포트폴리오 핵심 포인트
- 데이터 수집 → 전처리 → 분석 → 시각화 전 과정 담은 프로젝트
- Airflow DAG 직접 작성한 파이프라인 GitHub 공개
- Kaggle 참여 이력 + 분석 인사이트 도출 노트북
- 분석 결과를 비즈니스 의사결정에 연결한 설명 능력

■ 기술 면접 핵심 주제
- SQL 윈도우 함수 (RANK, LAG, LEAD, ROW_NUMBER 활용)
- 배치 처리 vs 스트리밍 처리 차이
- 데이터 파이프라인 장애 대응 전략
- Spark 동작 원리 (RDD, DataFrame, Lazy Evaluation)
- 데이터 레이크 vs 데이터 웨어하우스 vs 레이크하우스 차이
"""
