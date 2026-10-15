"""애플리케이션 설정의 단일 진입점.

값은 저장소 루트의 `.env`(로컬) → 환경 변수(CI·배포) 순으로 덮어쓴다.
새 설정을 추가하면 루트 `.env.example`에도 반드시 같은 키를 추가한다.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# src/app/core/config.py → parents[4] = 저장소 루트
ROOT_DIR = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    APP_NAME: str = "AX Chat Starter"
    APP_ENV: Literal["local", "test", "production"] = "local"
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    DATABASE_URL: str = "postgresql+psycopg://app:app@localhost:5432/app"

    # 개발용 기본값. 운영에서는 반드시 교체한다(아래 검증이 막는다).
    JWT_SECRET_KEY: str = "dev-only-insecure-secret-key-change-me"
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

    @model_validator(mode="after")
    def _reject_insecure_production_settings(self) -> "Settings":
        """운영 환경에서 개발용 기본값이 그대로 쓰이는 것을 막는다.

        비밀키를 바꾸지 않고 배포하면 누구나 토큰을 위조할 수 있으므로, 서버가 아예 뜨지 않게 한다.
        """
        if self.APP_ENV != "production":
            return self

        if "change-me" in self.JWT_SECRET_KEY or len(self.JWT_SECRET_KEY) < 32:
            raise ValueError(
                "운영 환경의 JWT_SECRET_KEY가 안전하지 않습니다. "
                "`openssl rand -hex 32`로 만든 값을 넣으세요."
            )

        if self.LLM_PROVIDER != "fake" and not self.LLM_API_KEY:
            raise ValueError("운영 환경에는 LLM_API_KEY가 필요합니다.")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
