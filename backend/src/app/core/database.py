"""DB 엔진·세션. 테이블 생성은 create_all이 아니라 Alembic 마이그레이션으로만 한다."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """모든 ORM 모델의 부모. 새 모델은 alembic/env.py가 인식하도록 app.models에 등록한다."""


engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
