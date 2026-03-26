from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional, Union

# 개별 스킬/자격증 항목 최대 길이 (프롬프트 인젝션 및 비용 방어)
_ITEM_MAX_LEN = 60


def _truncate_items(items: list) -> list[str]:
    """리스트 항목을 문자열로 변환 후 _ITEM_MAX_LEN 자로 자름."""
    return [str(item)[:_ITEM_MAX_LEN] for item in items]


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


class PersistRequest(BaseModel):
    """스트리밍 완료 후 프론트가 POST /roadmap/persist 로 보내는 바디."""
    role: Literal[
        "backend", "frontend", "cloud_devops", "fullstack",
        "data", "ai_ml", "security", "ios_android", "qa"
    ]
    period: Literal["3months", "6months", "1year", "1year_plus"]
    roadmap: dict                          # FullRoadmapResponse JSON
    parent_id: Optional[str] = None       # GPS 재탐색 시 원본 roadmap_id


class CompletionToggleRequest(BaseModel):
    """태스크 완료/취소 토글 요청."""
    task_id: str       # "{month}-{week}-{taskIndex}"
    completed: bool


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
