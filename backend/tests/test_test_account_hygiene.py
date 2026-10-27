"""테스트 계정이 DB에 쌓이지 않도록 하는 규칙을 강제한다.

- 테스트·수동 확인용 계정은 `@example.com`만 쓴다. 다른 도메인이면 정리 스크립트가 놓친다
- `scripts/clean-test-accounts.sh`가 그 계정을 지우고, E2E는 끝날 때 자동으로 호출한다
- 원격 DB(Supabase 등)는 `--remote` 없이는 거부한다
"""

import re
import subprocess
import sys

import pytest

from app.core.config import settings
from tests.support import BACKEND_DIR, database_is_reachable

ROOT = BACKEND_DIR.parent
E2E_SCRIPT = ROOT / "scripts" / "e2e.sh"
CLEAN_SCRIPT = ROOT / "scripts" / "clean-test-accounts.sh"
CLEAN_MODULE = BACKEND_DIR / "scripts" / "clean_test_accounts.py"
TEST_DOMAIN = "example.com"

# 이메일 값이 적힌 줄에서 도메인만 뽑는다("email" 글자가 있는 줄만 보므로 DATABASE_URL은 제외).
EMAIL_DOMAIN = re.compile(r"@([a-z0-9.-]+\.[a-z]{2,})\b", re.I)


def _account_domains(path_glob: str) -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for path in sorted(ROOT.glob(path_glob)):
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "email" not in line.lower():
                continue
            for domain in EMAIL_DOMAIN.findall(line):
                if domain.lower() != TEST_DOMAIN:
                    found.setdefault(f"{path.relative_to(ROOT)}:{lineno}", []).append(domain)
    return found


def test_e2e_accounts_use_the_test_domain() -> None:
    assert _account_domains("frontend/e2e/*.ts") == {}, (
        f"E2E 계정은 @{TEST_DOMAIN}만 써야 정리 스크립트가 지울 수 있습니다"
    )


def test_backend_test_accounts_use_the_test_domain() -> None:
    assert _account_domains("backend/tests/**/*.py") == {}, (
        f"백엔드 테스트 계정은 @{TEST_DOMAIN}만 써야 합니다"
    )


def test_cleanup_script_targets_the_test_domain() -> None:
    assert CLEAN_SCRIPT.exists() and CLEAN_MODULE.exists()
    assert f'TEST_EMAIL_DOMAIN = "{TEST_DOMAIN}"' in CLEAN_MODULE.read_text(encoding="utf-8")


def test_e2e_script_cleans_up_test_accounts() -> None:
    text = E2E_SCRIPT.read_text(encoding="utf-8")
    assert "clean-test-accounts.sh --delete" in text, "e2e.sh가 끝날 때 테스트 계정을 지워야 합니다"


def _run_cleanup(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(CLEAN_MODULE), *args],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
        check=False,
    )


def test_cleanup_refuses_remote_database_without_flag() -> None:
    """운영 DB를 실수로 비우는 사고를 막는다. 연결을 시도하기 전에 거부해야 한다."""
    remote = "postgresql+psycopg://user:pw@db.example.supabase.co:5432/postgres"
    result = _run_cleanup("--delete", "--database-url", remote)

    assert result.returncode == 2, result.stdout + result.stderr
    assert "--remote" in result.stderr
    assert "pw@" not in result.stdout + result.stderr, "비밀번호가 출력되면 안 됩니다"


def test_cleanup_dry_run_lists_without_deleting(migrated_database) -> None:  # type: ignore[no-untyped-def]
    """인자 없이 실행하면 대상만 보여주고 지우지 않는다."""
    from sqlalchemy import text

    if not database_is_reachable():
        pytest.skip("PostgreSQL 없음")
    email = f"hygiene-dry-run@{TEST_DOMAIN}"
    with migrated_database.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, display_name, is_active, created_at)"
                " VALUES (gen_random_uuid(), :e, 'x', '정리 테스트', true, now())"
                " ON CONFLICT (email) DO NOTHING"
            ),
            {"e": email},
        )
    try:
        result = _run_cleanup("--database-url", settings.TEST_DATABASE_URL)

        assert result.returncode == 0, result.stdout + result.stderr
        assert email in result.stdout
        assert "dry-run" in result.stdout
        with migrated_database.connect() as conn:
            still = conn.execute(
                text("SELECT count(*) FROM users WHERE email = :e"), {"e": email}
            ).scalar()
        assert still == 1
    finally:
        with migrated_database.begin() as conn:
            conn.execute(text("DELETE FROM users WHERE email = :e"), {"e": email})
