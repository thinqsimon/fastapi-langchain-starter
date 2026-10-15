"""인증 의존성. 다른 도메인의 라우터도 보호가 필요하면 여기서 가져다 쓴다."""

import uuid
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import UnauthorizedError
from app.core.security import decode_access_token
from app.domain.auth.models import User
from app.domain.auth.services import AuthService

# auto_error=False로 두고 401 응답을 전역 예외 핸들러에 맡긴다(에러 형식 통일).
_bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_auth_service(db: DbSession) -> AuthService:
    return AuthService(db)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
    auth_service: AuthServiceDep,
) -> User:
    if credentials is None:
        raise UnauthorizedError("인증이 필요합니다.")

    user_id = decode_access_token(credentials.credentials)
    try:
        parsed_id = uuid.UUID(user_id)
    except ValueError as exc:
        raise UnauthorizedError("토큰이 유효하지 않습니다.") from exc

    return auth_service.get_active_user(parsed_id)


CurrentUser = Annotated[User, Depends(get_current_user)]
