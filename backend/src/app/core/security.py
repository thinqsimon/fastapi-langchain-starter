"""비밀번호 해싱과 토큰 발급·검증.

- 비밀번호: bcrypt 단방향 해시. 평문은 저장하지도, 로그에 남기지도 않는다.
- 액세스 토큰: 짧게 사는 JWT. 서버가 상태를 갖지 않는다.
- 리프레시 토큰: 임의의 긴 문자열. 원문은 클라이언트만 갖고, 서버에는 SHA-256 해시만 저장한다
  (DB가 유출돼도 토큰을 재사용할 수 없다).
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import settings
from app.core.exceptions import UnauthorizedError

# bcrypt는 72바이트까지만 사용한다. 더 긴 입력은 잘라서 에러를 막는다.
_BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:_BCRYPT_MAX_BYTES], bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode()[:_BCRYPT_MAX_BYTES], password_hash.encode())


def create_access_token(subject: str) -> str:
    """subject에는 사용자 ID를 넣는다."""
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> str:
    """유효하면 사용자 ID를 돌려주고, 아니면 UnauthorizedError를 던진다."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("토큰이 유효하지 않거나 만료되었습니다.") from exc

    # 리프레시 토큰이 액세스 토큰 자리에 쓰이는 것을 막는다.
    if payload.get("type") != "access":
        raise UnauthorizedError("토큰이 유효하지 않습니다.")

    return str(payload["sub"])


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def refresh_token_expires_at() -> datetime:
    return datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
