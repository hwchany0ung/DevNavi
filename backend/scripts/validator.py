"""Claude API로 기술 점수 교차검증 + role_references 텍스트 생성."""
import json
import anthropic
from scripts.config import ANTHROPIC_API_KEY
from scripts.aggregator import build_priority_map

_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

_SYSTEM = """당신은 한국 IT 취업 시장 전문가입니다.
제공된 기술 점수 데이터를 검토하여 한국 취업 현실과 맞지 않는 이상값을 제거하고,
role_references 텍스트를 아래 형식으로 생성하세요.

출력 형식 (텍스트만, JSON 아님):
[{직군명} -- {연도} 한국 취업 실무 참조]

■ 2026 채용 공고 필수 기술 (한국)
- priority 1 (필수): {기술 목록}
- priority 2 (권장): {기술 목록}
- priority 3 (추천): {기술 목록}

■ 회사 유형별 기술 포커스
...

■ 포트폴리오 핵심 포인트
...

■ 기술 면접 핵심 주제
..."""


def generate_reference(role: str, priority_map: dict, existing_content: str) -> str:
    """priority_map + 기존 내용을 Claude에 전달하여 최신 role_references 생성.

    Args:
        role: 직군 키
        priority_map: {1: ["React", ...], 2: [...], 3: [...]}
        existing_content: 현재 활성화된 role_references 텍스트 (컨텍스트용)

    Returns:
        새로운 REFERENCE 텍스트
    """
    user_msg = f"""직군: {role}

[수집 데이터 기반 기술 우선순위]
Priority 1 (필수): {', '.join(priority_map.get(1, []))}
Priority 2 (권장): {', '.join(priority_map.get(2, []))}
Priority 3 (추천): {', '.join(priority_map.get(3, []))}

[기존 참조 데이터 (컨텍스트)]
{existing_content[:2000]}

위 우선순위를 기반으로 role_references 텍스트를 생성하세요.
한국 취업 현실과 동떨어진 기술은 제거하고, 누락된 핵심 기술은 기존 내용에서 보완하세요."""

    msg = _client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    return msg.content[0].text.strip()
