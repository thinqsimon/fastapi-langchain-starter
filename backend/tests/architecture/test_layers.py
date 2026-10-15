"""계층 규칙(pyproject.toml [tool.importlinter])을 pytest에서도 확인한다."""

import subprocess


def test_import_contracts() -> None:
    result = subprocess.run(["lint-imports"], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
