"""4개 소스 결과를 가중치로 합산하여 기술별 종합 점수 산출."""

WEIGHTS = {
    "worknet":   0.40,
    "tech_blog": 0.30,
    "npm_pypi":  0.20,
    "so_survey": 0.10,
}


def _normalize(counts: dict[str, float]) -> dict[str, float]:
    """최대값 기준으로 0~1 정규화."""
    if not counts:
        return {}
    max_v = max(counts.values())
    if max_v == 0:
        return {}
    return {k: v / max_v for k, v in counts.items()}


def compute_scores(sources: list[dict]) -> dict[str, float]:
    """소스 리스트 -> 기술별 가중 합산 점수.

    Args:
        sources: [{"source": "worknet", "keyword_counts": {...}}, ...]

    Returns:
        {"React": 0.72, "Vue": 0.31, ...}
    """
    aggregated: dict[str, float] = {}
    for src in sources:
        weight = WEIGHTS.get(src["source"], 0.0)
        normalized = _normalize(src.get("keyword_counts", {}))
        for tech, score in normalized.items():
            aggregated[tech] = aggregated.get(tech, 0.0) + score * weight
    # 전체 기준 재정규화 (0~1 범위 유지)
    if aggregated:
        max_v = max(aggregated.values())
        if max_v > 0:
            aggregated = {k: round(v / max_v, 4) for k, v in aggregated.items()}
    return dict(sorted(aggregated.items(), key=lambda x: x[1], reverse=True))


def classify_priority(score: float) -> int:
    if score >= 0.6:
        return 1
    if score >= 0.3:
        return 2
    return 3


def build_priority_map(scores: dict[str, float]) -> dict[int, list[str]]:
    """점수 -> priority별 기술 목록."""
    result: dict[int, list[str]] = {1: [], 2: [], 3: []}
    for tech, score in scores.items():
        result[classify_priority(score)].append(tech)
    return result
