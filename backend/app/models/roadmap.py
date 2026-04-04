import json
import re
from enum import Enum
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


# ───────────────────────────── 숙련도·추가 프로필 ─────────────────────

class SkillLevel(str, Enum):
    """스킬 숙련도 4단계."""
    beginner = "beginner"           # 입문 (들어본 정도)
    basic = "basic"                 # 기초 (튜토리얼 수준)
    intermediate = "intermediate"   # 중급 (개인 프로젝트 경험)
    advanced = "advanced"           # 능숙 (실무/팀 프로젝트 경험)


class OnboardingSkillItem(BaseModel):
    """온보딩에서 전송하는 스킬+숙련도 쌍."""
    name: str
    level: SkillLevel = SkillLevel.basic

    @field_validator("name", mode="before")
    @classmethod
    def sanitize_name(cls, v):
        return _sanitize_item(str(v))


class ExtraProfile(BaseModel):
    """더 정교한 로드맵을 위한 선택적 추가 프로필."""
    has_deployment: bool = False
    coding_test_level: Literal["none", "basic", "intermediate", "advanced"] = "none"
    team_project_count: Literal[0, 1, 2, 3] = 0  # 3 = 3회 이상


def _coerce_skills(v: list) -> list:
    """list[str] 또는 list[dict/OnboardingSkillItem] 을 list[OnboardingSkillItem]로 통합 변환.

    하위호환: 기존 클라이언트가 ["React", "Python"] 형태로 보내도
    [OnboardingSkillItem(name="React", level="basic"), ...] 로 자동 변환.
    """
    if not isinstance(v, list):
        return v
    result = []
    for item in v:
        if isinstance(item, str):
            result.append(OnboardingSkillItem(name=_sanitize_item(item), level=SkillLevel.basic))
        elif isinstance(item, dict):
            name = _sanitize_item(str(item.get("name", "")))
            level = item.get("level", "basic")
            result.append(OnboardingSkillItem(name=name, level=level))
        elif isinstance(item, OnboardingSkillItem):
            result.append(item)
        else:
            result.append(OnboardingSkillItem(name=_sanitize_item(str(item)), level=SkillLevel.basic))
    return result


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
    skills: list[OnboardingSkillItem] = Field(default_factory=list, max_length=20)
    certifications: list[str] = Field(default_factory=list, max_length=10)
    company_type: Literal["startup", "msp", "bigco", "si", "foreign", "any"] = "any"
    daily_study_hours: Literal["under1h", "1to2h", "3to4h", "over5h"] = "1to2h"
    extra_profile: Optional[ExtraProfile] = None

    @field_validator("skills", mode="before")
    @classmethod
    def coerce_skills_items(cls, v: list) -> list:
        """list[str] 하위호환 → OnboardingSkillItem 변환."""
        return _coerce_skills(v) if isinstance(v, list) else v

    @field_validator("certifications", mode="before")
    @classmethod
    def truncate_certs(cls, v: list) -> list[str]:
        return _truncate_items(v) if isinstance(v, list) else v


_TASK_ID_RE = re.compile(r'^\d{1,3}-\d{1,2}-\d{1,3}$')
_UUID_RE    = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

# 페이로드 크기 제한 (512KB) — Supabase 스토리지 남용 방지
_ROADMAP_MAX_BYTES = 512 * 1024


class RerouteRequest(BaseModel):
    original_role: Literal[
        "backend", "frontend", "cloud_devops", "fullstack",
        "data", "ai_ml", "security", "ios_android", "qa"
    ]
    original_period: Literal["1month", "3months", "6months", "1year", "1year_plus"]
    company_type: Literal["startup", "msp", "bigco", "si", "foreign", "any"] = "any"
    completion_rate: float = Field(ge=0, le=100)
    done_contents: list[str] = Field(default_factory=list, max_length=50)
    weeks_left: int = Field(ge=1, le=80)
    daily_study_hours: Literal["under1h", "1to2h", "3to4h", "over5h"] = "1to2h"
    # I-3: 서버측 완료율 계산용 — 제공 시 DB에서 실제 완료율 조회 (하위 호환 유지)
    roadmap_id: Optional[str] = None
    # 사용자 추가 학습 요청 항목 (최대 10개, 각 100자 이내)
    user_requests: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("roadmap_id", mode="after")
    @classmethod
    def validate_roadmap_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _UUID_RE.match(v):
            raise ValueError("roadmap_id는 UUID 형식이어야 합니다.")
        return v

    @field_validator("done_contents", mode="before")
    @classmethod
    def sanitize_done_contents(cls, v: list) -> list[str]:
        return _truncate_items(v) if isinstance(v, list) else v

    @field_validator("user_requests", mode="before")
    @classmethod
    def sanitize_user_requests(cls, v: list) -> list[str]:
        if not isinstance(v, list):
            return []
        return [_sanitize_item(str(item))[:100] for item in v if item][:10]


class PersistRequest(BaseModel):
    """스트리밍 완료 후 프론트가 POST /roadmap/persist 로 보내는 바디."""
    role: Literal[
        "backend", "frontend", "cloud_devops", "fullstack",
        "data", "ai_ml", "security", "ios_android", "qa"
    ]
    period: Literal["3months", "6months", "1year", "1year_plus"]
    roadmap: dict                          # FullRoadmapResponse JSON
    parent_id: Optional[str] = None       # GPS 재탐색 시 원본 roadmap_id

    @field_validator("parent_id", mode="after")
    @classmethod
    def validate_parent_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _UUID_RE.match(v):
            raise ValueError("parent_id는 UUID 형식이어야 합니다.")
        return v

    @field_validator("roadmap", mode="after")
    @classmethod
    def check_roadmap_structure(cls, v: dict) -> dict:
        """BI-9: roadmap dict에 최소 필수 키가 존재하는지 검증."""
        if "months" not in v or not isinstance(v.get("months"), list):
            raise ValueError("roadmap에 months 배열이 필요합니다.")
        if len(v["months"]) == 0:
            raise ValueError("roadmap.months가 비어있습니다.")
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
    skills: list[OnboardingSkillItem] = Field(default_factory=list, max_length=20)
    certifications: list[str] = Field(default_factory=list, max_length=10)
    company_type: Literal["startup", "msp", "bigco", "si", "foreign", "any"] = "any"
    extra_profile: Optional[ExtraProfile] = None

    @field_validator("skills", mode="before")
    @classmethod
    def coerce_skills_items(cls, v: list) -> list:
        """list[str] 하위호환 → OnboardingSkillItem 변환."""
        return _coerce_skills(v) if isinstance(v, list) else v

    @field_validator("certifications", mode="before")
    @classmethod
    def truncate_certs(cls, v: list) -> list[str]:
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
