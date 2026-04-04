import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from scripts.aggregator import compute_scores, classify_priority


def test_compute_scores_weights():
    sources = [
        {"source": "worknet",   "keyword_counts": {"React": 50, "Vue": 10}},
        {"source": "tech_blog", "keyword_counts": {"React": 30}},
        {"source": "npm_pypi",  "keyword_counts": {"React": 0.9}},
        {"source": "so_survey", "keyword_counts": {"React": 0.74}},
    ]
    scores = compute_scores(sources)
    assert "React" in scores
    assert scores["React"] > scores.get("Vue", 0)


def test_classify_priority():
    assert classify_priority(0.7) == 1
    assert classify_priority(0.4) == 2
    assert classify_priority(0.2) == 3
    assert classify_priority(0.0) == 3
