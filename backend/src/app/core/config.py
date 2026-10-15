"""애플리케이션 설정의 단일 진입점.

값은 저장소 루트의 `.env`(로컬) → 환경 변수(CI·배포) 순으로 덮어쓴다.
새 설정을 추가하면 루트 `.env.example`에도 반드시 같은 키를 추가한다.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# src/app/core/config.py → parents[4] = 저장소 루트
ROOT_DIR = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    APP_NAME: str = "AX Chat Starter"
    APP_ENV: Literal["local", "test", "production"] = "local"
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    DATABASE_URL: str = "postgresql+psycopg://app:app@localhost:5432/app"

    JWT_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    # LLM: "fake"는 API 키 없이 동작하는 테스트용 공급자
    LLM_PROVIDER: str = "openai"
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str | None = None
    LLM_TEMPERATURE: float = 0.3

    RAG_ENABLED: bool = False

    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
