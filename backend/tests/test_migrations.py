"""DB-01 마이그레이션 검증.

DB가 떠 있을 때만 실행된다(로컬에서 `make db` 없이도 나머지 테스트는 통과해야 하므로).
CI는 항상 DB를 띄우므로 여기서 걸러진다.
"""

import subprocess
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError

from app.core.config import settings

# alembic은 alembic.ini가 있는 backend/ 기준으로 동작한다. pytest를 어디서 실행하든 맞춘다.
BACKEND_DIR = Path(__file__).resolve().parents[1]


def _run_alembic(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["alembic", *args],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
        check=False,
    )


def _database_is_reachable() -> bool:
    try:
        engine = create_engine(settings.DATABASE_URL, connect_args={"connect_timeout": 2})
        with engine.connect() as conn:
            conn.execute(text("select 1"))
    except OperationalError:
        return False
    return True


pytestmark = pytest.mark.skipif(
    not _database_is_reachable(),
    reason="PostgreSQL에 연결할 수 없습니다. `make db` 후 다시 실행하세요.",
)


@pytest.fixture(scope="module")
def migrated_database() -> None:
    """최신 마이그레이션까지 올린다. 이미 올라가 있으면 아무 일도 하지 않는다."""
    result = _run_alembic("upgrade", "head")
    assert result.returncode == 0, result.stdout + result.stderr


def test_upgrade_head_creates_expected_tables(migrated_database: None) -> None:
    inspector = inspect(create_engine(settings.DATABASE_URL))
    tables = set(inspector.get_table_names())

    assert {"users", "refresh_tokens"} <= tables


def test_models_match_migrations(migrated_database: None) -> None:
    """모델을 바꾸고 마이그레이션을 만들지 않으면 여기서 실패한다."""
    result = _run_alembic("check")

    assert result.returncode == 0, (
        '모델과 마이그레이션이 다릅니다. `make migration m="설명"`으로 생성하세요.\n'
        + result.stdout
        + result.stderr
    )


def test_user_email_is_unique(migrated_database: None) -> None:
    inspector = inspect(create_engine(settings.DATABASE_URL))
    unique_columns = [
        index["column_names"] for index in inspector.get_indexes("users") if index["unique"]
    ]

    assert ["email"] in unique_columns


def test_refresh_token_cascades_on_user_delete(migrated_database: None) -> None:
    """사용자를 지우면 토큰도 함께 지워져야 한다(고아 토큰 방지)."""
    inspector = inspect(create_engine(settings.DATABASE_URL))
    foreign_keys = inspector.get_foreign_keys("refresh_tokens")

    user_fk = next(fk for fk in foreign_keys if fk["referred_table"] == "users")
    assert user_fk["options"]["ondelete"] == "CASCADE"
