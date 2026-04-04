"""
QA 요청/응답 Pydantic 모델.
"""
import json
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class QAMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=1000)


class QATaskContext(BaseModel):
    job_type: str = Field(max_length=50)
    month: int = Field(ge=1, le=12)
    week: int = Field(ge=1, le=4)
    category: str = Field(max_length=100)
    task_name: str = Field(max_length=200)


class QARequest(BaseModel):
    task_id: str = Field(pattern=r"^\d+-\d+-\d+$")
    question: str = Field(min_length=1, max_length=200)
    task_context: QATaskContext
    messages: list[QAMessage] = Field(default=[], max_length=10)
    roadmap_id: Optional[str] = Field(
        default=None,
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        description="로드맵 UUID (제공 시 해당 로드맵 내에서만 소유권 검증)",
    )


class FeedbackRequest(BaseModel):
    task_id: str = Field(pattern=r"^\d+-\d+-\d+$")
    question: str = Field(min_length=1, max_length=200)
    answer: str = Field(min_length=1, max_length=2000)
    rating: Literal["up", "down"]


class EventRequest(BaseModel):
    task_id: str | None = Field(default=None, pattern=r"^\d+-\d+-\d+$")
    event_type: Literal["qa_opened", "qa_submitted", "task_checked"]
    metadata: dict = Field(default_factory=dict)

    @field_validator('metadata')
    @classmethod
    def validate_metadata_size(cls, v):
        if len(json.dumps(v)) > 1024:
            raise ValueError('metadata exceeds 1024 bytes limit')
        return v
