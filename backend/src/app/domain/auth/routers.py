"""auth 도메인 - 라우터. 검증·인증·서비스 호출만 한다."""

from fastapi import APIRouter, status

from app.domain.auth.dependencies import AuthServiceDep, CurrentUser
from app.domain.auth.schemas import (
    LoginRequest,
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
