"""auth 도메인 - 요청/응답 스키마."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, computed_field

from app.core.config import settings


class SignupRequest(BaseModel):
    email: EmailStr
    # bcrypt가 72바이트까지만 쓰므로 상한을 맞춰 조용히 잘리는 일을 막는다.
    password: str = Field(min_length=8, max_length=72)
    display_name: str = Field(min_length=1, max_length=50)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ProfileUpdate(BaseModel):
    # 공백만 넣으면 이름이 사라지므로 앞뒤 공백을 지운 뒤 길이를 본다.
    display_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)
    ]


class EmailChange(BaseModel):
    email: EmailStr
    # 로그인 ID가 바뀌므로 본인 확인을 한 번 더 한다.
    current_password: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    display_name: str
    is_active: bool
    # 요금제(free/pro/max). 화면의 계정 메뉴에 표시하고, 서버는 이 값으로 LLM 라우팅을 고른다.
    plan: str
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_admin(self) -> bool:
        """ "서버 설정" 화면(ADMIN-01)에 들어갈 수 있는지. DB 컬럼이 아니라 설정 파일로 정한다."""
        return self.email.lower() in settings.admin_emails
