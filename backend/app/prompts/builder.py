from .constants import ROLE_MAP, PERIOD_MAP, LEVEL_MAP, COMPANY_MAP, TASKS_PER_WEEK
from .role_references import get_reference

TEASER_SYSTEM = """당신은 IT 취업 전문 커리어 코치입니다.
아래 [직군 참조 데이터]를 바탕으로 사용자에게 맞는 학습 로드맵 뼈대(티저)를 생성하세요.

규칙:
- 응답은 반드시 한국어로 작성
- 월별 핵심 주제만 나열 (세부 태스크 제외)
- 각 월은 반드시 "## {n}월차: {테마}" 형식으로 작성
- 한국 취업 시장 기준 현실적인 일정으로 작성
- 마지막 줄에 한 줄 동기부여 문장 추가
- 전체 600자 이내"""

FULL_SYSTEM = """당신은 IT 취업 전문 커리어 코치입니다.
아래 [직군 참조 데이터]와 [사용자 정보]를 결합해 상세한 월별 학습 로드맵을 JSON으로 생성하세요.
참조 데이터의 학습 순서·자격증·회사별 포커스·포트폴리오 포인트를 적극 반영하세요.

출력 형식 (JSON만 출력, 코드블록 없이):
{
  "summary": "한 줄 요약 (50자 이내)",
  "persona_title": "MBTI 스타일 개발자 유형명 (예: 성장 욕구 뿜뿜하는 예비 백엔드 장인)",
  "persona_subtitle": "유형 설명 한 줄 (30자 이내)",
  "months": [
    {
      "month": 1,
      "theme": "월차 테마 (20자 이내)",
      "weeks": [
        {
          "week": 1,
          "tasks": [
            { "content": "태스크 내용 (40자 이내)", "category": "learn" }
          ]
        }
      ]
    }
  ]
}

category 값: "learn"(학습) | "project"(실습/프로젝트) | "cert"(자격증)

필수 규칙:
- 보유 스킬은 건너뛰고 부족한 부분에 집중
- 목표 회사 유형별 특화 기술 반영 (참조 데이터의 회사 유형별 포커스 참고)
- 하루 학습 시간 비례 주당 태스크 수 준수
- 한국 시장 자격증 취득 일정을 적절한 월차에 배치
- 마지막 달은 반드시 포트폴리오 완성 + 취업 지원 실행
- 참조 데이터의 포트폴리오 핵심 포인트를 project 태스크에 반영"""

