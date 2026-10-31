"""admin 도메인 - 라우터. 관리자(설정 파일의 ADMIN_EMAILS) 전용."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Query, Response, status

from app.domain.admin.dependencies import AdminUser
from app.domain.admin.schemas import (
    ActingTokenResponse,
    AdminUserRead,
    LlmProviderName,
    PasswordResetDefaultRead,
    PasswordResetRequest,
    PasswordResetResponse,
    PlanUpdate,
    ProviderKeyRead,
    ProviderKeyUpdate,
    RouteCreate,
    RouteRead,
    RouteUpdate,
)
from app.domain.admin.services import AdminLlmSettingsService, AdminUserService
from app.domain.auth.dependencies import DbSession

router = APIRouter(prefix="/admin", tags=["admin"])

FORBIDDEN: dict[int | str, dict[str, Any]] = {403: {"description": "관리자가 아님"}}


@router.get(
    "/llm-providers",
    response_model=list[ProviderKeyRead],
    summary="공급자별 API 키 상태",
    responses=FORBIDDEN,
)
def list_providers(_admin: AdminUser, db: DbSession) -> list[ProviderKeyRead]:
    """OpenAI/Claude/Gemini 세 공급자를 항상 돌려준다(처음이면 키 없는 행을 만들어 둔다)."""
    return AdminLlmSettingsService(db).list_providers()


@router.patch(
    "/llm-providers/{provider}",
    response_model=ProviderKeyRead,
    summary="공급자 API 키 저장/삭제",
    description="`api_key`를 보내면 암호화해 저장합니다. 빈 문자열이나 null이면 키를 지웁니다.",
    responses={**FORBIDDEN, 503: {"description": "SETTINGS_ENCRYPTION_KEY 미설정"}},
)
def update_provider_key(
    provider: LlmProviderName, payload: ProviderKeyUpdate, _admin: AdminUser, db: DbSession
) -> ProviderKeyRead:
    return AdminLlmSettingsService(db).update_provider_key(provider, payload)


@router.get(
    "/llm-routes",
    response_model=list[RouteRead],
    summary="요금제별 라우팅 목록",
    description="요금제(free/pro/max)마다 어느 공급자의 어느 모델을 어떤 순서로 쓰는지.",
    responses=FORBIDDEN,
)
def list_routes(_admin: AdminUser, db: DbSession) -> list[RouteRead]:
    return AdminLlmSettingsService(db).list_routes()


@router.post(
    "/llm-routes",
    response_model=RouteRead,
    status_code=status.HTTP_201_CREATED,
    summary="라우트 추가",
    description="그 요금제의 맨 뒤 순서로 추가됩니다. 공급자 키가 없으면 켜도 쓰이지 않습니다.",
    responses=FORBIDDEN,
)
def create_route(payload: RouteCreate, _admin: AdminUser, db: DbSession) -> RouteRead:
    return AdminLlmSettingsService(db).create_route(payload)


@router.post(
    "/llm-routes/defaults",
    response_model=list[RouteRead],
    status_code=status.HTTP_201_CREATED,
    summary="요금제에 기본 라우트(모델 사다리) 넣기",
    description=(
        "라우트가 하나도 없는 요금제에 기본값을 넣습니다. Free는 가장 싼 모델, "
        "Pro·Max는 공급자마다 한 단계씩 비싼 모델입니다(app/domain/admin/defaults.py). "
        "이미 라우트가 있으면 409."
    ),
    responses={**FORBIDDEN, 409: {"description": "이미 라우트가 있음"}},
)
def seed_default_routes(payload: PlanUpdate, _admin: AdminUser, db: DbSession) -> list[RouteRead]:
    return AdminLlmSettingsService(db).seed_default_routes(payload.plan)


@router.patch(
    "/llm-routes/{route_id}",
    response_model=RouteRead,
    summary="라우트 변경",
    description=(
        "보낸 필드만 바뀝니다(model, priority, enabled, forced). "
        "`forced: true`면 같은 요금제의 다른 라우트 강제는 자동으로 꺼집니다."
    ),
    responses={**FORBIDDEN, 404: {"description": "라우트를 찾을 수 없음"}},
)
def update_route(
    route_id: uuid.UUID, payload: RouteUpdate, _admin: AdminUser, db: DbSession
) -> RouteRead:
    return AdminLlmSettingsService(db).update_route(route_id, payload)


@router.delete(
    "/llm-routes/{route_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="라우트 삭제",
    responses={**FORBIDDEN, 404: {"description": "라우트를 찾을 수 없음"}},
)
def delete_route(route_id: uuid.UUID, _admin: AdminUser, db: DbSession) -> Response:
    AdminLlmSettingsService(db).delete_route(route_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/users",
    response_model=list[AdminUserRead],
    summary="사용자 검색",
    description="이메일이나 이름에 `q`가 들어간 사용자를 최근 가입순으로 돌려줍니다.",
    responses=FORBIDDEN,
)
def search_users(
    _admin: AdminUser,
    db: DbSession,
    q: Annotated[str, Query(min_length=1, max_length=100, description="이메일 또는 이름 일부")],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> list[AdminUserRead]:
    return AdminUserService(db).search(q, limit)


@router.patch(
    "/users/{user_id}/plan",
    response_model=AdminUserRead,
    summary="사용자 요금제 지정",
    description=(
        "free/pro/max. 구독 결제가 붙기 전까지 관리자가 손으로 바꿉니다. "
        "바로 다음 요청부터 그 요금제의 라우팅을 탑니다."
    ),
    responses={**FORBIDDEN, 404: {"description": "사용자를 찾을 수 없음"}},
)
def set_user_plan(
    user_id: uuid.UUID, payload: PlanUpdate, admin: AdminUser, db: DbSession
) -> AdminUserRead:
    return AdminUserService(db).set_plan(admin, user_id, payload.plan)


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
        **FORBIDDEN,
        404: {"description": "사용자를 찾을 수 없음"},
    },
)
def create_acting_token(user_id: uuid.UUID, admin: AdminUser, db: DbSession) -> ActingTokenResponse:
    return AdminUserService(db).create_acting_token(admin, user_id)


@router.get(
    "/password-reset/default",
    response_model=PasswordResetDefaultRead,
    summary="기본 초기화 암호",
    description=(
        "'기본 암호로 초기화'에 쓰는 값입니다. 서버 설정 `ADMIN_RESET_PASSWORD_DEFAULT`, "
        "없으면 `12345678`. 관리자가 사용자에게 알려 주려고 화면에 보여 줍니다."
    ),
    responses={**FORBIDDEN, 503: {"description": "서버 설정이 8~72자가 아님"}},
)
def read_password_reset_default(_admin: AdminUser, db: DbSession) -> PasswordResetDefaultRead:
    return PasswordResetDefaultRead(password=AdminUserService(db).password_reset_default())


@router.post(
    "/users/{user_id}/password-reset",
    response_model=PasswordResetResponse,
    summary="비밀번호 초기화",
    description=(
        "비밀번호를 잊은 사용자에게 관리자가 새 비밀번호를 정해 줍니다. `password`를 비우면 "
        "기본 암호로 바꿉니다. 그 계정의 다른 로그인(리프레시 토큰)은 모두 끊깁니다. "
        "관리자 계정은 대상이 아닙니다(403)."
    ),
    responses={
        **FORBIDDEN,
        404: {"description": "사용자를 찾을 수 없음"},
        503: {"description": "기본 암호 설정이 8~72자가 아님"},
    },
)
def reset_user_password(
    user_id: uuid.UUID, payload: PasswordResetRequest, admin: AdminUser, db: DbSession
) -> PasswordResetResponse:
    return AdminUserService(db).reset_password(admin, user_id, payload.password)


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="사용자 삭제",
    description=(
        "계정과 그 계정의 대화·일기·학습장 기록을 모두 지웁니다. 되돌릴 수 없습니다. "
        "쿠폰은 발급·사용 기록이 남고 사용자 칸만 비워집니다. 관리자 계정은 대상이 아닙니다(403)."
    ),
    responses={**FORBIDDEN, 404: {"description": "사용자를 찾을 수 없음"}},
)
def delete_user(user_id: uuid.UUID, admin: AdminUser, db: DbSession) -> Response:
    AdminUserService(db).delete_user(admin, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
