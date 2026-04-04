"""워크넷 채용정보 Open API -- 직군별 기술 키워드 빈도 수집.

API 문서: https://www.work.go.kr/opi/openApiSuggestGetWantedInfo.do
키 발급: https://www.data.go.kr (고용노동부 워크넷 채용정보)
"""
import re
from collections import Counter
import httpx
from scripts.config import WORKNET_API_KEY

# 직군 -> 워크넷 검색 키워드 매핑
ROLE_KEYWORD_MAP: dict[str, list[str]] = {
    "backend":     ["백엔드", "서버개발", "Java", "Spring", "Python", "FastAPI", "Node.js"],
    "frontend":    ["프론트엔드", "React", "Vue", "Next.js", "TypeScript", "UI개발"],
    "cloud_devops":["DevOps", "클라우드", "AWS", "Kubernetes", "인프라", "SRE"],
    "fullstack":   ["풀스택", "fullstack", "full-stack"],
    "data":        ["데이터엔지니어", "데이터분석", "Spark", "Airflow", "데이터파이프라인"],
    "ai_ml":       ["AI엔지니어", "ML엔지니어", "LLM", "머신러닝", "딥러닝", "RAG"],
    "security":    ["보안엔지니어", "정보보안", "취약점", "보안"],
    "ios_android": ["iOS", "Android", "Flutter", "모바일앱", "Swift", "Kotlin"],
    "qa":          ["QA엔지니어", "테스트엔지니어", "품질보증", "자동화테스트"],
}

BASE_URL = "https://www.work.go.kr/opi/opi/opia/wantedApi.do"


def _fetch_postings(keyword: str, count: int = 100) -> list[str]:
    """키워드로 채용공고를 가져와 직무내용 텍스트 리스트 반환."""
    if not WORKNET_API_KEY:
        return []
    params = {
        "authKey":  WORKNET_API_KEY,
        "callTp":   "L",
        "returnType": "JSON",
        "startPage": 1,
        "display":  min(count, 100),
        "searchKeyword": keyword,
    }
    try:
        r = httpx.get(BASE_URL, params=params, timeout=20)
        r.raise_for_status()
        data = r.json()
        jobs = data.get("wantedRoot", {}).get("wanted", [])
        return [j.get("wantedTitle", "") + " " + j.get("wantedInfo", "") for j in jobs]
    except Exception as e:
        print(f"  [worknet] {keyword} 수집 실패: {e}")
        return []


# 기술 키워드 후보 (공고 텍스트에서 매칭)
_TECH_TOKENS = [
    "Java", "Kotlin", "Python", "FastAPI", "Spring", "Spring Boot",
    "Node.js", "NestJS", "React", "Vue", "Next.js", "TypeScript",
    "JavaScript", "Docker", "Kubernetes", "AWS", "Redis", "MySQL",
    "PostgreSQL", "MongoDB", "Kafka", "gRPC", "GraphQL", "Terraform",
    "ArgoCD", "LangChain", "LangGraph", "PyTorch", "TensorFlow",
    "Git", "GitHub Actions", "JPA", "MyBatis", "Flutter", "Swift",
    "Android", "iOS", "ISTQB", "Playwright", "Selenium",
]


def _count_keywords(texts: list[str]) -> Counter:
    counter: Counter = Counter()
    combined = " ".join(texts).lower()
    for token in _TECH_TOKENS:
        cnt = len(re.findall(re.escape(token.lower()), combined))
        if cnt > 0:
            counter[token] = cnt
    return counter


def collect(role: str) -> dict:
    """role에 해당하는 채용공고 수집 후 기술 키워드 빈도 반환.

    Returns:
        {"role": role, "source": "worknet", "keyword_counts": {...}, "total_postings": N}
    """
    keywords = ROLE_KEYWORD_MAP.get(role, [role])
    all_texts: list[str] = []
    for kw in keywords[:3]:   # 상위 3개 키워드만 (API 호출 최소화)
        all_texts.extend(_fetch_postings(kw, count=50))

    counts = _count_keywords(all_texts)
    print(f"  [worknet] {role}: {len(all_texts)}건 수집, 키워드 {len(counts)}개")
    return {
        "role": role,
        "source": "worknet",
        "keyword_counts": dict(counts.most_common(30)),
        "total_postings": len(all_texts),
    }
