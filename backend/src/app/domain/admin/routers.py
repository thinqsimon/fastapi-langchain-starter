"""admin 도메인 - 라우터. 관리자(설정 파일의 ADMIN_EMAILS) 전용."""

from fastapi import APIRouter

from app.domain.admin.dependencies import AdminUser
from app.domain.admin.schemas import LlmProviderName, ProviderSettingRead, ProviderSettingUpdate
from app.domain.admin.services import AdminLlmSettingsService
from app.domain.auth.dependencies import DbSession

router = APIRouter(prefix="/admin/llm-providers", tags=["admin"])


@router.get(
    "",
    response_model=list[ProviderSettingRead],
    summary="공급자별 서버 설정 목록",
    responses={403: {"description": "관리자가 아님"}},
)
def list_providers(_admin: AdminUser, db: DbSession) -> list[ProviderSettingRead]:
    """OpenAI/Claude/Gemini 세 공급자를 항상 돌려준다(처음이면 빈 설정으로 만들어 둔다)."""
    return AdminLlmSettingsService(db).list_providers()


@router.patch(
    "/{provider}",
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
