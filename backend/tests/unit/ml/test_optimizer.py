# backend/tests/unit/ml/test_optimizer.py
# Design Ref: §2.5 — prompt_optimizer Feature Engineering 단위 테스트
# Plan SC: ML 단위 테스트 PASS (TR-10)
import pytest
from app.ml.pipeline.prompt_optimizer import build_optimized_context

pytestmark = pytest.mark.unit


class TestBuildOptimizedContext:
    def test_level_normalization_beginner(self):
        ctx = build_optimized_context("backend", "6months", "beginner", [], [], "any")
        assert ctx["level"] == "입문자 (0~1년)"

    def test_level_normalization_basic(self):
        ctx = build_optimized_context("backend", "6months", "basic", [], [], "any")
        assert ctx["level"] == "초급자 (1~2년)"

    def test_level_normalization_some_exp(self):
        ctx = build_optimized_context("backend", "6months", "some_exp", [], [], "any")
        assert ctx["level"] == "중급자 (2~4년)"

    def test_level_normalization_experienced(self):
        ctx = build_optimized_context("backend", "6months", "experienced", [], [], "any")
        assert ctx["level"] == "시니어 (4년+)"

    def test_unknown_level_passthrough(self):
        """정의되지 않은 레벨은 그대로 반환."""
        ctx = build_optimized_context("backend", "6months", "expert", [], [], "any")
        assert ctx["level"] == "expert"

    def test_period_normalization_3months(self):
        ctx = build_optimized_context("backend", "3months", "basic", [], [], "any")
        assert ctx["period"] == "3개월"

    def test_period_normalization_6months(self):
        ctx = build_optimized_context("backend", "6months", "basic", [], [], "any")
        assert ctx["period"] == "6개월"

    def test_period_normalization_1year(self):
        ctx = build_optimized_context("backend", "1year", "basic", [], [], "any")
        assert ctx["period"] == "1년"

    def test_skills_context_empty(self):
        ctx = build_optimized_context("backend", "6months", "basic", [], [], "any")
        assert "기초부터 학습 필요" in ctx["skills_context"]

    def test_skills_context_single(self):
        ctx = build_optimized_context("backend", "6months", "basic", ["Python"], [], "any")
        assert "Python" in ctx["skills_context"]
        assert "보유 스킬" in ctx["skills_context"]

    def test_skills_context_multiple(self):
        ctx = build_optimized_context("backend", "6months", "basic", ["Python", "Django", "FastAPI"], [], "any")
        assert "Python" in ctx["skills_context"]
        assert "Django" in ctx["skills_context"]
        assert "FastAPI" in ctx["skills_context"]

    def test_cert_context_empty(self):
        ctx = build_optimized_context("backend", "6months", "basic", [], [], "any")
        assert ctx["cert_context"] == ""

    def test_cert_context_filled(self):
        ctx = build_optimized_context("backend", "6months", "basic", [], ["정보처리기사", "AWS-SAA"], "any")
        assert "정보처리기사" in ctx["cert_context"]
        assert "AWS-SAA" in ctx["cert_context"]

    def test_company_hint_startup(self):
        ctx = build_optimized_context("backend", "6months", "basic", [], [], "startup")
        assert "스타트업" in ctx["company_hint"]

    def test_company_hint_enterprise(self):
        ctx = build_optimized_context("backend", "6months", "basic", [], [], "enterprise")
        assert "대기업" in ctx["company_hint"]

    def test_company_hint_any_empty(self):
        ctx = build_optimized_context("backend", "6months", "basic", [], [], "any")
        assert ctx["company_hint"] == ""

    def test_role_passthrough(self):
        ctx = build_optimized_context("프론트엔드 개발자", "6months", "basic", [], [], "any")
        assert ctx["role"] == "프론트엔드 개발자"

    def test_return_keys_complete(self):
        """반환 dict에 필수 키 모두 존재."""
        ctx = build_optimized_context("backend", "6months", "basic", [], [], "any")
        required_keys = {"role", "period", "level", "skills_context", "cert_context", "company_hint"}
        assert required_keys.issubset(ctx.keys())
