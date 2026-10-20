"""auth 도메인 - 요청/응답 스키마."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints


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
    created_at: datetime
