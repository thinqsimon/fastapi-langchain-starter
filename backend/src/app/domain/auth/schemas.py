"""auth 도메인 - 요청/응답 스키마."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


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


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    display_name: str
    is_active: bool
    created_at: datetime
