"""admin 도메인 - 비즈니스 로직.

"서버 설정" 화면(ADMIN-01)에서 관리자가 OpenAI/Claude/Gemini의 키·모델·우선순위·강제 사용을
정한다. chat/diary 도메인은 `active_provider_chain()`을 불러 `app.llm.chains.*`에 그대로
넘긴다(비어 있으면 `.env` 설정 하나만 쓰는 기존 동작과 같다).
"""

import logging

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ServiceUnavailableError
from app.core.security import decrypt_secret, encrypt_secret
from app.domain.admin.models import LlmProviderSetting
from app.domain.admin.repositories import LlmProviderSettingRepository
from app.domain.admin.schemas import (
    ALLOWED_PROVIDERS,
    ProviderSettingRead,
    ProviderSettingUpdate,
)
from app.llm.providers import ProviderAttempt

logger = logging.getLogger(__name__)

# 한 번도 설정한 적 없는 공급자에 보여줄 기본 모델. 관리자가 화면에서 바로 바꿀 수 있다.
DEFAULT_MODELS: dict[str, str] = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-sonnet-4-5",
    "google_genai": "gemini-2.5-flash",
}


class AdminLlmSettingsService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.settings = LlmProviderSettingRepository(db)

    def _ensure_defaults(self) -> list[LlmProviderSetting]:
        """세 공급자 행이 항상 있게 한다. 없는 것만 기본값으로 만든다(기존 설정은 그대로 둔다)."""
        rows = self.settings.list_all()
        existing = {row.provider for row in rows}
        missing = [p for p in ALLOWED_PROVIDERS if p not in existing]
        if not missing:
            return rows

        next_priority = len(rows) + 1
        for offset, provider in enumerate(missing):
            self.settings.create(
                provider, DEFAULT_MODELS[provider], priority=next_priority + offset
            )
        self.db.commit()
        return self.settings.list_all()

    def list_providers(self) -> list[ProviderSettingRead]:
        return [_to_read(row) for row in self._ensure_defaults()]

    def update_provider(self, provider: str, payload: ProviderSettingUpdate) -> ProviderSettingRead:
        self._ensure_defaults()
        row = self.settings.get(provider)
        if row is None:
            raise NotFoundError("등록되지 않은 공급자입니다.")

        fields = payload.model_fields_set
        if "model" in fields and payload.model:
            row.model = payload.model
        if "api_key" in fields:
            row.encrypted_api_key = encrypt_secret(payload.api_key) if payload.api_key else None
        if "priority" in fields and payload.priority is not None:
            row.priority = payload.priority
        if "enabled" in fields and payload.enabled is not None:
            row.enabled = payload.enabled
        if "forced" in fields and payload.forced is not None:
            if payload.forced:
                self.settings.clear_forced_except(provider)
            row.forced = payload.forced

        self.db.commit()
        # 어떤 필드를 바꿨는지만 남기고 값(특히 키)은 로그에 남기지 않는다.
        logger.info("llm_provider_setting_updated provider=%s fields=%s", provider, sorted(fields))
        return _to_read(row)

    def active_provider_chain(self) -> list[ProviderAttempt]:
        """실제로 호출에 쓸 공급자 순서. 비어 있으면 호출부가 `.env` 설정 하나만 쓴다."""
        rows = [r for r in self.settings.list_all() if r.enabled and r.encrypted_api_key]
        forced = next((r for r in rows if r.forced), None)
        ordered = [forced] if forced is not None else sorted(rows, key=lambda r: r.priority)

        attempts: list[ProviderAttempt] = []
        for row in ordered:
            try:
                attempts.append(
                    ProviderAttempt(
                        provider=row.provider,
                        model=row.model,
                        api_key=decrypt_secret(row.encrypted_api_key)  # type: ignore[arg-type]
                        if row.encrypted_api_key
                        else None,
                    )
                )
            except ServiceUnavailableError:
                # 암호화 키가 바뀌는 등으로 복호화를 못 하면 이 공급자만 건너뛴다.
                # 여기서 그대로 던지면 설정을 건드린 적 없는 요청까지 전부 막히게 된다.
                logger.warning("llm_provider_setting_decrypt_failed provider=%s", row.provider)
        return attempts


def _to_read(row: LlmProviderSetting) -> ProviderSettingRead:
    return ProviderSettingRead(
        provider=row.provider,  # type: ignore[arg-type]
        model=row.model,
        has_api_key=row.encrypted_api_key is not None,
        priority=row.priority,
        enabled=row.enabled,
        forced=row.forced,
        updated_at=row.updated_at,
    )
