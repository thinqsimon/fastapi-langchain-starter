"""DB 엔진·세션. 테이블 생성은 create_all이 아니라 Alembic 마이그레이션으로만 한다."""

from collections.abc import Generator
from datetime import UTC, datetime

from sqlalchemy import DateTime, create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """모든 ORM 모델의 부모. 새 모델은 alembic/env.py가 인식하도록 app.models에 등록한다."""


class TimestampMixin:
    """생성·수정 시각을 UTC로 기록한다. 모든 테이블이 함께 상속한다.

    `server_default`를 함께 주는 이유: 시드 데이터나 psql 수동 INSERT처럼 ORM을 거치지 않는
    경로에서도 값이 채워져야 하기 때문이다.

    주의: `updated_at`의 자동 갱신(`onupdate`)은 ORM을 거친 UPDATE에만 적용된다.
    대량 UPDATE나 raw SQL로 수정할 때는 값을 직접 넣어야 한다.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        server_default=func.now(),
    )


engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
