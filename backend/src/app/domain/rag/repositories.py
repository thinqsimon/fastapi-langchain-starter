"""rag 도메인 - 데이터 접근 계층."""

import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.domain.rag.models import DocumentChunk


class DocumentChunkRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def delete_source(self, user_id: uuid.UUID, source: str) -> int:
        """같은 이름의 문서를 다시 올리면 이전 조각을 지운다(중복 검색 방지)."""
        result = self.db.execute(
            delete(DocumentChunk).where(
                DocumentChunk.user_id == user_id, DocumentChunk.source == source
            )
        )
        self.db.flush()
        return int(getattr(result, "rowcount", 0) or 0)

    def add_many(
        self,
        user_id: uuid.UUID,
        source: str,
        chunks: list[tuple[int, str, list[float]]],
    ) -> int:
        self.db.add_all(
            [
                DocumentChunk(
                    user_id=user_id,
                    source=source,
                    position=position,
                    content=content,
                    embedding=embedding,
                )
                for position, content, embedding in chunks
            ]
        )
        self.db.flush()
        return len(chunks)

    def list_sources(self, user_id: uuid.UUID) -> list[tuple[str, int]]:
        rows = self.db.execute(
            select(DocumentChunk.source, func.count(DocumentChunk.id))
            .where(DocumentChunk.user_id == user_id)
            .group_by(DocumentChunk.source)
            .order_by(DocumentChunk.source)
        ).all()
        return [(row[0], int(row[1])) for row in rows]

    def search(
        self, user_id: uuid.UUID, embedding: list[float], limit: int
    ) -> list[tuple[DocumentChunk, float]]:
        """질문 벡터와 코사인 거리가 가까운 조각부터 돌려준다.

        pgvector의 `<=>`는 코사인 거리(0에 가까울수록 비슷함)라, 1에서 빼 유사도로 바꾼다.
        """
        distance = DocumentChunk.embedding.cosine_distance(embedding)
        rows = self.db.execute(
            select(DocumentChunk, distance.label("distance"))
            .where(DocumentChunk.user_id == user_id)
            .order_by(distance)
            .limit(limit)
        ).all()

        return [(row[0], 1.0 - float(row[1])) for row in rows]
