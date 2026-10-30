"""auth 도메인 - 모델 계층.

스타터킷의 공통 사용자 테이블이다. 서비스마다 달라지는 항목(프로필, 약관 동의, 권한 등)은
Fork한 쪽에서 컬럼을 추가하고 `make migration`으로 마이그레이션을 만든다.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Uuid, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.core.plans import DEFAULT_PLAN


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # 평문 비밀번호는 저장하지 않는다. bcrypt 해시만 들어간다(AUTH-01).
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(50), nullable=False)
    # 탈퇴·정지된 사용자는 행을 지우지 않고 비활성으로 둔다(대화 이력이 남아야 하므로).
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    # 요금제(free/pro/max, app.core.plans). LLM 라우팅이 이 값으로 갈린다(ADMIN-03).
    # 지금은 관리자가 손으로 바꾸고, 구독 결제가 생기면 그쪽이 채운다.
    plan: Mapped[str] = mapped_column(
        String(16), nullable=False, default=DEFAULT_PLAN, server_default=DEFAULT_PLAN
    )

    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class RefreshToken(Base, TimestampMixin):
    """발급한 리프레시 토큰. 로그아웃·토큰 회전·탈취 대응을 위해 서버에 상태를 남긴다."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    # 토큰 원문이 아니라 SHA-256 해시를 저장한다. DB가 유출돼도 토큰을 쓸 수 없다.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # 로그아웃하거나 새 토큰으로 교체되면 시각을 남긴다. NULL이면 아직 유효.
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")
