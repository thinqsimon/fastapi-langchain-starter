"""admin 도메인 - 요청/응답 스키마."""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, computed_field

from app.core.config import settings
from app.core.plans import PlanName

LlmProviderName = Literal["openai", "anthropic", "google_genai"]

# 화면에 보여줄 순서. 한 번도 설정한 적 없을 때 키 없는 행을 이 순서로 만들어 둔다.
ALLOWED_PROVIDERS: tuple[LlmProviderName, ...] = ("openai", "anthropic", "google_genai")

ModelName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class AdminUserRead(BaseModel):
    """관리자 검색 결과의 사용자 한 명. 비밀번호 해시 같은 내부 값은 내려주지 않는다."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str
    is_active: bool
    plan: str
    plan_expires_at: datetime | None = None
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_admin(self) -> bool:
        """관리자 계정(설정 파일의 ADMIN_EMAILS)은 비밀번호 초기화·삭제 대상이 아니다(ADMIN-05)."""
        return self.email.lower() in settings.admin_emails


class PlanUpdate(BaseModel):
    plan: PlanName


class PasswordResetRequest(BaseModel):
    """관리자가 정해 주는 새 비밀번호(ADMIN-05). 비우면 서버의 기본 암호로 바꾼다."""

    password: str | None = Field(
        default=None,
        min_length=8,
        max_length=72,
        description="새 비밀번호(가입 규칙과 같은 8~72자). 비우면 기본 암호",
    )


class PasswordResetDefaultRead(BaseModel):
    """'기본 암호로 초기화'에 쓰는 값. 관리자가 사용자에게 알려 주려고 화면에 보여 준다."""

    password: str


class PasswordResetResponse(BaseModel):
    user: AdminUserRead
    # 어떤 비밀번호로 바꿨는지. 비밀번호 자체는 응답에 싣지 않는다.
    password_source: Literal["default", "custom"]


class ActingTokenResponse(BaseModel):
    """'이 계정으로 테스트'(ADMIN-02) 토큰. 리프레시 토큰은 없다(만료되면 관리자 계정으로 복귀)."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AdminUserRead


class ProviderKeyRead(BaseModel):
    """공급자 API 키 상태. 키 원문은 절대 돌려주지 않고 있는지만 `has_api_key`로 알린다."""

    provider: LlmProviderName
    has_api_key: bool
    updated_at: datetime


class ProviderKeyUpdate(BaseModel):
    """`api_key`가 빈 문자열이나 null이면 키를 지운다(그 공급자는 모든 요금제에서 빠진다)."""

    api_key: str | None = None


class RouteRead(BaseModel):
    id: uuid.UUID
    plan: PlanName
    priority: int
    provider: LlmProviderName
    model: str
    enabled: bool
    forced: bool
    # 공급자 키가 없으면 켜 두어도 실제로는 쓰이지 않는다. 화면이 경고를 보여 주려고 함께 내린다.
    has_api_key: bool


class RouteCreate(BaseModel):
    plan: PlanName
    provider: LlmProviderName
    model: ModelName


class RouteUpdate(BaseModel):
    """보낸 필드만 바꾼다(`model_fields_set`)."""

    model: ModelName | None = None
    priority: int | None = Field(default=None, ge=1, le=100)
    enabled: bool | None = None
    forced: bool | None = None
