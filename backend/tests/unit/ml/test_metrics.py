# backend/tests/unit/ml/test_metrics.py
# Design Ref: §2.5 — ML 타겟 지표 단위 테스트
# Plan SC: ML 단위 테스트 PASS (TR-08)
import pytest
from app.ml.evaluation.metrics import (
    MLTargetMetrics,
    MLEvaluationResult,
    evaluate_against_targets,
)


class TestMLTargetMetrics:
    def test_default_values(self):
        m = MLTargetMetrics()
        assert m.roadmap_quality_score == 85.0
        assert m.hallucination_rate_max == 5.0
        assert m.response_time_max_sec == 3.0
        assert m.consistency_score == 80.0


class TestEvaluateAgainstTargets:
    def _make_result(self, quality, hallucination, response_time, consistency):
        return MLEvaluationResult(
            passed=False,
            roadmap_quality_score=quality,
            hallucination_rate=hallucination,
            avg_response_time_sec=response_time,
            consistency_score=consistency,
            iteration_count=1,
        )

    def test_all_pass(self):
        result = self._make_result(90.0, 3.0, 2.0, 85.0)
        assert evaluate_against_targets(result, MLTargetMetrics()) is True

    def test_quality_fail(self):
        result = self._make_result(80.0, 3.0, 2.0, 85.0)
        assert evaluate_against_targets(result, MLTargetMetrics()) is False

    def test_hallucination_fail(self):
        result = self._make_result(90.0, 6.0, 2.0, 85.0)
        assert evaluate_against_targets(result, MLTargetMetrics()) is False

    def test_response_time_fail(self):
        result = self._make_result(90.0, 3.0, 4.0, 85.0)
        assert evaluate_against_targets(result, MLTargetMetrics()) is False

    def test_consistency_fail(self):
        result = self._make_result(90.0, 3.0, 2.0, 75.0)
        assert evaluate_against_targets(result, MLTargetMetrics()) is False

    def test_boundary_exact_pass(self):
        """경계값 — 정확히 목표치 달성 시 PASS."""
        result = self._make_result(85.0, 5.0, 3.0, 80.0)
        assert evaluate_against_targets(result, MLTargetMetrics()) is True

    def test_custom_targets(self):
        """커스텀 타겟 지표 적용."""
        strict = MLTargetMetrics(
            roadmap_quality_score=95.0,
            hallucination_rate_max=2.0,
            response_time_max_sec=1.0,
            consistency_score=90.0,
        )
        result = self._make_result(90.0, 3.0, 2.0, 85.0)
        assert evaluate_against_targets(result, strict) is False


class TestMLEvaluationResultSummary:
    def test_summary_pass_format(self):
        result = MLEvaluationResult(
            passed=True,
            roadmap_quality_score=90.0,
            hallucination_rate=3.0,
            avg_response_time_sec=1.5,
            consistency_score=88.0,
            iteration_count=1,
        )
        summary = result.summary()
        assert "PASS" in summary
        assert "90.0%" in summary
        assert "3.0%" in summary
        assert "1/3" in summary

    def test_summary_fail_format(self):
        result = MLEvaluationResult(
            passed=False,
            roadmap_quality_score=70.0,
            hallucination_rate=8.0,
            avg_response_time_sec=4.0,
            consistency_score=65.0,
            iteration_count=3,
        )
        summary = result.summary()
        assert "FAIL" in summary
        assert "3/3" in summary
