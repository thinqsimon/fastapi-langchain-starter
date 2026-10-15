"""auth 도메인 - 비즈니스 로직. 트랜잭션 경계를 여기서 잡는다."""

import logging
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expires_at,
    verify_password,
)
from app.domain.auth.models import User
from app.domain.auth.repositories import RefreshTokenRepository, UserRepository
from app.domain.auth.schemas import TokenPair

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.refresh_tokens = RefreshTokenRepository(db)

    def signup(self, email: str, password: str, display_name: str) -> User:
        if self.users.get_by_email(email):
            raise ConflictError("이미 가입된 이메일입니다.")

        user = self.users.create(
            email=email,
            password_hash=hash_password(password),
            display_name=display_name,
        )
        self.db.commit()
        logger.info("user_signed_up user_id=%s", user.id)
        return user

    def login(self, email: str, password: str) -> TokenPair:
        user = self.users.get_by_email(email)

        # 이메일이 없는 경우와 비밀번호가 틀린 경우를 구분해 알려주지 않는다
        # (가입 여부를 알아내는 데 쓰이지 않도록).
        if user is None or not verify_password(password, user.password_hash):
            raise UnauthorizedError("이메일 또는 비밀번호가 올바르지 않습니다.")

        if not user.is_active:
            raise UnauthorizedError("비활성화된 계정입니다.")

        tokens = self._issue_tokens(user.id)
        self.db.commit()
        logger.info("user_logged_in user_id=%s", user.id)
        return tokens

    def refresh(self, refresh_token: str) -> TokenPair:
        """리프레시 토큰을 새 토큰 쌍으로 교환한다(한 번 쓴 토큰은 폐기한다)."""
        stored = self.refresh_tokens.get_usable(hash_refresh_token(refresh_token))
        if stored is None:
            raise UnauthorizedError("리프레시 토큰이 유효하지 않거나 만료되었습니다.")

        self.refresh_tokens.revoke(stored)
        tokens = self._issue_tokens(stored.user_id)
        self.db.commit()
        logger.info("token_refreshed user_id=%s", stored.user_id)
        return tokens

    def logout(self, refresh_token: str) -> None:
        stored = self.refresh_tokens.get_usable(hash_refresh_token(refresh_token))
        if stored is not None:
            self.refresh_tokens.revoke(stored)
            self.db.commit()
            logger.info("user_logged_out user_id=%s", stored.user_id)

    def get_active_user(self, user_id: uuid.UUID) -> User:
        user = self.users.get_by_id(user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("사용자를 찾을 수 없습니다.")
        return user

    def _issue_tokens(self, user_id: uuid.UUID) -> TokenPair:
        refresh_token = generate_refresh_token()
        self.refresh_tokens.create(
            user_id=user_id,
            token_hash=hash_refresh_token(refresh_token),
            expires_at=refresh_token_expires_at(),
        )
        return TokenPair(
            access_token=create_access_token(str(user_id)),
            refresh_token=refresh_token,
        )
