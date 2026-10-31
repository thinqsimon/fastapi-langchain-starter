"""answer_level 도메인 - 요청/응답 스키마."""

from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.core.answer_levels import NAME_MAX_LENGTH


class AnswerLevelRead(BaseModel):
    level: int
    # 지금 화면에 보일 이름(관리자가 바꿨으면 그 이름)
    name: str
    default_name: str
    audience: str
    style: str
    example: str


class AnswerLevelRename(BaseModel):
    name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=NAME_MAX_LENGTH)
    ]
