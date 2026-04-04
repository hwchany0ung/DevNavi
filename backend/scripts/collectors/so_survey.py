"""Stack Overflow Developer Survey 2024 공개 데이터 기반 글로벌 베이스라인.

출처: https://survey.stackoverflow.co/2024/
업데이트 주기: 연 1회 (매년 5~6월 공개 후 갱신)
형식: 기술명 -> 사용률(%) 정규화 점수 (0.0~1.0)
"""

# 2024 Survey: "Most popular technologies" 항목 (사용률 상위 기준)
SO_2024: dict[str, dict[str, float]] = {
    "backend": {
        "JavaScript":    0.98,
        "Python":        0.89,
        "Java":          0.72,
        "TypeScript":    0.78,
        "SQL":           0.95,
        "Spring Boot":   0.45,
        "FastAPI":       0.32,
        "Node.js":       0.65,
        "Docker":        0.71,
        "PostgreSQL":    0.62,
        "Redis":         0.44,
        "AWS":           0.58,
        "Kotlin":        0.31,
        "gRPC":          0.18,
    },
    "frontend": {
        "JavaScript":    0.98,
        "TypeScript":    0.78,
        "React":         0.74,
        "Next.js":       0.51,
        "Vue":           0.34,
        "Tailwind CSS":  0.52,
        "Vite":          0.44,
        "Node.js":       0.65,
        "CSS":           0.97,
        "HTML":          0.97,
    },
    "cloud_devops": {
        "Docker":        0.71,
        "Kubernetes":    0.45,
        "AWS":           0.58,
        "Terraform":     0.38,
        "GitHub Actions":0.62,
        "ArgoCD":        0.21,
        "Linux":         0.82,
        "Python":        0.89,
        "Go":            0.41,
        "Ansible":       0.28,
    },
    "ai_ml": {
        "Python":        0.89,
        "PyTorch":       0.52,
        "TensorFlow":    0.38,
        "LangChain":     0.29,
        "OpenAI API":    0.45,
        "Hugging Face":  0.41,
        "Jupyter":       0.65,
        "scikit-learn":  0.61,
        "NumPy":         0.78,
        "Pandas":        0.75,
    },
    "data": {
        "Python":        0.89,
        "SQL":           0.95,
        "Pandas":        0.75,
        "Spark":         0.31,
        "Airflow":       0.28,
        "dbt":           0.22,
        "PostgreSQL":    0.62,
        "Snowflake":     0.24,
        "Kafka":         0.21,
        "Tableau":       0.28,
    },
    "fullstack": {
        "JavaScript":    0.98,
        "TypeScript":    0.78,
        "React":         0.74,
        "Next.js":       0.51,
        "Node.js":       0.65,
        "PostgreSQL":    0.62,
        "Docker":        0.71,
        "Tailwind CSS":  0.52,
        "Prisma":        0.31,
        "tRPC":          0.18,
    },
    "security": {
        "Python":        0.89,
        "Linux":         0.82,
        "Docker":        0.71,
        "AWS":           0.58,
        "Bash":          0.72,
        "SQL":           0.95,
        "Go":            0.41,
        "Rust":          0.29,
    },
    "ios_android": {
        "Swift":         0.55,
        "Kotlin":        0.55,
        "Flutter":       0.42,
        "Dart":          0.38,
        "Objective-C":   0.21,
        "Java":          0.72,
        "Firebase":      0.44,
        "React Native":  0.32,
    },
    "qa": {
        "JavaScript":    0.98,
        "Python":        0.89,
        "TypeScript":    0.78,
        "Selenium":      0.38,
        "Playwright":    0.34,
        "Jest":          0.44,
        "Cypress":       0.28,
        "Java":          0.72,
        "SQL":           0.95,
        "Docker":        0.71,
    },
}


def collect(role: str) -> dict:
    data = SO_2024.get(role, {})
    return {
        "role": role,
        "source": "so_survey",
        "keyword_counts": data,
        "survey_year": 2024,
    }
