"""notebook 도메인 - 요청/응답 스키마."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.domain.notebook.parser import split_tags

# 공백만 있는 값은 빈 값으로 본다.
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Kind = Annotated[str, StringConstraints(strip_whitespace=True, max_length=30)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Difficulty = Annotated[int, Field(ge=1, le=5)]

MAX_CONTENT = 500_000
MAX_TAGS = 20


class NotebookUpload(BaseModel):
    """브라우저가 읽은 마크다운 파일. multipart 대신 JSON으로 받는다."""

    filename: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    content: str = Field(min_length=1, max_length=MAX_CONTENT)


class NotebookCreate(BaseModel):
    title: Title


class NotebookUpdate(BaseModel):
    title: Title


class TopicCreate(BaseModel):
    title: Title
    content: str = Field(default="", max_length=MAX_CONTENT)
    kind: Kind | None = None
    tags: list[Tag] = Field(default_factory=list, max_length=MAX_TAGS)
    difficulty: Difficulty | None = None


class TopicUpdate(BaseModel):
    """보낸 필드만 바꾼다(서비스가 model_fields_set을 본다). 유형을 비우면 '없음'이 된다."""

    title: Title | None = None
    content: str | None = Field(default=None, max_length=MAX_CONTENT)
    kind: Kind | None = None
    tags: list[Tag] | None = Field(default=None, max_length=MAX_TAGS)
    difficulty: Difficulty | None = None
    completed: bool | None = None


class TopicSummary(BaseModel):
    """목록용. 본문은 싣지 않는다."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    notebook_id: uuid.UUID
    position: int
    title: str
    kind: str | None
    tags: list[str]
    difficulty: int | None
    completed: bool
    updated_at: datetime

    @field_validator("tags", mode="before")
    @classmethod
    def _split_stored_tags(cls, value: object) -> object:
        # DB에는 쉼표로 이어 저장한다.
        return split_tags(value) if isinstance(value, str) else value


class TopicRead(TopicSummary):
    content: str
    created_at: datetime


class NotebookRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    filename: str | None
    project: str | None
    summary: str | None
    topics: list[TopicSummary]
    created_at: datetime
    updated_at: datetime
