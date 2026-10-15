"""rag 도메인 - 모델 계층 (선택 기능).

문서를 조각내어 임베딩과 함께 저장한다. 질문이 들어오면 비슷한 조각을 찾아 답변 근거로 쓴다.
"""

import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Index, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin
from app.llm.rag.embeddings import EMBEDDING_DIMENSIONS


class DocumentChunk(Base, TimestampMixin):
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # 어떤 문서에서 나온 조각인지(파일명 등). 같은 이름이면 같은 문서로 본다.
    source: Mapped[str] = mapped_column(String(200), nullable=False)
    # 문서 안에서의 순서. 사람이 원문을 찾아볼 때 쓴다.
    position: Mapped[int] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIMENSIONS), nullable=False)

    __table_args__ = (Index("ix_document_chunks_user_id_source", "user_id", "source"),)
