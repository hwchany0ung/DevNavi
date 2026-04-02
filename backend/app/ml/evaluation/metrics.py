# ML Agent — 모델 성능 지표 평가
# QA 에이전트가 이 모듈을 통해 ML 타겟 지표 달성 여부를 판단한다.
# 타겟 지표 미달 시 ML Agent에게 재학습 지시 (최대 3회)

from dataclasses import dataclass
from typing import Optional


@dataclass
class MLTargetMetrics:
    """PM이 기획서에 명시한 ML 타겟 지표"""
    roadmap_quality_score: float = 85.0   # 로드맵 품질 점수 목표 (%)
    hallucination_rate_max: float = 5.0   # 허용 Hallucination 비율 (%)
    response_time_max_sec: float = 3.0    # 최대 응답 시간 (초)
    consistency_score: float = 80.0       # 로드맵 일관성 점수 목표 (%)


@dataclass
class MLEvaluationResult:
    """QA 에이전트가 ML 검증 후 반환하는 결과"""
    passed: bool
    roadmap_quality_score: float
    hallucination_rate: float
    avg_response_time_sec: float
    consistency_score: float
    iteration_count: int
    details: Optional[str] = None

    def summary(self) -> str:
        status = "PASS" if self.passed else "FAIL"
        return (
            f"[ML QA {status}] "
            f"품질={self.roadmap_quality_score:.1f}% | "
            f"Hallucination={self.hallucination_rate:.1f}% | "
            f"응답={self.avg_response_time_sec:.2f}s | "
            f"일관성={self.consistency_score:.1f}% | "
            f"반복={self.iteration_count}/3"
        )


def evaluate_against_targets(
    result: MLEvaluationResult,
    targets: MLTargetMetrics,
) -> bool:
    """타겟 지표 달성 여부 판단 — QA 에이전트가 호출"""
    return (
        result.roadmap_quality_score >= targets.roadmap_quality_score
        and result.hallucination_rate <= targets.hallucination_rate_max
        and result.avg_response_time_sec <= targets.response_time_max_sec
        and result.consistency_score >= targets.consistency_score
    )
