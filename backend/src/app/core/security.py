"""비밀번호 해싱과 토큰 발급·검증, 서버 설정에 저장하는 비밀값 암호화.

- 비밀번호: bcrypt 단방향 해시. 평문은 저장하지도, 로그에 남기지도 않는다.
- 액세스 토큰: 짧게 사는 JWT. 서버가 상태를 갖지 않는다.
- 리프레시 토큰: 임의의 긴 문자열. 원문은 클라이언트만 갖고, 서버에는 SHA-256 해시만 저장한다
  (DB가 유출돼도 토큰을 재사용할 수 없다).
- LLM 공급자 API 키(ADMIN-01): 호출할 때 원문이 필요해 bcrypt처럼 단방향으로 저장할 수 없다.
  Fernet(대칭키 암호화)으로 암·복호화한다. 키는 `SETTINGS_ENCRYPTION_KEY`.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError, UnauthorizedError

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


def _fernet() -> Fernet:
    if not settings.SETTINGS_ENCRYPTION_KEY:
        raise ServiceUnavailableError(
            "SETTINGS_ENCRYPTION_KEY가 설정되지 않아 API 키를 저장할 수 없습니다. "
            '`python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"`로 만들어 .env에 넣으세요.'
        )
    try:
        return Fernet(settings.SETTINGS_ENCRYPTION_KEY.encode())
    except ValueError as exc:
        raise ServiceUnavailableError("SETTINGS_ENCRYPTION_KEY 형식이 올바르지 않습니다.") from exc


def encrypt_secret(plain_text: str) -> str:
    """서버 설정에 저장할 비밀값(LLM API 키 등)을 암호화한다. 원문은 로그에 남기지 않는다."""
    return _fernet().encrypt(plain_text.encode()).decode()


def decrypt_secret(encrypted_text: str) -> str:
    try:
        return _fernet().decrypt(encrypted_text.encode()).decode()
    except InvalidToken as exc:
        raise ServiceUnavailableError(
            "저장된 API 키를 복호화하지 못했습니다. SETTINGS_ENCRYPTION_KEY가 바뀌었을 수 있습니다."
        ) from exc
