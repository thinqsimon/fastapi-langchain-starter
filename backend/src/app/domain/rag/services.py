"""rag 도메인 - 비즈니스 로직 (선택 기능)."""

import logging
import uuid

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import LLMError, NotFoundError
from app.domain.rag.repositories import DocumentChunkRepository
from app.domain.rag.schemas import SearchHit
from app.llm.rag.embeddings import get_embeddings
from app.llm.rag.splitter import split_text

logger = logging.getLogger(__name__)


class RagService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.chunks = DocumentChunkRepository(db)

    def index_document(self, user_id: uuid.UUID, source: str, content: str) -> int:
        """문서를 조각내 임베딩과 함께 저장한다. 같은 이름이면 기존 조각을 대체한다."""
        pieces = split_text(
            content,
            chunk_size=settings.RAG_CHUNK_SIZE,
            overlap=settings.RAG_CHUNK_OVERLAP,
        )
        if not pieces:
            raise NotFoundError("저장할 내용이 없습니다.")

        try:
            vectors = get_embeddings().embed_documents(pieces)
        except Exception as exc:
            raise LLMError("임베딩을 만들지 못했습니다.") from exc

        removed = self.chunks.delete_source(user_id, source)
        count = self.chunks.add_many(
            user_id,
            source,
            [
                (index, piece, vector)
                for index, (piece, vector) in enumerate(zip(pieces, vectors, strict=True))
            ],
        )
        self.db.commit()

        logger.info(
            "document_indexed user_id=%s source=%s chunks=%s replaced=%s",
            user_id,
            source,
            count,
            removed,
        )
        return count

    def list_documents(self, user_id: uuid.UUID) -> list[tuple[str, int]]:
        return self.chunks.list_sources(user_id)

    def delete_document(self, user_id: uuid.UUID, source: str) -> None:
        if self.chunks.delete_source(user_id, source) == 0:
            raise NotFoundError("문서를 찾을 수 없습니다.")
        self.db.commit()

    def search(self, user_id: uuid.UUID, query: str, limit: int | None = None) -> list[SearchHit]:
        try:
            vector = get_embeddings().embed_query(query)
        except Exception as exc:
            raise LLMError("질문을 임베딩하지 못했습니다.") from exc

        found = self.chunks.search(user_id, vector, limit or settings.RAG_TOP_K)
        return [
            SearchHit(
                id=chunk.id,
                source=chunk.source,
                position=chunk.position,
                content=chunk.content,
                similarity=round(similarity, 4),
            )
            for chunk, similarity in found
        ]
