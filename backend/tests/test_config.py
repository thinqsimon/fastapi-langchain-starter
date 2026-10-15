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
            # 개발자 .env에 키가 있어도 결과가 달라지지 않도록 대체 키까지 비운다.
            OPENAI_API_KEY="",
        )


def test_provider_standard_key_is_used_as_fallback() -> None:
    """LLM_API_KEY 대신 OPENAI_API_KEY만 넣어도 동작한다."""
    settings = Settings(LLM_PROVIDER="openai", LLM_API_KEY="", OPENAI_API_KEY="sk-from-env")

    assert settings.llm_api_key == "sk-from-env"


def test_explicit_llm_api_key_wins() -> None:
    settings = Settings(LLM_PROVIDER="openai", LLM_API_KEY="sk-explicit", OPENAI_API_KEY="sk-env")

    assert settings.llm_api_key == "sk-explicit"


def test_production_accepts_strong_settings() -> None:
    settings = Settings(**PRODUCTION, JWT_SECRET_KEY=STRONG_SECRET)

    assert settings.APP_ENV == "production"


def test_local_allows_development_defaults() -> None:
    """로컬에서는 약한 값이어도 바로 실행돼야 한다(검증은 운영에서만 막는다)."""
    settings = Settings(APP_ENV="local", JWT_SECRET_KEY="change-me", LLM_API_KEY="")

    assert settings.APP_ENV == "local"


def test_blank_optional_values_are_treated_as_unset() -> None:
    """`.env`에 `LLM_PRICE_INPUT_PER_1M=`처럼 비워 둬도 서버가 떠야 한다."""
    settings = Settings(
        LLM_BASE_URL="",
        LLM_PRICE_INPUT_PER_1M="",
        LLM_PRICE_OUTPUT_PER_1M="",
    )

    assert settings.LLM_BASE_URL is None
    assert settings.LLM_PRICE_INPUT_PER_1M is None
    assert settings.LLM_PRICE_OUTPUT_PER_1M is None


def test_test_database_is_separate_from_app_database() -> None:
    """운영 DB를 가리키도록 DATABASE_URL을 바꿔도 테스트 DB는 따라가지 않는다."""
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://user:pw@db.example.supabase.com:5432/postgres"
    )

    assert "supabase" not in settings.TEST_DATABASE_URL
    assert "localhost" in settings.TEST_DATABASE_URL


def test_cors_origins_accepts_json_array() -> None:
    settings = Settings(CORS_ORIGINS='["https://a.vercel.app","http://localhost:3000"]')

    assert settings.CORS_ORIGINS == ["https://a.vercel.app", "http://localhost:3000"]


def test_cors_origins_accepts_comma_separated() -> None:
    """대시보드에 대괄호·따옴표 없이 적어도 동작해야 한다(배포 중 실제로 겪은 문제)."""
    settings = Settings(CORS_ORIGINS="https://a.vercel.app, http://localhost:3000")

    assert settings.CORS_ORIGINS == ["https://a.vercel.app", "http://localhost:3000"]


def test_cors_origins_accepts_single_value() -> None:
    settings = Settings(CORS_ORIGINS="https://a.vercel.app")

    assert settings.CORS_ORIGINS == ["https://a.vercel.app"]


def test_broken_json_cors_origins_explains_the_fix() -> None:
    with pytest.raises(ValidationError, match="JSON 배열"):
        Settings(CORS_ORIGINS='["https://a.vercel.app"')
