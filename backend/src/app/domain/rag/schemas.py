"""rag 도메인 - 요청/응답 스키마."""

import uuid

from pydantic import BaseModel, ConfigDict, Field


class DocumentCreate(BaseModel):
    source: str = Field(min_length=1, max_length=200, description="문서 이름(파일명 등)")
    content: str = Field(min_length=1, max_length=200_000)


class DocumentIndexed(BaseModel):
    source: str
    chunk_count: int


class DocumentSummary(BaseModel):
    source: str
    chunk_count: int


class SearchHit(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source: str
    position: int
    content: str
    # 1에 가까울수록 질문과 비슷하다.
    similarity: float


class SearchResponse(BaseModel):
    query: str
    hits: list[SearchHit]
