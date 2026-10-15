"""Alembic autogenerate가 모든 모델을 인식하도록 모아서 import하는 곳.

새 도메인 모델을 만들면 여기에 import를 추가한다.
"""

from app.core.database import Base

__all__ = ["Base"]
