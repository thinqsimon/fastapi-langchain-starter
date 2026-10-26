"""초기화가 참조를 깨뜨리는 샘플 삭제 없이 실행 구성을 바꾼다."""

import shutil
import subprocess
from pathlib import Path

import pytest
from dotenv import dotenv_values

from tests.support import BACKEND_DIR


@pytest.mark.parametrize("profile", ["starter", "diary-coach"])
def test_project_configuration_preserves_sample_and_migrations(
    tmp_path: Path, profile: str
) -> None:
    root = BACKEND_DIR.parent
    (tmp_path / "scripts").mkdir()
    for name in [".env.example", "render.yaml", "scripts/configure-project.mjs"]:
        shutil.copyfile(root / name, tmp_path / name)
    sample = tmp_path / "backend/src/app/domain/diary/models.py"
    sample.parent.mkdir(parents=True)
    sample.write_text("sample model", encoding="utf-8")
    migration = tmp_path / "backend/alembic/versions/existing.py"
    migration.parent.mkdir(parents=True)
    migration.write_text("existing migration", encoding="utf-8")

    result = subprocess.run(
        ["node", str(tmp_path / "scripts/configure-project.mjs"), '학습 "노트"', "my-app", profile],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    values = dotenv_values(tmp_path / ".env.example")
    assert values["APP_PROFILE"] == values["NEXT_PUBLIC_APP_PROFILE"] == profile
    assert values["APP_NAME"] == values["NEXT_PUBLIC_APP_NAME"] == '학습 "노트"'
    render = (tmp_path / "render.yaml").read_text(encoding="utf-8")
    assert "    name: my-app" in render
    assert f"- key: APP_PROFILE\n        value: {profile}" in render
    assert '- key: APP_NAME\n        value: "학습 \\"노트\\""' in render
    assert sample.read_text(encoding="utf-8") == "sample model"
    assert migration.read_text(encoding="utf-8") == "existing migration"


def test_invalid_project_configuration_fails_without_touching_files(tmp_path: Path) -> None:
    script = tmp_path / "scripts/configure-project.mjs"
    script.parent.mkdir()
    shutil.copyfile(BACKEND_DIR.parent / "scripts/configure-project.mjs", script)
    example = tmp_path / ".env.example"
    example.write_text("APP_PROFILE=starter\n", encoding="utf-8")
    result = subprocess.run(
        ["node", str(script), "새 서비스", "valid-slug", "unknown"],
        capture_output=True,
    )
    assert result.returncode == 1
    assert example.read_text(encoding="utf-8") == "APP_PROFILE=starter\n"