CAREER_SUMMARY_SYSTEM = """당신은 한국 IT 취업 시장 전문 커리어 코치입니다. (2024-2025 채용공고 기반 실전 데이터 보유)
사용자 정보를 분석해 커리어 로드맵 시작 전 핵심 분석 결과를 JSON으로 반환하세요.

출력 형식 (JSON만 출력, 코드블록 없이):
{
  "skills_to_learn": [
    {"name": "스킬명", "priority": 1, "reason": "채용 현실 기반 한 줄 이유 (30자 이내)"}
  ],
  "certs_to_get": [
    {"name": "자격증명", "priority": 1, "why": "취업에 미치는 실질적 영향 (30자 이내)"}
  ],
  "appeal_points": [
    "회사 지원 시 구체적 어필 포인트 (40자 이내, 포트폴리오·경험·수치 포함)"
  ],
  "career_message": "한 줄 응원 메시지, 목표 기간·직군·회사 유형 언급 (40자 이내)"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[우선순위 기준 — 2024-2025 한국 채용공고 실데이터]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
priority 1 (필수): 신입 공채·서류 단계에서 실제로 요구/우대 명시된 항목
priority 2 (권장): 보유 시 서류·면접에서 명확한 이점, 합격률 향상
priority 3 (추천): 차별화·심화용, 경쟁자 대비 포지셔닝에 유리

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[직군별 자격증 실전 가이드]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ 백엔드/풀스택
  - priority 1: 정보처리기사 (채용공고 68% 우대 명시, 서류 컷 통과 핵심)
  - priority 2: SQLD (DB 설계 역량 증명, 대기업·SI 선호)
  - priority 3: AWS Cloud Practitioner (클라우드 기초 이해 증명)
  → AWS SAA는 백엔드에서 priority 3 이하. 클라우드/DevOps 직군 전용 필수 자격증.

◆ 프론트엔드
  - priority 2: 정보처리기사 (대기업·공공기관 우대, 포트폴리오가 훨씬 중요)
  - priority 3: AWS Cloud Practitioner (배포 이해 증명용)
  → 프론트엔드는 자격증보다 실배포 포트폴리오·GitHub이 압도적으로 중요.
  → 별도 필수 자격증 없음. certs_to_get에 억지로 넣지 말 것.

◆ 클라우드/DevOps
  - priority 1: AWS SAA (국내 MSP·클라우드 채용 표준 진입 자격)
  - priority 1: CKA (Kubernetes 운영 능력 증명, 2024년 필수화)
  - priority 2: 리눅스마스터 2급 (MSP·공공기관 우대)
  - priority 2: 정보처리기사 (MSP·공공기관 필수)
  - priority 3: Terraform Associate, AWS DevOps Engineer Pro

◆ 데이터 엔지니어/분석가
  - priority 1: SQLD (SQL Developer — 데이터 분야 기본기 증명, 거의 필수)
  - priority 2: 빅데이터분석기사 (2024년 채용공고 급증, 실기 포함 신뢰도 높음)
  - priority 2: ADsP (공공기관·금융 가산점, 실기 없어 취득 용이)
  - priority 3: ADP (합격률 10%, 경력자 차별화)

◆ AI/ML 엔지니어
  - priority 2: AICE (KT·한국경제신문 주관, 연 6회, 국내 AI 자격증)
  - priority 2: 빅데이터분석기사 (데이터 기반 역량 증명)
  - priority 3: TensorFlow Developer Certificate (Google)
  → AI/ML은 자격증보다 Kaggle 입상·논문·GitHub·RAG 구현 경험이 훨씬 중요.

◆ 보안 엔지니어
  - priority 1: 정보보안기사 (국가공인, 보안 분야 사실상 기본 자격)
  - priority 1: 정보처리기사 (IT 기초 역량, 공공·금융 필수)
  - priority 2: ISMS-P 인증심사원 (금융·공공 채용 강력 우대)
  - priority 3: CISSP (경력 5년 필요, 국제 최고권위 — 시니어용)

◆ iOS/Android 모바일
  - priority 2: 정보처리기사 (대기업·공공 지원 시)
  - priority 3: AWS Cloud Practitioner (앱 백엔드 이해)
  → 모바일은 앱스토어/플레이스토어 출시 앱이 자격증보다 압도적 중요.
  → certs_to_get을 최소화하고 포트폴리오 어필에 집중할 것.

◆ QA 엔지니어
  - priority 1: ISTQB CTFL (2025년부터 경력 요건 폐지, 신입 채용 필수 조건화)
  - priority 2: 정보처리기사 (대기업·SI QA 우대)
  - priority 3: ISTQB CTAL (경력 QA 차별화)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[회사 유형별 어필 포인트 템플릿]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
스타트업: 1인 설계-구현-배포 경험 / MVP 빠른 개발 / GitHub 잔디 / 실배포 URL
대기업(bigco): 정보처리기사 보유 / 알고리즘 코딩테스트 / CS 기초 이론 / 대용량 처리 이해
MSP: AWS 공인자격증 / 마이그레이션 경험 / 문서화 / 고객사 커뮤니케이션
SI: 정보처리기사 필수 / Java+Spring / 전자정부프레임워크 / 요구사항 문서화
외국계(foreign): 영어 소통 / LeetCode/HackerRank / 오픈소스 기여 / 글로벌 기술 스택

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[규칙]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- skills_to_learn: 보유 스킬 제외, 4~6개 (priority 1부터 채울 것)
- certs_to_get: 보유 자격증 제외, 2~4개 (직군 현실에 맞는 것만)
- appeal_points: 목표 회사 유형에 맞는 구체적 포인트 3~4개
- 포트폴리오 수치 제시 형태 권장 (예: "응답시간 xx% 개선 사례 포함")
- JSON 외 텍스트 출력 금지"""


REROUTE_SYSTEM = """당신은 IT 취업 커리어 코치입니다.
[직군 참조 데이터]를 참고해 학습자의 현재 진행 상황에 맞게 남은 로드맵을 재조정하세요.

규칙:
- 완료된 항목은 제외하고 중복 없이 구성
- 잔여 기간에 맞게 주당 태스크 수 재조정
- 핵심 태스크 우선 배치, 선택 항목 후순위
- 원래 목표 직군·회사 유형 유지
- 출력 형식: 심화 프롬프트와 동일한 JSON"""


def build_teaser_prompt(role: str, period: str, level: str) -> tuple[str, str]:
    """Returns (system, user) prompt tuple."""
    role_kr = ROLE_MAP.get(role, role)
    months = PERIOD_MAP.get(period, 6)
    level_kr = LEVEL_MAP.get(level, level)
    reference = get_reference(role)

    user = f"""[직군 참조 데이터]
{reference}

[사용자 정보]
목표 직군: {role_kr}
목표 기간: {months}개월
현재 수준: {level_kr}"""

    return TEASER_SYSTEM, user


def build_full_prompt(
    role: str,
    period: str,
    level: str,
    skills: list[str],
    certifications: list[str],
    company_type: str,
    daily_study_hours: str,
) -> tuple[str, str]:
    """Returns (system, user) prompt tuple."""
    role_kr = ROLE_MAP.get(role, role)
    months = PERIOD_MAP.get(period, 6)
    level_kr = LEVEL_MAP.get(level, level)
    company_kr = COMPANY_MAP.get(company_type, "무관")
    tasks_per_week = TASKS_PER_WEEK.get(daily_study_hours, 3)
    # build_full_prompt는 ≤6개월 단일 호출 전용
    # (7개월+ 로드맵은 stream_full_multicall → build_full_prompt_partial 경유)
    # 12개월·18개월 캡 분기는 이 함수에 도달하지 않으므로 제거
    reference = get_reference(role)

    skills_str = ", ".join(skills) if skills else "없음"
    certs_str = ", ".join(certifications) if certifications else "없음"

    content_len_hint = "40자 이내"  # ≤6개월은 토큰 여유가 충분

    user = f"""[직군 참조 데이터]
{reference}

[사용자 정보]
목표 직군: {role_kr}
목표 기간: {months}개월
현재 수준: {level_kr}
보유 스킬: {skills_str}
보유 자격증: {certs_str}
목표 회사 유형: {company_kr}
하루 학습 시간: {daily_study_hours} → 주당 태스크 {tasks_per_week}개 기준
태스크 content 길이: {content_len_hint} (엄수)"""

    return FULL_SYSTEM, user


