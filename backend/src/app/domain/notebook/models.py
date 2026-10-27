"""notebook 도메인 - 모델 계층.

학습장(notebook) = /study-notes 스킬이 만든 마크다운 파일 하나.
주제(topic) = 그 안의 `## ` 섹션 하나.
원본 파일은 저장하지 않고 파싱 결과만 남긴다. 앱에서 고친 내용과 완료 표시는 DB에만 있다.
"""

import uuid

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin


class Notebook(Base, TimestampMixin):
    __tablename__ = "notebooks"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # 올린 파일 이름. 직접 만든 학습장은 NULL이며, 유니크 제약에서 NULL끼리는 겹치지 않는다.
    filename: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # frontmatter의 project (노트를 만든 프로젝트 이름)
    project: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 제목 바로 아래 인용(>)으로 쓴 요약
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    topics: Mapped[list["NotebookTopic"]] = relationship(
        back_populates="notebook",
        cascade="all, delete-orphan",
        order_by="NotebookTopic.position",
    )

    # 같은 계정에 같은 파일을 두 번 올리지 않는다(서비스가 409로 거부한다).
    __table_args__ = (UniqueConstraint("user_id", "filename", name="uq_notebooks_user_filename"),)


class NotebookTopic(Base, TimestampMixin):
    __tablename__ = "notebook_topics"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    notebook_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("notebooks.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # 파일 안에서의 순서(1부터). 지운 번호는 다시 쓰지 않는다.
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # 개념 / 문제해결 / 도구·명령어 / 설계결정 / 워크플로 (자유 입력)
    kind: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # 쉼표로 이어 저장한다. API에서는 list[str]로 다룬다.
    tags: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    # 메타 줄의 ★ 개수(1~5)
    difficulty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    completed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    notebook: Mapped["Notebook"] = relationship(back_populates="topics")
