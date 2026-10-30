"""chat 도메인 - 라우터."""

import logging
import uuid

from fastapi import APIRouter, Request, status
from sse_starlette.sse import EventSourceResponse

from app.core.exceptions import AppError
from app.domain.auth.dependencies import CurrentUser, DbSession
from app.domain.chat.schemas import (
    ConversationCreate,
    ConversationDetail,
    ConversationRead,
    ConversationUpdate,
    MessageCreate,
    MessageRead,
)
from app.domain.chat.services import ChatService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversations", tags=["chat"])


def _service(db: DbSession) -> ChatService:
    return ChatService(db)


@router.post(
    "",
    response_model=ConversationRead,
    status_code=status.HTTP_201_CREATED,
    summary="대화 만들기",
)
def create_conversation(
    payload: ConversationCreate, current_user: CurrentUser, db: DbSession
) -> ConversationRead:
    conversation = _service(db).create_conversation(current_user.id, payload.title)
    return ConversationRead.model_validate(conversation)


@router.get("", response_model=list[ConversationRead], summary="내 대화 목록")
def list_conversations(current_user: CurrentUser, db: DbSession) -> list[ConversationRead]:
    conversations = _service(db).list_conversations(current_user.id)
    return [ConversationRead.model_validate(item) for item in conversations]


@router.get(
    "/{conversation_id}",
    response_model=ConversationDetail,
    summary="대화 상세(메시지 포함)",
    responses={404: {"description": "없거나 내 대화가 아님"}},
)
def get_conversation(
    conversation_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> ConversationDetail:
    conversation = _service(db).get_conversation(conversation_id, current_user.id)
    return ConversationDetail.model_validate(conversation)


@router.patch("/{conversation_id}", response_model=ConversationRead)
def rename_conversation(
    conversation_id: uuid.UUID,
    payload: ConversationUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> ConversationRead:
    conversation = _service(db).rename_conversation(conversation_id, current_user.id, payload.title)
    return ConversationRead.model_validate(conversation)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    _service(db).delete_conversation(conversation_id, current_user.id)


@router.get("/{conversation_id}/messages", response_model=list[MessageRead])
def list_messages(
    conversation_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> list[MessageRead]:
    messages = _service(db).list_messages(conversation_id, current_user.id)
    return [MessageRead.model_validate(item) for item in messages]


@router.post(
    "/{conversation_id}/stream",
    summary="메시지 보내고 응답 스트리밍 받기",
    description=(
        "`text/event-stream`으로 응답합니다.\n\n"
        "- `event: token` — 생성된 조각\n"
        "- `event: done` — 완료(이 시점에 이력이 저장됩니다)\n"
        "- `event: error` — 실패 사유\n\n"
        "Swagger에서는 스트리밍이 잘 보이지 않으니 curl로 확인하세요."
    ),
)
async def stream_message(
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
) -> EventSourceResponse:
    """SSE로 응답 토큰을 흘려보낸다. 이벤트 형식은 docs/conventions.md 참고."""
    service = ChatService(db, system_prompt=request.app.state.chat_system_prompt)

    async def events():
        try:
            async for chunk in service.stream_answer(
                conversation_id, current_user.id, payload.content, plan=current_user.plan
            ):
                yield {"event": "token", "data": chunk}
        except AppError as exc:
            # 스트림이 시작된 뒤엔 상태 코드를 바꿀 수 없어 이벤트로 알린다.
            logger.warning("stream_failed code=%s message=%s", exc.code, exc.message)
            yield {"event": "error", "data": exc.message}
        except Exception:
            # 내부 메시지(스택·키 관련 문구 등)는 클라이언트로 내보내지 않는다.
            logger.exception("stream_failed_unexpectedly conversation_id=%s", conversation_id)
            yield {"event": "error", "data": "응답을 생성하지 못했습니다."}
        else:
            yield {"event": "done", "data": ""}

    return EventSourceResponse(events())
