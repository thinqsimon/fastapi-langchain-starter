"""diary 도메인 - 요청/응답 스키마."""

import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints

# 공백만 있는 값은 빈 값으로 본다.
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class DiaryDraftRequest(BaseModel):
    conversation_id: uuid.UUID
    # 서버는 UTC라 한국 새벽(00~09시)에는 날짜가 하루 늦다. 화면이 사용자 기준 오늘을 보낸다.
    entry_date: date | None = Field(default=None, description="사용자 기준 오늘. 비우면 UTC 날짜")


class DiaryDraftResponse(BaseModel):
    """초안. 저장하지 않으며, 저장할 때 그대로(수정해서) 돌려보낸다."""

    conversation_id: uuid.UUID
    # 저장 요청에 그대로 돌려보내야 재발행 조건을 정확히 판단할 수 있다.
    source_last_message_at: datetime
    entry_date: date
    title: str
    learned: str
    learned_detail: str
    difficult: str
    # 대화에 '내일 할 것'이 없으면 빈 문자열
    next_plan: str


class EligibleConversation(BaseModel):
    """일기로 만들 수 있는 채팅. 새 대화가 없는 채팅은 목록에 나오지 않는다."""

    id: uuid.UUID
    title: str
    last_message_at: datetime
    # 이 채팅으로 이미 쓴 일기 수(0이면 처음)
    diary_count: int


class DiaryEntryCreate(BaseModel):
    title: Title
    entry_date: date | None = Field(default=None, description="비우면 오늘 날짜")
    conversation_id: uuid.UUID | None = None
    # 초안의 값을 그대로 돌려보낸다. 시간대가 없는 값은 비교할 수 없어 거부한다.
    source_last_message_at: AwareDatetime | None = None
    learned: RequiredText
    learned_detail: str = ""
    difficult: RequiredText
    # 비우면 항목 없이 저장된다
    next_plan: str | None = None


class DiaryEntryUpdate(BaseModel):
    title: Title
    learned: RequiredText
    learned_detail: str = ""
    difficult: RequiredText
    next_plan: str | None = None


class DiaryEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID | None
    entry_date: date
    day_sequence: int
    title: str
    learned: str
    learned_detail: str
    difficult: str
    next_plan: str | None
    footer: str | None
    created_at: datetime
    updated_at: datetime


class WeeklyReviewResponse(BaseModel):
    week_start: date
    week_end: date
    entry_count: int
    grown: str
    repeated_difficulty: str
    suggestion: str
