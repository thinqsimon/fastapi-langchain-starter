"""preferences 도메인 - 모델 계층.

사용자별 화면 설정. 행이 없으면 기본값을 쓴다(가입할 때마다 행을 만들지 않기 위해).
"""

import uuid

from sqlalchemy import ForeignKey, Text, Uuid
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
