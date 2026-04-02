# ML Agent — 로드맵 품질 평가 추론 모듈
# Developer Agent의 claude_service.py와 연동되는 추론 API
# ML Agent가 학습·최적화하며, Developer는 이 인터페이스만 호출한다.

import time
from typing import Any


async def evaluate_roadmap_quality(roadmap: dict[str, Any]) -> dict[str, float]:
    """
    생성된 로드맵의 품질을 평가한다.
    ML Agent 담당 — Developer는 이 함수의 내부 구현을 수정하지 않는다.

    Returns:
        {
            "quality_score": float,       # 0~100
            "hallucination_rate": float,  # 0~100 (낮을수록 좋음)
            "consistency_score": float,   # 0~100
        }
    """
    # TODO: ML Agent가 실제 평가 모델로 교체
    # 현재는 규칙 기반 휴리스틱 (Phase 1 MVP)
    start = time.time()

    score = _heuristic_quality_check(roadmap)

    elapsed = time.time() - start
    return {
        "quality_score": score,
        "hallucination_rate": max(0.0, 10.0 - score * 0.1),
        "consistency_score": score * 0.95,
        "eval_time_sec": elapsed,
    }


def _heuristic_quality_check(roadmap: dict[str, Any]) -> float:
    """규칙 기반 품질 체크 (ML 모델 도입 전 MVP)"""
    score = 100.0

    # 필수 필드 존재 여부
    required_keys = ["role", "period", "level", "months"]
    for key in required_keys:
        if key not in roadmap:
            score -= 15.0

    # 월별 항목 최소 개수
    months = roadmap.get("months", [])
    if len(months) == 0:
        score -= 30.0
    elif len(months) < 3:
        score -= 10.0

    return max(0.0, score)
