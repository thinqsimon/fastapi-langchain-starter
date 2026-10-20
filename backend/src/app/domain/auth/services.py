"""auth 도메인 - 비즈니스 로직. 트랜잭션 경계를 여기서 잡는다."""

import logging
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, ConflictError, UnauthorizedError
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


class WrongPasswordError(AppError):
    """현재 비밀번호 확인 실패.

    401이 아니라 400을 쓴다. 이미 로그인한 사용자가 확인용 비밀번호를 틀린 것이라
    인증 실패가 아니다. 401을 주면 프론트엔드 인터셉터가 토큰 재발급을 시도하다
    결국 로그아웃시켜 버린다(비밀번호 한 번 틀렸다고 쫓겨나는 셈).
    """

    status_code = 400
    code = "WRONG_PASSWORD"


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

    def update_profile(self, user: User, display_name: str) -> User:
        user.display_name = display_name.strip()
        self.db.commit()
        logger.info("profile_updated user_id=%s", user.id)
        return user

    def change_email(self, user: User, email: str, current_password: str) -> User:
        self._verify_current_password(user, current_password)

        existing = self.users.get_by_email(email)
        if existing is not None and existing.id != user.id:
            raise ConflictError("이미 사용 중인 이메일입니다.")

        user.email = email
        try:
            self.db.commit()
        except IntegrityError as exc:
            # 확인과 저장 사이에 다른 계정이 같은 이메일을 먼저 가져간 경우(500이 아니라 409)
            self.db.rollback()
            raise ConflictError("이미 사용 중인 이메일입니다.") from exc
        # 이메일 원문은 남기지 않는다(개인정보).
        logger.info("email_changed user_id=%s", user.id)
        return user

    def change_password(self, user: User, current_password: str, new_password: str) -> TokenPair:
        """비밀번호를 바꾸고 다른 기기의 로그인을 모두 끊는다. 현재 화면용 새 토큰을 돌려준다."""
        self._verify_current_password(user, current_password)
        if verify_password(new_password, user.password_hash):
            raise AppError("새 비밀번호가 현재 비밀번호와 같습니다.")

        user.password_hash = hash_password(new_password)
        revoked = self.refresh_tokens.revoke_all_for_user(user.id)
        tokens = self._issue_tokens(user.id)
        self.db.commit()
        logger.info("password_changed user_id=%s revoked_sessions=%s", user.id, revoked)
        return tokens

    def _verify_current_password(self, user: User, current_password: str) -> None:
        if not verify_password(current_password, user.password_hash):
            raise WrongPasswordError("현재 비밀번호가 올바르지 않습니다.")

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
