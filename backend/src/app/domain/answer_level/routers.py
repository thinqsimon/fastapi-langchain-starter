"""answer_level 도메인 - 라우터. 목록은 로그인한 누구나, 이름 변경은 관리자만."""

from typing import Annotated

from fastapi import APIRouter, Path

from app.domain.admin.dependencies import AdminUser
from app.domain.answer_level.schemas import AnswerLevelRead, AnswerLevelRename
from app.domain.answer_level.services import AnswerLevelService
from app.domain.auth.dependencies import CurrentUser, DbSession

# 경로 값은 문자열로 들어와 정수 Literal로는 맞출 수 없어 범위 있는 int로 받는다.
LevelPath = Annotated[int, Path(ge=1, le=5, description="단계 번호 1~5")]

router = APIRouter(prefix="/answer-levels", tags=["answer-levels"])
admin_router = APIRouter(prefix="/admin/answer-levels", tags=["admin"])


@router.get(
    "",
    response_model=list[AnswerLevelRead],
    summary="답변 수준 단계 목록",
    description=(
        "1~5단계의 이름(관리자가 바꾼 이름 포함)·대상·답변 방식·예시. 내 단계는 `/api/auth/me`."
    ),
)
def list_answer_levels(_user: CurrentUser, db: DbSession) -> list[AnswerLevelRead]:
    return AnswerLevelService(db).list()


@admin_router.patch(
    "/{level}",
    response_model=AnswerLevelRead,
    summary="단계 이름 바꾸기",
    description=(
        "화면에 보이는 이름만 바뀝니다. 모델에게 주는 지시는 단계 번호로 정해져 그대로입니다."
    ),
    responses={403: {"description": "관리자가 아님"}},
)
def rename_answer_level(
    level: LevelPath, payload: AnswerLevelRename, _admin: AdminUser, db: DbSession
) -> AnswerLevelRead:
    return AnswerLevelService(db).rename(level, payload.name)


@admin_router.delete(
    "/{level}/name",
    response_model=AnswerLevelRead,
    summary="단계 이름을 기본 이름으로",
    responses={403: {"description": "관리자가 아님"}},
)
def reset_answer_level_name(level: LevelPath, _admin: AdminUser, db: DbSession) -> AnswerLevelRead:
    return AnswerLevelService(db).reset(level)
