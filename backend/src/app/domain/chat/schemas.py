"""chat 도메인 - 요청/응답 스키마."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.answer_levels import AnswerLevel

# 이름을 붙이기 전의 제목. 이 제목인 대화만 첫 메시지를 제목으로 삼는다.
DEFAULT_CONVERSATION_TITLE = "새 대화"


class ConversationCreate(BaseModel):
    title: str = Field(default=DEFAULT_CONVERSATION_TITLE, min_length=1, max_length=100)


class ConversationUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=100)


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    content: str
    created_at: datetime
    # 답한 공급자·모델. 사용자 메시지와 예전 답변은 null.
    provider: str | None = None
    model: str | None = None
    plan: str | None = None
    # 답한 수준(CHAT-04). 사용자 메시지와 예전 답변은 null.
    answer_level: int | None = None
    # 이어서 물어볼 추천 질문(CHAT-04). 없으면 빈 목록.
    suggested_questions: list[str] = Field(default_factory=list)

    @field_validator("suggested_questions", mode="before")
    @classmethod
    def _empty_when_missing(cls, value: list[str] | None) -> list[str]:
        return value or []


class ConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationDetail(ConversationRead):
    messages: list[MessageRead]


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
    # 이번 질문에만 쓸 답변 수준(CHAT-04). 없으면 내 설정 수준으로 답하고, 설정은 바뀌지 않는다.
    answer_level: AnswerLevel | None = None
