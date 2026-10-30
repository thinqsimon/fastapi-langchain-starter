"""admin 도메인 - 모델 계층.

관리자가 "서버 설정" 화면에서 등록하는 LLM 공급자별 설정이다. 사용자별이 아니라 전역 설정이라
공급자(OpenAI/Claude/Gemini)마다 행이 하나씩만 있다. API 키는 평문으로 저장하지 않고
Fernet으로 암호화한 값만 둔다(app.core.security.encrypt_secret).
"""

import uuid

from sqlalchemy import Boolean, Index, Integer, String, Text, Uuid, false, func, text, true
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class LlmProviderSetting(Base, TimestampMixin):
    __tablename__ = "llm_provider_settings"
    __table_args__ = (
        # "강제 사용"은 한 번에 한 공급자만 가능하다. 부분 유니크 인덱스로 DB가 직접 막는다
        # (서비스 로직에서 다른 행의 forced를 끄고 commit하기 전에 요청이 겹쳐도 안전하다).
        Index(
            "uq_llm_provider_settings_single_forced",
            "forced",
            unique=True,
            postgresql_where=text("forced"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    # langchain init_chat_model()의 model_provider 표준 이름과 맞춘다.
    provider: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    # None이면 이 공급자는 아직 키가 없어 우선순위 목록에서 쓰이지 않는다.
    encrypted_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 작을수록 먼저 시도한다. 여러 공급자가 같은 값이어도 동작은 하지만 화면에서는 겹치지 않게 둔다.
    priority: Mapped[int] = mapped_column(Integer, nullable=False)
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    # True면 우선순위·자동 장애 조치를 무시하고 이 공급자만 쓴다.
    forced: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
