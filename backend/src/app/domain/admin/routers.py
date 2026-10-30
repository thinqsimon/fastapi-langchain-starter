"""admin 도메인 - 라우터. 관리자(설정 파일의 ADMIN_EMAILS) 전용."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.domain.admin.dependencies import AdminUser
from app.domain.admin.schemas import (
    ActingTokenResponse,
    AdminUserRead,
    LlmProviderName,
    ProviderSettingRead,
    ProviderSettingUpdate,
)
from app.domain.admin.services import AdminLlmSettingsService, AdminUserService
from app.domain.auth.dependencies import DbSession

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get(
    "/llm-providers",
    response_model=list[ProviderSettingRead],
    summary="공급자별 서버 설정 목록",
    responses={403: {"description": "관리자가 아님"}},
)
def list_providers(_admin: AdminUser, db: DbSession) -> list[ProviderSettingRead]:
    """OpenAI/Claude/Gemini 세 공급자를 항상 돌려준다(처음이면 빈 설정으로 만들어 둔다)."""
    return AdminLlmSettingsService(db).list_providers()


@router.patch(
    "/llm-providers/{provider}",
    response_model=ProviderSettingRead,
    summary="공급자 설정 변경",
    description=(
        "보낸 필드만 바뀝니다. `api_key`를 보내지 않으면 저장된 키를 그대로 둡니다. "
        "빈 문자열이나 null을 보내면 키를 지웁니다(이 공급자는 더는 쓰이지 않습니다). "
        "`forced: true`를 보내면 다른 공급자의 강제 사용은 자동으로 꺼집니다."
    ),
    responses={
        403: {"description": "관리자가 아님"},
        404: {"description": "공급자를 찾을 수 없음"},
    },
)
def update_provider(
    provider: LlmProviderName,
    payload: ProviderSettingUpdate,
    _admin: AdminUser,
    db: DbSession,
) -> ProviderSettingRead:
    return AdminLlmSettingsService(db).update_provider(provider, payload)


@router.get(
    "/users",
    response_model=list[AdminUserRead],
    summary="사용자 검색",
    description="이메일이나 이름에 `q`가 들어간 사용자를 최근 가입순으로 돌려줍니다.",
    responses={403: {"description": "관리자가 아님"}},
)
def search_users(
    _admin: AdminUser,
    db: DbSession,
    q: Annotated[str, Query(min_length=1, max_length=100, description="이메일 또는 이름 일부")],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> list[AdminUserRead]:
    return AdminUserService(db).search(q, limit)


@router.post(
    "/users/{user_id}/acting-token",
    response_model=ActingTokenResponse,
    summary="이 계정으로 테스트 시작",
    description=(
        "사용자가 신고한 오류를 재현하려고 그 계정 명의의 액세스 토큰을 받습니다. "
        "읽기·쓰기는 되지만 **삭제와 계정 변경(이름·이메일·비밀번호)은 403**으로 "
        "막힙니다. 리프레시 토큰은 없으며 `ADMIN_TEST_TOKEN_EXPIRE_MINUTES`가 지나면 만료됩니다. "
        "시작과 쓰기 요청은 서버 로그에 남습니다."
    ),
    responses={
        400: {"description": "자기 계정"},
        403: {"description": "관리자가 아님"},
        404: {"description": "사용자를 찾을 수 없음"},
    },
)
def create_acting_token(user_id: uuid.UUID, admin: AdminUser, db: DbSession) -> ActingTokenResponse:
    return AdminUserService(db).create_acting_token(admin, user_id)
