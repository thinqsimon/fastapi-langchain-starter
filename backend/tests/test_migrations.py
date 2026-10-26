"""DB-01 마이그레이션 검증.

DB가 떠 있을 때만 실행된다(로컬에서 `make db` 없이도 나머지 테스트는 통과해야 하므로).
CI는 항상 DB를 띄우므로 여기서 걸러진다.
"""

import uuid

from sqlalchemy import Engine, inspect, text

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


def test_learning_migration_can_roundtrip_without_losing_existing_diary(
    migrated_database: Engine,
) -> None:
    user_id, entry_id = uuid.uuid4(), uuid.uuid4()
    with migrated_database.begin() as connection:
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
    try:
        result = run_alembic("downgrade", "c85195cc050f")
        assert result.returncode == 0, result.stdout + result.stderr
        assert "diary_weekly_reviews" not in inspect(migrated_database).get_table_names()
        with migrated_database.connect() as connection:
            assert (
                connection.scalar(
                    text("SELECT title FROM diary_entries WHERE id=:id"), {"id": entry_id}
                )
                == "보존할 일기"
            )
    finally:
        upgraded = run_alembic("upgrade", "head")
        assert upgraded.returncode == 0, upgraded.stdout + upgraded.stderr
        with migrated_database.begin() as connection:
            connection.execute(text("DELETE FROM users WHERE id=:id"), {"id": user_id})
    tables = set(inspect(migrated_database).get_table_names())
    assert {"diary_weekly_reviews", "diary_study_progress"} <= tables
