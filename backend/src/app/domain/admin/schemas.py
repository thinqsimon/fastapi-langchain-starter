"""admin 도메인 - 요청/응답 스키마."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

LlmProviderName = Literal["openai", "anthropic", "google_genai"]

# 화면에 보여줄 순서이자, 한 번도 설정한 적 없을 때 만들어 두는 기본 우선순위다.
ALLOWED_PROVIDERS: tuple[LlmProviderName, ...] = ("openai", "anthropic", "google_genai")


class ProviderSettingRead(BaseModel):
    """키 원문은 절대 돌려주지 않는다. 있는지 없는지만 `has_api_key`로 알린다."""

    provider: LlmProviderName
    model: str
    has_api_key: bool
    priority: int
    enabled: bool
    forced: bool
    updated_at: datetime


class ProviderSettingUpdate(BaseModel):
    """보낸 필드만 바꾼다. 어떤 필드가 왔는지는 `model_fields_set`으로 본다.

    `api_key`를 보내지 않으면 저장된 키를 그대로 둔다(화면이 키 원문을 다시 받지 않으므로).
    `api_key`로 빈 문자열이나 null을 보내면 키를 지운다(그 공급자는 더 쓰이지 않는다).
    """

    model: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
        | None
    ) = None
    api_key: str | None = None
    priority: int | None = Field(default=None, ge=1, le=100)
    enabled: bool | None = None
    forced: bool | None = None
