"""Alembic autogenerate가 모든 모델을 인식하도록 모아서 import하는 곳.

새 도메인 모델을 만들면 여기에 import를 추가한다.
"""

from app.core.database import Base
from app.domain.auth.models import RefreshToken, User
from app.domain.chat.models import Conversation, Message
from app.domain.diary.models import DiaryEntry
from app.domain.preferences.models import UserPreference
from app.domain.rag.models import DocumentChunk

__all__ = [
    "Base",
    "Conversation",
    "DiaryEntry",
    "DocumentChunk",
    "Message",
    "RefreshToken",
    "User",
    "UserPreference",
]
