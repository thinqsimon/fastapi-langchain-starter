import os

# 테스트는 실제 LLM을 호출하지 않는다.
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("LLM_PROVIDER", "fake")
# 개발자의 .env 값에 테스트 결과가 좌우되지 않도록 토큰 서명 키를 고정한다.
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-key-with-enough-length-0123456789")

from collections.abc import Generator  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import Engine, create_engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from tests.support import database_is_reachable, run_alembic  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    """DB가 필요 없는 테스트용 클라이언트."""
    return TestClient(create_app())


@pytest.fixture(scope="session")
def migrated_database() -> Engine:
    """DB가 없으면 건너뛰고, 있으면 최신 마이그레이션까지 올린다."""
    if not database_is_reachable():
        pytest.skip("PostgreSQL에 연결할 수 없습니다. `make db` 후 다시 실행하세요.")

    result = run_alembic("upgrade", "head")
    assert result.returncode == 0, result.stdout + result.stderr
    return create_engine(settings.DATABASE_URL)


@pytest.fixture
def db_session(migrated_database: Engine) -> Generator[Session]:
    """테스트마다 트랜잭션을 열고 끝나면 되돌린다. 테스트끼리 데이터가 섞이지 않는다.

    서비스 계층이 commit()을 호출해도 SAVEPOINT까지만 반영되므로 바깥 트랜잭션을
    rollback하면 흔적이 남지 않는다.
    """
    connection = migrated_database.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def api_client(db_session: Session) -> Generator[TestClient]:
    """DB를 쓰는 API 테스트용 클라이언트."""
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db_session

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
