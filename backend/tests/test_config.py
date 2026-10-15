"""설정 안전장치 검증: 운영 환경에 개발용 기본값이 새어 들어가지 않는다."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings

PRODUCTION = {"APP_ENV": "production", "LLM_PROVIDER": "fake"}
STRONG_SECRET = "a" * 64


def test_production_rejects_default_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(**PRODUCTION, JWT_SECRET_KEY="dev-only-insecure-secret-key-change-me")


def test_production_rejects_short_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(**PRODUCTION, JWT_SECRET_KEY="too-short")


def test_production_requires_llm_api_key() -> None:
    with pytest.raises(ValidationError, match="LLM_API_KEY"):
        Settings(
            APP_ENV="production",
            JWT_SECRET_KEY=STRONG_SECRET,
            LLM_PROVIDER="openai",
            LLM_API_KEY="",
        )


def test_production_accepts_strong_settings() -> None:
    settings = Settings(**PRODUCTION, JWT_SECRET_KEY=STRONG_SECRET)

    assert settings.APP_ENV == "production"


def test_local_allows_development_defaults() -> None:
    """로컬에서는 약한 값이어도 바로 실행돼야 한다(검증은 운영에서만 막는다)."""
    settings = Settings(APP_ENV="local", JWT_SECRET_KEY="change-me", LLM_API_KEY="")

    assert settings.APP_ENV == "local"
