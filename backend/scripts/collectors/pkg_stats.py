"""npm / PyPI 다운로드 통계 -- 실사용량 기반 트렌드 시그널."""
import httpx
from collections import defaultdict

# 직군별 핵심 패키지 목록
NPM_PACKAGES: dict[str, list[str]] = {
    "frontend":    ["react", "next", "typescript", "vite", "tailwindcss",
                    "zustand", "@tanstack/react-query", "vitest"],
    "fullstack":   ["next", "trpc", "prisma", "drizzle-orm", "bun"],
    "backend":     ["fastapi", "nestjs", "express", "hono"],
    "cloud_devops":["@aws-sdk/client-s3", "terraform-cdk"],
    "ai_ml":       ["langchain", "openai", "@anthropic-ai/sdk"],
    "qa":          ["playwright", "vitest", "jest", "cypress"],
}

PYPI_PACKAGES: dict[str, list[str]] = {
    "backend":    ["fastapi", "uvicorn", "sqlalchemy", "pydantic"],
    "data":       ["pandas", "polars", "apache-airflow", "pyspark", "dbt-core"],
    "ai_ml":      ["torch", "transformers", "langchain", "langchain-community",
                   "langgraph", "llama-index", "anthropic", "openai"],
    "cloud_devops":["boto3", "pulumi", "cdk-nag"],
    "security":   ["cryptography", "bandit", "semgrep"],
}


def _npm_downloads(pkg: str) -> int:
    try:
        r = httpx.get(
            f"https://api.npmjs.org/downloads/point/last-month/{pkg}",
            timeout=10,
        )
        if r.status_code == 200:
            return r.json().get("downloads", 0)
    except Exception:
        pass
    return 0


def _pypi_downloads(pkg: str) -> int:
    try:
        r = httpx.get(
            f"https://pypistats.org/api/packages/{pkg}/recent",
            timeout=10,
        )
        if r.status_code == 200:
            return r.json().get("data", {}).get("last_month", 0)
    except Exception:
        pass
    return 0


def collect(role: str) -> dict:
    """role의 핵심 패키지 다운로드 수 수집."""
    stats: dict[str, int] = {}

    for pkg in NPM_PACKAGES.get(role, []):
        dl = _npm_downloads(pkg)
        if dl > 0:
            stats[pkg] = dl
            print(f"  [pkg_stats] npm {pkg}: {dl:,}")

    for pkg in PYPI_PACKAGES.get(role, []):
        dl = _pypi_downloads(pkg)
        if dl > 0:
            stats[pkg] = dl
            print(f"  [pkg_stats] pypi {pkg}: {dl:,}")

    # 다운로드 수 -> 상대 점수 정규화 (최대값 기준)
    if stats:
        max_dl = max(stats.values())
        normalized = {k: round(v / max_dl, 4) for k, v in stats.items()}
    else:
        normalized = {}

    return {
        "role": role,
        "source": "npm_pypi",
        "keyword_counts": normalized,
        "raw_downloads": stats,
    }
