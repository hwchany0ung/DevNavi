# backend/tests/conftest.py
# 공통 환경변수 설정만 담당 — fixtures는 unit/conftest.py, integration/conftest.py로 분리
import os

os.environ.setdefault("ENV", "test")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-32-chars-minimum!!")
os.environ.setdefault("CLOUDFRONT_SECRET", "test-cf-secret")
