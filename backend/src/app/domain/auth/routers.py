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


@router.post("/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, auth_service: AuthServiceDep) -> UserRead:
    user = auth_service.signup(
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
    )
    return UserRead.model_validate(user)


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, auth_service: AuthServiceDep) -> TokenPair:
    return auth_service.login(email=payload.email, password=payload.password)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, auth_service: AuthServiceDep) -> TokenPair:
    return auth_service.refresh(payload.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshRequest, auth_service: AuthServiceDep) -> None:
    auth_service.logout(payload.refresh_token)


@router.get("/me", response_model=UserRead)
def read_me(current_user: CurrentUser) -> UserRead:
    return UserRead.model_validate(current_user)
