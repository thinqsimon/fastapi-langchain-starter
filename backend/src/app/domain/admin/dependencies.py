"""admin 도메인 - 의존성. 관리자 전용 라우터를 이걸로 보호한다."""

from typing import Annotated

from fastapi import Depends

from app.core.config import settings
from app.core.exceptions import ForbiddenError
from app.domain.auth.dependencies import CurrentUser
from app.domain.auth.models import User


def require_admin(current_user: CurrentUser) -> User:
    if current_user.email.lower() not in settings.admin_emails:
        raise ForbiddenError("관리자만 접근할 수 있습니다.")
    return current_user


AdminUser = Annotated[User, Depends(require_admin)]
