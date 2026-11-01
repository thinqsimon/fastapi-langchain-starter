"""preferences 도메인 - 모델 계층.

사용자별 화면 설정. 행이 없으면 기본값을 쓴다(가입할 때마다 행을 만들지 않기 위해).
"""

import uuid

from sqlalchemy import Boolean, ForeignKey, Text, Uuid, false
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class UserPreference(Base, TimestampMixin):
    __tablename__ = "user_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # 상단 헤더 가운데에 보이는 문구. 빈 문자열이면 아무것도 보이지 않는다.
    catchphrase: Mapped[str] = mapped_column(Text, nullable=False)
    # 일기를 저장할 때 맨 끝에 붙는 문구. 빈 문자열이면 붙지 않는다.
    diary_footer: Mapped[str] = mapped_column(Text, nullable=False)


class AnswerPreference(Base, TimestampMixin):
    """채팅 답변에 관한 개인 설정(CHAT-04).

    화면 문구(UserPreference)와 표를 나눈다. 문구의 '기본값으로'는 그 행을 지우는데,
    같은 행에 두면 이 설정까지 함께 꺼지기 때문이다.
    """

    __tablename__ = "answer_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # 답변 끝에 이어서 물어볼 질문 3개를 함께 받는다. 그만큼 답변이 늦어져 기본은 끈다.
    suggest_questions: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