def build_full_prompt_partial(
    role: str,
    level: str,
    skills: list[str],
    certifications: list[str],
    company_type: str,
    daily_study_hours: str,
    month_start: int,
    month_end: int,
    total_months: int,
) -> tuple[str, str]:
    """멀티콜용 — total_months 중 month_start~month_end 구간만 생성."""
    role_kr = ROLE_MAP.get(role, role)
    level_kr = LEVEL_MAP.get(level, level)
    company_kr = COMPANY_MAP.get(company_type, "무관")
    tasks_per_week = TASKS_PER_WEEK.get(daily_study_hours, 3)
    # 멀티콜은 전체 기간이 길수록 청크당 출력도 많아져 max_tokens 초과 위험
    # total_months 기준으로 캡 적용 (build_full_prompt와 동일 기준)
    if total_months >= 18:
        tasks_per_week = min(tasks_per_week, 3)
    elif total_months >= 12:
        tasks_per_week = min(tasks_per_week, 4)
    else:
        tasks_per_week = min(tasks_per_week, 5)
    content_len_hint = "20자 이내" if total_months >= 18 else "30자 이내"
    reference = get_reference(role)

    skills_str = ", ".join(skills) if skills else "없음"
    certs_str = ", ".join(certifications) if certifications else "없음"

    is_first_chunk = month_start == 1
    persona_instruction = (
        "summary·persona_title·persona_subtitle는 전체 로드맵 기준으로 작성하세요."
        if is_first_chunk else
        'summary·persona_title·persona_subtitle는 빈 문자열("")로 채우세요.'
    )

    user = f"""[직군 참조 데이터]
{reference}

[사용자 정보]
목표 직군: {role_kr}
전체 목표 기간: {total_months}개월 (이번 생성: {month_start}~{month_end}월차)
현재 수준: {level_kr}
보유 스킬: {skills_str}
보유 자격증: {certs_str}
목표 회사 유형: {company_kr}
하루 학습 시간: {daily_study_hours} → 주당 태스크 {tasks_per_week}개 기준
태스크 content 길이: {content_len_hint} (엄수)

[중요]
- months 배열에 {month_start}번부터 {month_end}번 월차만 생성 (총 {month_end - month_start + 1}개월)
- month 필드 값은 반드시 {month_start}부터 시작
- {persona_instruction}"""

    return FULL_SYSTEM, user


def build_career_summary_prompt(
    role: str,
    period: str,
    level: str,
    skills: list[str],
    certifications: list[str],
    company_type: str,
) -> tuple[str, str]:
    """커리어 분석 요약 프롬프트."""
    role_kr = ROLE_MAP.get(role, role)
    months = PERIOD_MAP.get(period, 6)
    level_kr = LEVEL_MAP.get(level, level)
    company_kr = COMPANY_MAP.get(company_type, "무관")
    reference = get_reference(role)

    skills_str = ", ".join(skills) if skills else "없음"
    certs_str = ", ".join(certifications) if certifications else "없음"

    user = f"""[직군 참조 데이터]
{reference}

[사용자 정보]
목표 직군: {role_kr}
목표 기간: {months}개월
현재 수준: {level_kr}
보유 스킬: {skills_str}
보유 자격증: {certs_str}
목표 회사 유형: {company_kr}"""

    return CAREER_SUMMARY_SYSTEM, user


def build_reroute_prompt(
    original_role: str,
    original_period: str,
    company_type: str,
    completion_rate: float,
    done_contents: list[str],
    weeks_left: int,
    daily_study_hours: str,
) -> tuple[str, str]:
    """Returns (system, user) prompt tuple."""
    role_kr = ROLE_MAP.get(original_role, original_role)
    company_kr = COMPANY_MAP.get(company_type, "무관")
    tasks_per_week = TASKS_PER_WEEK.get(daily_study_hours, 3)
    reference = get_reference(original_role)

    done_summary = "\n".join(f"- {c}" for c in done_contents[:15])

    user = f"""[직군 참조 데이터]
{reference}

[현재 상황]
완료율: {completion_rate:.1f}%
잔여 기간: {weeks_left}주
주당 태스크 기준: {tasks_per_week}개

[완료한 항목 (제외 필요)]
{done_summary}

[원래 목표]
직군: {role_kr}
목표 회사: {company_kr}"""

    return REROUTE_SYSTEM, user
