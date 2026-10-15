"""rag 도메인 - 라우터 (선택 기능).

`RAG_ENABLED=false`면 이 라우터는 등록되지 않는다(app/api.py 참고).
"""

from fastapi import APIRouter, status

from app.domain.auth.dependencies import CurrentUser, DbSession
from app.domain.rag.schemas import (
    DocumentCreate,
    DocumentIndexed,
    DocumentSummary,
    SearchResponse,
)
from app.domain.rag.services import RagService

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post(
    "/documents",
    response_model=DocumentIndexed,
    status_code=status.HTTP_201_CREATED,
    summary="문서 저장(조각내어 임베딩)",
    description="같은 이름으로 다시 올리면 이전 내용을 대체합니다.",
)
def index_document(
    payload: DocumentCreate, current_user: CurrentUser, db: DbSession
) -> DocumentIndexed:
    count = RagService(db).index_document(current_user.id, payload.source, payload.content)
    return DocumentIndexed(source=payload.source, chunk_count=count)


@router.get("/documents", response_model=list[DocumentSummary], summary="내 문서 목록")
def list_documents(current_user: CurrentUser, db: DbSession) -> list[DocumentSummary]:
    return [
        DocumentSummary(source=source, chunk_count=count)
        for source, count in RagService(db).list_documents(current_user.id)
    ]


@router.delete(
    "/documents/{source}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="문서 삭제",
    responses={404: {"description": "없거나 내 문서가 아님"}},
)
def delete_document(source: str, current_user: CurrentUser, db: DbSession) -> None:
    RagService(db).delete_document(current_user.id, source)


@router.get(
    "/search",
    response_model=SearchResponse,
    summary="문서에서 비슷한 대목 찾기",
    description="질문과 의미가 가까운 조각을 유사도 순으로 돌려줍니다.",
)
def search(q: str, current_user: CurrentUser, db: DbSession, limit: int = 4) -> SearchResponse:
    return SearchResponse(query=q, hits=RagService(db).search(current_user.id, q, limit))
