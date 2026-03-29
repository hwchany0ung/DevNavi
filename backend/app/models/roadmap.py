import json
import re
from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional, Union

# 개별 스킬/자격증 항목 최대 길이 (프롬프트 인젝션 및 비용 방어)
_ITEM_MAX_LEN = 60

# 화이트리스트: 허용 문자만 통과 (영문, 한글, 숫자, 기술명에 쓰이는 기호)
# C++, C#, .NET, Node.js, iOS/Android, AWS S3, TypeScript 등 보존
_ALLOWED_PATTERN = re.compile(r'[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s\.\+\#\@\/\-\_\!\(\)\:\,]')


def _sanitize_item(item: str) -> str:
    """허용된 문자만 통과시키는 화이트리스트 방식 정제 후 길이 제한.

    허용: 영문, 한글, 숫자, 공백, . + # @ / - _ ! ( ) : ,
    차단: 줄바꿈, 탭, 괄호류, 백슬래시, 따옴표, 세미콜론 등 인젝션 위험 문자
    """
    cleaned = _ALLOWED_PATTERN.sub('', str(item))
    return cleaned[:_ITEM_MAX_LEN].strip()


def _truncate_items(items: list) -> list[str]:
    """리스트 항목을 sanitize 후 _ITEM_MAX_LEN 자로 자름."""
    return [_sanitize_item(item) for item in items]


# ───────────────────────────── 요청 모델 ─────────────────────────────

class TeaserRequest(BaseModel):
    role: Literal[
        "backend", "frontend", "cloud_devops", "fullstack",
        "data", "ai_ml", "security", "ios_android", "qa"
    ]
    period: Literal["3months", "6months", "1year", "1year_plus"]
    level: Literal["beginner", "basic", "some_exp", "career_change"]


class FullRoadmapRequest(BaseModel):
    role: Literal[
        "backend", "frontend", "cloud_devops", "fullstack",
        "data", "ai_ml", "security", "ios_android", "qa"
    ]
    period: Literal["3months", "6months", "1year", "1year_plus"]
    level: Literal["beginner", "basic", "some_exp", "career_change"]
    skills: list[str] = Field(default_factory=list, max_length=20)
    certifications: list[str] = Field(default_factory=list, max_length=10)
    company_type: Literal["startup", "msp", "bigco", "si", "foreign", "any"] = "any"
    daily_study_hours: Literal["under1h", "1to2h", "3to4h", "over5h"] = "1to2h"

    @field_validator("skills", "certifications", mode="before")
    @classmethod
    def truncate_items(cls, v: list) -> list[str]:
        return _truncate_items(v) if isinstance(v, list) else v


_TASK_ID_RE = re.compile(r'^\d{1,3}-\d{1,2}-\d{1,3}$')

# 페이로드 크기 제한 (512KB) — Supabase 스토리지 남용 방지
_ROADMAP_MAX_BYTES = 512 * 1024


class RerouteRequest(BaseModel):
    original_role: Literal[
        "backend", "frontend", "cloud_devops", "fullstack",
        "data", "ai_ml", "security", "ios_android", "qa"
    ]
    original_period: Literal["3months", "6months", "1year", "1year_plus"]
    company_type: Literal["startup", "msp", "bigco", "si", "foreign", "any"] = "any"
    completion_rate: float = Field(ge=0, le=100)
    done_contents: list[str] = Field(default_factory=list, max_length=50)
    weeks_left: int = Field(ge=1, le=80)
    daily_study_hours: Literal["under1h", "1to2h", "3to4h", "over5h"] = "1to2h"

    @field_validator("done_contents", mode="before")
    @classmethod
    def sanitize_done_contents(cls, v: list) -> list[str]:
        return _truncate_items(v) if isinstance(v, list) else v


class PersistRequest(BaseModel):
    """스트리밍 완료 후 프론트가 POST /roadmap/persist 로 보내는 바디."""
    role: Literal[
        "backend", "frontend", "cloud_devops", "fullstack",
        "data", "ai_ml", "security", "ios_android", "qa"
    ]
    period: Literal["3months", "6months", "1year", "1year_plus"]
    roadmap: dict                          # FullRoadmapResponse JSON
    parent_id: Optional[str] = None       # GPS 재탐색 시 원본 roadmap_id

    @field_validator("roadmap", mode="after")
    @classmethod
    def check_roadmap_size(cls, v: dict) -> dict:
        size = len(json.dumps(v, ensure_ascii=False).encode("utf-8"))
        if size > _ROADMAP_MAX_BYTES:
            raise ValueError(
                f"roadmap 페이로드가 너무 큽니다 ({size // 1024}KB > 512KB)."
            )
        return v


class CompletionToggleRequest(BaseModel):
    """태스크 완료/취소 토글 요청."""
    task_id: str       # "{month}-{week}-{taskIndex}"
    completed: bool

    @field_validator("task_id")
    @classmethod
    def validate_task_id(cls, v: str) -> str:
        if not _TASK_ID_RE.match(v):
            raise ValueError("task_id 형식이 잘못됐습니다. '{월}-{주}-{인덱스}' 형식이어야 합니다.")
        return v


# ───────────────────────────── 응답 모델 ─────────────────────────────

class TaskItem(BaseModel):
    content: str
    category: Literal["learn", "project", "cert"]


class WeekPlan(BaseModel):
    week: int
    tasks: list[TaskItem]


class MonthPlan(BaseModel):
    month: int
    theme: str
    weeks: list[WeekPlan]


class FullRoadmapResponse(BaseModel):
    summary: str
    persona_title: str
    persona_subtitle: str
    months: list[MonthPlan]


class RoadmapSaveResponse(BaseModel):
    roadmap_id: str
    message: str = "저장 완료"


# ───────────────────────────── 커리어 분석 ───────────────────────────

class CareerSummaryRequest(BaseModel):
    role: Literal[
        "backend", "frontend", "cloud_devops", "fullstack",
        "data", "ai_ml", "security", "ios_android", "qa"
    ]
    period: Literal["3months", "6months", "1year", "1year_plus"]
    level: Literal["beginner", "basic", "some_exp", "career_change"]
    skills: list[str] = Field(default_factory=list, max_length=20)
    certifications: list[str] = Field(default_factory=list, max_length=10)
    company_type: Literal["startup", "msp", "bigco", "si", "foreign", "any"] = "any"

    @field_validator("skills", "certifications", mode="before")
    @classmethod
    def truncate_items(cls, v: list) -> list[str]:
        return _truncate_items(v) if isinstance(v, list) else v


class SkillItem(BaseModel):
    name: str
    priority: Union[int, str] = 1
    reason: str = ""

    @field_validator("priority", mode="before")
    @classmethod
    def coerce_priority(cls, v):
        try:
            return int(v)
        except (TypeError, ValueError):
            return 1


class CertItem(BaseModel):
    name: str
    priority: Union[int, str] = 1
    why: str = ""

    @field_validator("priority", mode="before")
    @classmethod
    def coerce_priority(cls, v):
        try:
            return int(v)
        except (TypeError, ValueError):
            return 1


class CareerSummaryResponse(BaseModel):
    skills_to_learn: list[SkillItem] = Field(default_factory=list)
    certs_to_get: list[CertItem] = Field(default_factory=list)
    appeal_points: list[str] = Field(default_factory=list)
    career_message: str = ""

    model_config = {"extra": "ignore"}  # 여분 필드 무시
