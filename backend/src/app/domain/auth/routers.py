"""auth 도메인 - 라우터. 검증·인증·서비스 호출만 한다."""

from fastapi import APIRouter, status

from app.domain.auth.dependencies import AuthServiceDep, CurrentUser
from app.domain.auth.schemas import (
    EmailChange,
    LoginRequest,
    PasswordChange,
    ProfileUpdate,
    RefreshRequest,
    SignupRequest,
    TokenPair,
    UserRead,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/signup",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="회원가입",
    responses={409: {"description": "이미 가입된 이메일"}},
)
def signup(payload: SignupRequest, auth_service: AuthServiceDep) -> UserRead:
    user = auth_service.signup(
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
    )
    return UserRead.model_validate(user)


@router.post(
    "/login",
    response_model=TokenPair,
    summary="로그인",
    responses={401: {"description": "이메일 또는 비밀번호가 올바르지 않음"}},
)
def login(payload: LoginRequest, auth_service: AuthServiceDep) -> TokenPair:
    return auth_service.login(email=payload.email, password=payload.password)


@router.post(
    "/refresh",
    response_model=TokenPair,
    summary="토큰 재발급",
    description="새 토큰 쌍을 돌려주고, 사용한 리프레시 토큰은 폐기합니다.",
    responses={401: {"description": "토큰이 유효하지 않거나 만료됨"}},
)
def refresh(payload: RefreshRequest, auth_service: AuthServiceDep) -> TokenPair:
    return auth_service.refresh(payload.refresh_token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="로그아웃",
    description="리프레시 토큰을 폐기합니다. 이미 폐기된 토큰을 보내도 성공합니다.",
)
def logout(payload: RefreshRequest, auth_service: AuthServiceDep) -> None:
    auth_service.logout(payload.refresh_token)


@router.get("/me", response_model=UserRead, summary="내 정보")
def read_me(current_user: CurrentUser) -> UserRead:
    return UserRead.model_validate(current_user)


@router.patch("/me", response_model=UserRead, summary="내 정보 수정(이름)")
def update_me(
    payload: ProfileUpdate, current_user: CurrentUser, auth_service: AuthServiceDep
) -> UserRead:
    return UserRead.model_validate(auth_service.update_profile(current_user, payload.display_name))


@router.put(
    "/me/email",
    response_model=UserRead,
    summary="이메일 변경",
    description="로그인 ID가 바뀌므로 현재 비밀번호를 확인합니다.",
    responses={
        400: {"description": "현재 비밀번호가 올바르지 않음 (WRONG_PASSWORD)"},
        409: {"description": "이미 사용 중인 이메일"},
    },
)
def change_email(
    payload: EmailChange, current_user: CurrentUser, auth_service: AuthServiceDep
) -> UserRead:
    user = auth_service.change_email(current_user, payload.email, payload.current_password)
    return UserRead.model_validate(user)


@router.put(
    "/me/password",
    response_model=TokenPair,
    summary="비밀번호 변경",
    description=(
        "현재 비밀번호를 확인한 뒤 바꿉니다. **다른 기기의 로그인은 모두 끊기고**, "
        "지금 화면에서 쓸 새 토큰을 돌려줍니다."
    ),
    responses={400: {"description": "현재 비밀번호가 올바르지 않음 (WRONG_PASSWORD)"}},
)
def change_password(
    payload: PasswordChange, current_user: CurrentUser, auth_service: AuthServiceDep
) -> TokenPair:
    return auth_service.change_password(
        current_user, payload.current_password, payload.new_password
    )
