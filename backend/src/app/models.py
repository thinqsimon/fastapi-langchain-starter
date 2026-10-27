"""Alembic autogenerate가 모든 모델을 인식하도록 모아서 import하는 곳.

새 도메인 모델을 만들면 여기에 import를 추가한다.
실행 프로필과 무관하게 전체 메타데이터를 유지한다. starter로 실행한다고
이미 적용한 샘플 테이블이나 마이그레이션 이력이 삭제되어서는 안 된다.
"""

from app.core.database import Base
from app.domain.auth.models import RefreshToken, User
from app.domain.chat.models import Conversation, Message
from app.domain.diary.models import DiaryEntry, DiaryStudyProgress, SavedWeeklyReview
from app.domain.notebook.models import Notebook, NotebookTopic
from app.domain.preferences.models import UserPreference
from app.domain.rag.models import DocumentChunk

__all__ = [
    "Base",
    "Conversation",
    "DiaryEntry",
    "DiaryStudyProgress",
    "DocumentChunk",
    "Message",
    "Notebook",
    "NotebookTopic",
    "RefreshToken",
    "SavedWeeklyReview",
    "User",
    "UserPreference",
]
