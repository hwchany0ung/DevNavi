# 직군 한국어 매핑
ROLE_MAP = {
    "backend":      "백엔드 개발자",
    "frontend":     "프론트엔드 개발자",
    "cloud_devops": "클라우드/DevOps 엔지니어",
    "fullstack":    "풀스택 개발자",
    "data":         "데이터 엔지니어/분석가",
    "ai_ml":        "AI/ML 엔지니어",
    "security":     "보안 엔지니어",
    "ios_android":  "모바일(iOS/Android) 개발자",
    "qa":           "QA 엔지니어",
}

# 기간 → 개월 수
PERIOD_MAP = {
    "3months":    3,
    "6months":    6,
    "1month":     1,   # M6: RerouteRequest.original_period에서 사용되는 값 추가
    "1year":     12,
    "1year_plus": 18,
}

# 지식 수준 한국어
LEVEL_MAP = {
    "beginner":      "완전 입문 (개발 경험 없음)",
    "basic":         "기초 이해 (코딩 기초 완료)",
    "some_exp":      "일부 실무 경험 (사이드 프로젝트 수준)",
    "career_change": "재직 중 전환 (타 직군 현업)",
}

# 회사 유형 한국어
COMPANY_MAP = {
    "startup":  "스타트업",
    "msp":      "MSP (클라우드 관리 서비스)",
    "bigco":    "대기업",
    "si":       "SI 기업",
    "foreign":  "외국계 기업",
    "any":      "무관",
}

# 하루 학습 시간 → 주당 태스크 수
TASKS_PER_WEEK = {
    "under1h": 2,
    "1to2h":   3,
    "3to4h":   5,
    "over5h":  7,
}

# 직군별 핵심 기술 스택 힌트 (프롬프트 강화용)
ROLE_STACK_HINTS = {
    "backend": "Python/Java/Node.js, REST API, DB(PostgreSQL/MySQL), Docker, AWS",
    "frontend": "React/Vue, TypeScript, CSS, 번들러(Vite/Webpack), 웹 성능 최적화",
    "cloud_devops": "AWS/GCP/Azure, Terraform, Kubernetes, CI/CD(GitHub Actions), 모니터링",
    "fullstack": "React + Node.js/Python, REST/GraphQL API, DB, 배포(Vercel/AWS)",
    "data": "Python, SQL, Spark/Hadoop, Airflow, BI 도구(Tableau/Looker), 통계",
    "ai_ml": "Python, PyTorch/TensorFlow, 수학(선형대수/확률), MLOps, LLM Fine-tuning",
    "security": "네트워크 보안, 리버스 엔지니어링, 취약점 분석, 보안 자격증(CISA/CEH)",
    "ios_android": "Swift/Kotlin, Xcode/Android Studio, 앱 배포(AppStore/PlayStore), UI/UX",
    "qa": "테스트 자동화(Selenium/Playwright), 성능 테스트(JMeter), JIRA, 테스트 설계",
}
