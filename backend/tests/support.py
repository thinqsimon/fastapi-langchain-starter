"""테스트 공용 도우미."""

import subprocess
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from app.core.config import settings

# alembic은 alembic.ini가 있는 backend/ 기준으로 동작한다. pytest를 어디서 실행하든 맞춘다.
BACKEND_DIR = Path(__file__).resolve().parents[1]


def run_alembic(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["alembic", *args],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
        check=False,
    )


def database_is_reachable() -> bool:
    try:
        engine = create_engine(settings.DATABASE_URL, connect_args={"connect_timeout": 2})
        with engine.connect() as conn:
            conn.execute(text("select 1"))
    except OperationalError:
        return False
    return True
