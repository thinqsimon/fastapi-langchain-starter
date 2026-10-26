"""DB-01 마이그레이션 검증.

DB가 떠 있을 때만 실행된다(로컬에서 `make db` 없이도 나머지 테스트는 통과해야 하므로).
CI는 항상 DB를 띄우므로 여기서 걸러진다.
"""

import uuid
from collections.abc import Generator

import pytest
from sqlalchemy import Engine, create_engine, inspect, text

from tests.support import run_alembic


def test_upgrade_head_creates_expected_tables(migrated_database: Engine) -> None:
    tables = set(inspect(migrated_database).get_table_names())

    assert {"users", "refresh_tokens"} <= tables


def test_models_match_migrations(migrated_database: Engine) -> None:
    """모델을 바꾸고 마이그레이션을 만들지 않으면 여기서 실패한다."""
    result = run_alembic("check")

    assert result.returncode == 0, (
        '모델과 마이그레이션이 다릅니다. `make migration m="설명"`으로 생성하세요.\n'
        + result.stdout
        + result.stderr
    )


def test_user_email_is_unique(migrated_database: Engine) -> None:
    indexes = inspect(migrated_database).get_indexes("users")
    unique_columns = [index["column_names"] for index in indexes if index["unique"]]

    assert ["email"] in unique_columns


def test_refresh_token_cascades_on_user_delete(migrated_database: Engine) -> None:
    """사용자를 지우면 토큰도 함께 지워져야 한다(고아 토큰 방지)."""
    foreign_keys = inspect(migrated_database).get_foreign_keys("refresh_tokens")

    user_fk = next(fk for fk in foreign_keys if fk["referred_table"] == "users")
    assert user_fk["options"]["ondelete"] == "CASCADE"


@pytest.fixture
def migration_sandbox(
    migrated_database: Engine,
) -> Generator[Engine]:
    """downgrade는 공유 테스트/미리보기 DB 대신 이 테스트가 만든 DB에서만 실행한다."""
    name = f"diary_migration_test_{uuid.uuid4().hex}"
    admin = create_engine(migrated_database.url, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}"'))
    sandbox = create_engine(migrated_database.url.set(database=name))
    try:
        yield sandbox
    finally:
        sandbox.dispose()
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}"'))
        admin.dispose()


def test_learning_migration_can_roundtrip_without_losing_existing_diary(
    migration_sandbox: Engine,
) -> None:
    database_url = migration_sandbox.url.render_as_string(hide_password=False)
    initialized = run_alembic("upgrade", "head", database_url=database_url)
    assert initialized.returncode == 0, initialized.stdout + initialized.stderr
    user_id, entry_id = uuid.uuid4(), uuid.uuid4()
    with migration_sandbox.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users(id,email,password_hash,display_name) "
                "VALUES (:id,:email,'test-hash','migration-test')"
            ),
            {"id": user_id, "email": f"{user_id}@example.com"},
        )
        connection.execute(
            text(
                "INSERT INTO diary_entries(id,user_id,entry_date,title,learned,difficult) "
                "VALUES (:id,:user_id,'2026-10-21','보존할 일기','배운 것','어려움')"
            ),
            {"id": entry_id, "user_id": user_id},
        )
    result = run_alembic("downgrade", "c85195cc050f", database_url=database_url)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "diary_weekly_reviews" not in inspect(migration_sandbox).get_table_names()
    with migration_sandbox.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT title FROM diary_entries WHERE id=:id"), {"id": entry_id}
            )
            == "보존할 일기"
        )
    upgraded = run_alembic("upgrade", "head", database_url=database_url)
    assert upgraded.returncode == 0, upgraded.stdout + upgraded.stderr
    tables = set(inspect(migration_sandbox).get_table_names())
    assert {"diary_weekly_reviews", "diary_study_progress"} <= tables
