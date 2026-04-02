# ML Agent — 프롬프트 최적화 파이프라인
# claude_service.py에서 사용하는 프롬프트를 ML 관점에서 관리한다.
# Feature Engineering: 사용자 입력 → 최적화된 컨텍스트 변환

from typing import Any


def build_optimized_context(
    role: str,
    period: str,
    level: str,
    skills: list[str],
    certifications: list[str],
    company_type: str,
) -> dict[str, Any]:
    """
    ML Agent가 관리하는 프롬프트 컨텍스트 빌더.
    Developer는 이 함수의 출력을 claude_service.py에 전달한다.
    ML Agent 담당 — 프롬프트 엔지니어링·Feature Engineering 전담.
    """
    # 레벨 정규화
    level_map = {
        "beginner": "입문자 (0~1년)",
        "basic": "초급자 (1~2년)",
        "some_exp": "중급자 (2~4년)",
        "experienced": "시니어 (4년+)",
    }
    normalized_level = level_map.get(level, level)

    # 기간 정규화
    period_map = {
        "3months": "3개월",
        "6months": "6개월",
        "1year": "1년",
    }
    normalized_period = period_map.get(period, period)

    return {
        "role": role,
        "period": normalized_period,
        "level": normalized_level,
        "skills_context": _build_skills_context(skills),
        "cert_context": _build_cert_context(certifications),
        "company_hint": _build_company_hint(company_type),
    }


def _build_skills_context(skills: list[str]) -> str:
    if not skills:
        return "보유 스킬 없음 (기초부터 학습 필요)"
    return f"보유 스킬: {', '.join(skills)}"


def _build_cert_context(certifications: list[str]) -> str:
    if not certifications:
        return ""
    return f"보유 자격증: {', '.join(certifications)}"


def _build_company_hint(company_type: str) -> str:
    hints = {
        "startup": "스타트업 환경 — 빠른 실행력과 풀스택 역량 강조",
        "enterprise": "대기업 환경 — 안정적 기술 스택과 깊은 전문성 강조",
        "any": "",
    }
    return hints.get(company_type, "")
