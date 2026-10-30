"""애플리케이션 설정의 단일 진입점.

값은 저장소 루트의 `.env`(로컬) → 환경 변수(CI·배포) 순으로 덮어쓴다.
새 설정을 추가하면 루트 `.env.example`에도 반드시 같은 키를 추가한다.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# src/app/core/config.py → parents[4] = 저장소 루트
ROOT_DIR = Path(__file__).resolve().parents[4]


AppProfile = Literal["starter", "diary-coach"]


class Settings(BaseSettings):
    # 서비스 브랜치의 기본 동작은 유지한다. starter는 서비스 전용 API를 등록하지 않는다.
    APP_PROFILE: AppProfile = "diary-coach"
    # 비우면 선택한 프로필의 이름을 사용한다.
    APP_NAME: str = ""
    APP_ENV: Literal["local", "test", "production"] = "local"
    LOG_LEVEL: str = "INFO"
    # NoDecode: 기본 JSON 해석을 끄고 아래 검증기가 직접 읽는다.
    # 배포 대시보드에서는 JSON 배열보다 쉼표 구분으로 적기 쉬워서 둘 다 받는다.
    CORS_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    DATABASE_URL: str = "postgresql+psycopg://app:app@localhost:5432/app"
    # 테스트는 운영 DB를 건드리면 안 된다. DATABASE_URL이 원격을 가리켜도 테스트는 항상 이쪽을 쓴다.
    TEST_DATABASE_URL: str = "postgresql+psycopg://app:app@localhost:5432/app"

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

    # 공급자 표준 키 이름도 받아들인다. LLM_API_KEY가 비어 있으면 이 값을 쓴다.
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""

    # 토큰 단가(100만 토큰당 USD). 비우면 llm/pricing.py의 기본 표를 쓴다.
    LLM_PRICE_INPUT_PER_1M: float | None = None
    LLM_PRICE_OUTPUT_PER_1M: float | None = None

    # "서버 설정" 화면(ADMIN-01)에 들어갈 수 있는 이메일. 쉼표로 여러 명. 비우면 아무도 못 본다.
    ADMIN_EMAILS: str = ""
    # 관리자가 서버 설정 화면에 입력한 공급자별 API 키를 DB에 암호화해 저장하는 데 쓰는 키.
    # Fernet.generate_key()로 만든다(app.core.security 참고).
    SETTINGS_ENCRYPTION_KEY: str = ""
    # 관리자가 다른 계정으로 테스트하는 토큰(ADMIN-02)의 수명(분). 지나면 관리자 계정으로 돌아간다.
    ADMIN_TEST_TOKEN_EXPIRE_MINUTES: int = 60

    # 선택 기능: 문서를 저장해 두고 질문과 비슷한 대목을 찾아 답변에 쓰는 기능.
    # 끄면 관련 API가 아예 등록되지 않는다.
    RAG_ENABLED: bool = False
    RAG_EMBEDDING_MODEL: str = "text-embedding-3-small"
    RAG_CHUNK_SIZE: int = 800
    RAG_CHUNK_OVERLAP: int = 100
    RAG_TOP_K: int = 4

    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: object) -> object:
        """허용 출처를 JSON 배열과 쉼표 구분 문자열 양쪽으로 받는다.

        둘 다 받는 이유: 배포 대시보드에 값을 넣을 때 따옴표와 대괄호를 빠뜨리기 쉬운데,
        그러면 설정 파싱이 실패해 서버가 아예 뜨지 않는다(실제로 겪은 문제).

            ["https://a.com","http://localhost:3000"]
            https://a.com, http://localhost:3000
        """
        if not isinstance(value, str):
            return value

        text = value.strip()
        if not text:
            return []

        if text.startswith("["):
            try:
                return json.loads(text)
            except json.JSONDecodeError as exc:
                raise ValueError(
                    "CORS_ORIGINS가 올바른 JSON 배열이 아닙니다. "
                    '예: ["https://내앱.vercel.app","http://localhost:3000"] '
                    "또는 쉼표로 구분해 적으세요."
                ) from exc

        return [origin.strip() for origin in text.split(",") if origin.strip()]

    @field_validator(
        "LLM_BASE_URL",
        "LLM_PRICE_INPUT_PER_1M",
        "LLM_PRICE_OUTPUT_PER_1M",
        mode="before",
    )
    @classmethod
    def _blank_means_unset(cls, value: object) -> object:
        """`.env`에 `KEY=`처럼 비워 둔 값을 '설정하지 않음'으로 본다.

        이게 없으면 비워 둔 숫자 설정에서 파싱 오류가 나서 서버가 아예 뜨지 않는다.
        """
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    @property
    def llm_api_key(self) -> str:
        """실제로 사용할 LLM 키.

        `LLM_API_KEY`를 우선하고, 없으면 공급자 표준 이름(OPENAI_API_KEY 등)을 쓴다.
        """
        if self.LLM_API_KEY:
            return self.LLM_API_KEY

        by_provider = {
            "openai": self.OPENAI_API_KEY,
            "anthropic": self.ANTHROPIC_API_KEY,
            "google_genai": self.GOOGLE_API_KEY,
        }
        return by_provider.get(self.LLM_PROVIDER, "")

    @property
    def admin_emails(self) -> set[str]:
        """ "서버 설정" 화면에 접근할 수 있는 이메일(소문자, 공백 제거)."""
        return {email.strip().lower() for email in self.ADMIN_EMAILS.split(",") if email.strip()}

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

        if self.LLM_PROVIDER != "fake" and not self.llm_api_key:
            raise ValueError("운영 환경에는 LLM_API_KEY가 필요합니다.")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
