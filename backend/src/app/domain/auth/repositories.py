"""auth 도메인 - 데이터 접근 계층. SQLAlchemy 쿼리만 둔다."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.domain.auth.models import RefreshToken, User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return self.db.get(User, user_id)

    def create(self, email: str, password_hash: str, display_name: str) -> User:
        user = User(email=email, password_hash=password_hash, display_name=display_name)
        self.db.add(user)
        self.db.flush()
        return user

    def search(self, query: str, limit: int = 20) -> list[User]:
        """이메일·이름에 query가 들어간 사용자를 최근 가입순으로 돌려준다(관리자 검색, ADMIN-02)."""
        pattern = f"%{query}%"
        stmt = (
            select(User)
            .where(or_(User.email.ilike(pattern), User.display_name.ilike(pattern)))
            .order_by(User.created_at.desc())
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars())

    def delete(self, user_id: uuid.UUID) -> None:
        """사용자를 지운다(관리자 삭제, ADMIN-05).

        users를 참조하는 테이블은 DB의 ON DELETE CASCADE가 함께 지우고,
        쿠폰은 SET NULL로 기록만 남는다. ORM의 session.delete()는 자식 행의 외래 키를
        비우려다 NOT NULL에 막힐 수 있어 DELETE 문을 바로 보낸다.
        """
        self.db.execute(delete(User).where(User.id == user_id))


class RefreshTokenRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, user_id: uuid.UUID, token_hash: str, expires_at: datetime) -> RefreshToken:
        token = RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        self.db.add(token)
        self.db.flush()
        return token

    def get_usable(self, token_hash: str) -> RefreshToken | None:
        """폐기되지 않고 아직 만료되지 않은 토큰만 돌려준다."""
        return self.db.scalar(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > datetime.now(UTC),
            )
        )

    def revoke(self, token: RefreshToken) -> None:
        token.revoked_at = datetime.now(UTC)
        self.db.flush()

    def revoke_all_for_user(self, user_id: uuid.UUID) -> int:
        """사용자의 살아 있는 리프레시 토큰을 모두 폐기한다(다른 기기 로그아웃)."""
        tokens = list(
            self.db.scalars(
                select(RefreshToken).where(
                    RefreshToken.user_id == user_id,
                    RefreshToken.revoked_at.is_(None),
                )
            )
        )
        now = datetime.now(UTC)
        for token in tokens:
            token.revoked_at = now
        self.db.flush()
        return len(tokens)
