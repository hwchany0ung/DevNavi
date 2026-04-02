# backend/tests/unit/ml/test_evaluator.py
# Design Ref: §2.5 — roadmap_evaluator 휴리스틱 품질 체크 단위 테스트
# Plan SC: ML 단위 테스트 PASS (TR-09)
import pytest
from app.ml.inference.roadmap_evaluator import _heuristic_quality_check, evaluate_roadmap_quality

pytestmark = pytest.mark.unit


class TestHeuristicQualityCheck:
    def test_perfect_roadmap(self):
        """필수 키 모두 + 3개 이상 월 → 100점."""
        roadmap = {
            "role": "백엔드 개발자",
            "period": "6months",
            "level": "beginner",
            "months": [{"month": 1}, {"month": 2}, {"month": 3}],
        }
        assert _heuristic_quality_check(roadmap) == 100.0

    def test_missing_one_required_key(self):
        """필수 키 1개 누락 → -15."""
        roadmap = {"role": "백엔드", "period": "6months", "months": [1, 2, 3]}
        assert _heuristic_quality_check(roadmap) == 85.0

    def test_missing_two_required_keys(self):
        """필수 키 2개 누락 → -30."""
        roadmap = {"role": "백엔드", "months": [1, 2, 3]}
        assert _heuristic_quality_check(roadmap) == 70.0

    def test_empty_months(self):
        """months 빈 리스트 → -30."""
        roadmap = {"role": "x", "period": "x", "level": "x", "months": []}
        assert _heuristic_quality_check(roadmap) == 70.0

    def test_few_months_less_than_3(self):
        """months 1~2개 → -10."""
        roadmap = {"role": "x", "period": "x", "level": "x", "months": [1, 2]}
        assert _heuristic_quality_check(roadmap) == 90.0

    def test_empty_roadmap_minimum_score(self):
        """모든 필수 키 누락(×4 → -60) + months 없음(-30) = 10.0."""
        assert _heuristic_quality_check({}) == 10.0

    def test_missing_months_key_entirely(self):
        """months 키 자체가 없음 → 빈 리스트와 동일 처리."""
        roadmap = {"role": "x", "period": "x", "level": "x"}
        # months 키 누락(-15) + months 없음(-30) = 55
        assert _heuristic_quality_check(roadmap) == 55.0


@pytest.mark.asyncio
async def test_evaluate_roadmap_quality_returns_dict():
    """evaluate_roadmap_quality가 필수 키를 포함한 dict 반환."""
    roadmap = {
        "role": "프론트엔드",
        "period": "3months",
        "level": "basic",
        "months": [1, 2, 3],
    }
    result = await evaluate_roadmap_quality(roadmap)
    assert "quality_score" in result
    assert "hallucination_rate" in result
    assert "consistency_score" in result
    assert "eval_time_sec" in result
    assert 0.0 <= result["quality_score"] <= 100.0
