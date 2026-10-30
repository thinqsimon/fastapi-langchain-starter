"""admin 도메인 - 모델 계층.

관리자가 "관리자" 화면에서 등록하는 LLM 설정(ADMIN-01·03). 사용자별이 아니라 서버 전역 설정이다.
- `LlmProvider`: 공급자(OpenAI/Claude/Gemini)별 **API 키**. 공급자당 1행, Fernet 암호화 값만 저장.
- `LlmPlanRoute`: **요금제(free/pro/max)별 라우팅**. 어떤 공급자의 어떤 모델을 어떤 순서로 쓸지.

키와 라우팅을 나눈 이유: 요금제마다 모델·순서는 다르지만 키는 공급자당 하나다. 한 테이블에 두면
요금제 수만큼 키가 복제되고, 키를 바꿀 때 여러 행을 고쳐야 한다.
"""

import uuid

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
    false,
    func,
    text,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class LlmProvider(Base, TimestampMixin):
    __tablename__ = "llm_providers"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    # langchain init_chat_model()의 model_provider 표준 이름과 맞춘다.
    provider: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    # None이면 이 공급자는 아직 키가 없어 어떤 요금제에서도 쓰이지 않는다.
    encrypted_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)


class LlmPlanRoute(Base, TimestampMixin):
    __tablename__ = "llm_plan_routes"
    __table_args__ = (
        Index("ix_llm_plan_routes_plan_priority", "plan", "priority"),
        # "강제 사용"은 요금제당 한 행만. 부분 유니크 인덱스로 DB가 직접 막는다.
        Index(
            "uq_llm_plan_routes_single_forced_per_plan",
            "plan",
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
    # app.core.plans.PlanName 값. 요금제가 늘어도 스키마는 그대로다.
    plan: Mapped[str] = mapped_column(String(16), nullable=False)
    # 작을수록 먼저 시도한다.
    priority: Mapped[int] = mapped_column(Integer, nullable=False)
    provider: Mapped[str] = mapped_column(
        String(32), ForeignKey("llm_providers.provider", ondelete="CASCADE"), nullable=False
    )
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    # True면 이 요금제에서는 우선순위·자동 전환을 무시하고 이 라우트만 쓴다.
    forced: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
