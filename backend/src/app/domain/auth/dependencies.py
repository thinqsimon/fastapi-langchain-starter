"""인증 의존성. 다른 도메인의 라우터도 보호가 필요하면 여기서 가져다 쓴다."""

import logging
import uuid
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_claims
from app.domain.auth.models import User
from app.domain.auth.services import AuthService

logger = logging.getLogger(__name__)

# auto_error=False로 두고 401 응답을 전역 예외 핸들러에 맡긴다(에러 형식 통일).
_bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_auth_service(db: DbSession) -> AuthService:
    return AuthService(db)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def blocked_while_acting(method: str, path: str) -> bool:
    """관리자가 다른 계정으로 테스트하는 동안(ADMIN-02) 막는 요청.

    오류를 재현하려면 메시지·일기·학습장을 만들 수 있어야 하므로 쓰기는 허용하고,
    되돌리기 어려운 것만 막는다: 모든 삭제와 계정 자체의 변경(이름·이메일·비밀번호).
    """
    if method == "DELETE":
        return True
    return path.startswith("/api/auth/") and method not in _SAFE_METHODS


def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
    auth_service: AuthServiceDep,
) -> User:
    if credentials is None:
        raise UnauthorizedError("인증이 필요합니다.")

    claims = decode_access_claims(credentials.credentials)
    try:
        parsed_id = uuid.UUID(claims.subject)
    except ValueError as exc:
        raise UnauthorizedError("토큰이 유효하지 않습니다.") from exc

    user = auth_service.get_active_user(parsed_id)

    if claims.actor:
        if blocked_while_acting(request.method, request.url.path):
            raise ForbiddenError("테스트 중에는 삭제·계정 변경을 할 수 없습니다.")
        request.state.acting_admin_id = claims.actor
        if request.method not in _SAFE_METHODS:
            # 누가 어느 계정에 무엇을 남겼는지 추적하도록 쓰기 요청은 모두 기록한다(본문 제외).
            logger.info(
                "admin_test_write admin=%s target=%s method=%s path=%s",
                claims.actor,
                user.id,
                request.method,
                request.url.path,
            )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
