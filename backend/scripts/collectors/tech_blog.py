"""국내 대형 테크 기업 기술 블로그 RSS 수집."""
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
import feedparser

RSS_FEEDS = [
    ("kakao",     "https://tech.kakao.com/feed/"),
    ("naver_d2",  "https://d2.naver.com/d2.atom"),
    ("toss",      "https://toss.tech/rss.xml"),
    ("line",      "https://engineering.linecorp.com/ko/feed"),
    ("woowa",     "https://techblog.woowahan.com/feed/"),
    ("coupang",   "https://medium.com/feed/coupang-engineering"),
    ("daangn",    "https://medium.com/feed/daangn"),
]

_TECH_TOKENS = [
    "Java", "Kotlin", "Python", "FastAPI", "Spring", "Spring Boot",
    "Node.js", "NestJS", "React", "Vue", "Next.js", "TypeScript",
    "Docker", "Kubernetes", "AWS", "Redis", "MySQL", "PostgreSQL",
    "MongoDB", "Kafka", "gRPC", "GraphQL", "Terraform", "ArgoCD",
    "LangChain", "LangGraph", "PyTorch", "TensorFlow", "LLM", "RAG",
    "Flutter", "Swift", "Android", "iOS", "Rust", "Go", "Golang",
    "GitHub Actions", "Vite", "Tailwind", "Zustand", "TanStack",
]

_CUTOFF = datetime.now(tz=timezone.utc) - timedelta(days=90)


def _parse_date(entry) -> datetime | None:
    for attr in ("published_parsed", "updated_parsed"):
        t = getattr(entry, attr, None)
        if t:
            try:
                from calendar import timegm
                return datetime.fromtimestamp(timegm(t), tz=timezone.utc)
            except Exception:
                pass
    return None


def _collect_feed(name: str, url: str) -> list[str]:
    try:
        feed = feedparser.parse(url)
        texts = []
        for entry in feed.entries:
            dt = _parse_date(entry)
            if dt and dt < _CUTOFF:
                continue
            title   = getattr(entry, "title", "")
            summary = getattr(entry, "summary", "")
            texts.append(f"{title} {summary}")
        print(f"  [tech_blog] {name}: {len(texts)}건")
        return texts
    except Exception as e:
        print(f"  [tech_blog] {name} 실패: {e}")
        return []


def collect(role: str) -> dict:
    """모든 RSS 피드 수집 후 기술 키워드 빈도 반환 (role 구분 없이 전체 수집)."""
    all_texts: list[str] = []
    for name, url in RSS_FEEDS:
        all_texts.extend(_collect_feed(name, url))

    combined = " ".join(all_texts).lower()
    counts: Counter = Counter()
    for token in _TECH_TOKENS:
        cnt = len(re.findall(re.escape(token.lower()), combined))
        if cnt > 0:
            counts[token] = cnt

    print(f"  [tech_blog] {role}: 전체 {len(all_texts)}건, 키워드 {len(counts)}개")
    return {
        "role": role,
        "source": "tech_blog",
        "keyword_counts": dict(counts.most_common(30)),
        "total_posts": len(all_texts),
    }
