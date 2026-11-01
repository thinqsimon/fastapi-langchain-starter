"""chat 도메인 - 요청/응답 스키마."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

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
