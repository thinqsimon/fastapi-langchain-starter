"""usage 도메인 - 데이터 접근 계층.

사용량은 별도 테이블 없이 messages에 기록된 토큰 수를 집계한다
(한 곳에만 저장해 두 값이 어긋날 일이 없다).
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domain.chat.models import Conversation, Message


class UsageRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def totals_for_user(self, user_id: uuid.UUID) -> tuple[int, int, int]:
        """(메시지 수, 입력 토큰 합, 출력 토큰 합)"""
        row = self.db.execute(
            select(
                func.count(Message.id),
                func.coalesce(func.sum(Message.input_tokens), 0),
                func.coalesce(func.sum(Message.output_tokens), 0),
            )
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(
                Conversation.user_id == user_id,
                Message.role == "assistant",
                Message.input_tokens.is_not(None),
            )
        ).one()

        return int(row[0] or 0), int(row[1] or 0), int(row[2] or 0)
