"""테스트 공용 도우미."""

import os
import subprocess
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from app.core.config import settings

# alembic은 alembic.ini가 있는 backend/ 기준으로 동작한다. pytest를 어디서 실행하든 맞춘다.
BACKEND_DIR = Path(__file__).resolve().parents[1]


def run_alembic(*args: str) -> subprocess.CompletedProcess[str]:
    # 하위 프로세스도 테스트 DB를 보게 한다(환경 변수가 .env보다 우선한다).
    env = {**os.environ, "DATABASE_URL": settings.TEST_DATABASE_URL}
    return subprocess.run(
        ["alembic", *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def database_is_reachable() -> bool:
    try:
        engine = create_engine(settings.TEST_DATABASE_URL, connect_args={"connect_timeout": 2})
        with engine.connect() as conn:
            conn.execute(text("select 1"))
    except OperationalError:
        return False
    return True
