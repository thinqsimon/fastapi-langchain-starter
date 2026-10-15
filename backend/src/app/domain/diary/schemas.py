"""diary 도메인 - 요청/응답 스키마."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class DiaryDraftRequest(BaseModel):
    conversation_id: uuid.UUID


class DiaryDraftResponse(BaseModel):
    learned: str
    difficult: str
    next_plan: str


class DiaryEntryCreate(BaseModel):
    entry_date: date | None = Field(default=None, description="비우면 오늘 날짜")
    conversation_id: uuid.UUID | None = None
    learned: str = Field(min_length=1, max_length=4000)
    difficult: str = Field(min_length=1, max_length=4000)
    next_plan: str = Field(min_length=1, max_length=4000)


class DiaryEntryUpdate(BaseModel):
    learned: str = Field(min_length=1, max_length=4000)
    difficult: str = Field(min_length=1, max_length=4000)
    next_plan: str = Field(min_length=1, max_length=4000)


class DiaryEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entry_date: date
    learned: str
    difficult: str
    next_plan: str
    created_at: datetime
    updated_at: datetime


class WeeklyReviewResponse(BaseModel):
    week_start: date
    week_end: date
    entry_count: int
    grown: str
    repeated_difficulty: str
    suggestion: str
