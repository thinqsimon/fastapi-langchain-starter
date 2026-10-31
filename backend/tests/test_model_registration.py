"""모델 등록 누락을 막는다.

새 도메인 모델을 만들고 `app/models.py`에 import하지 않으면 Alembic이 그 테이블을 보지 못해
마이그레이션이 생성되지 않는다. 배포 후에야 "테이블이 없다"로 드러나므로 여기서 걸러낸다.

주의: 같은 프로세스 안에서는 다른 테스트가 이미 모델을 import해 둔 상태라 검사가 무의미해진다.
그래서 `app.models`만 읽어 들이는 새 프로세스를 띄워 확인한다(alembic/env.py와 같은 조건).
"""

import json
import subprocess
import sys

from tests.support import BACKEND_DIR

# alembic/env.py가 하는 일과 동일: app.models만 import한 뒤 metadata를 본다.
TABLES_VIA_MODELS_MODULE = """
import json
from app.models import Base
print(json.dumps(sorted(Base.metadata.tables)))
"""

# 등록 여부와 무관하게 모든 도메인 모델 모듈을 훑어 실제 정의된 테이블을 찾는다.
TABLES_DEFINED_ANYWHERE = """
import importlib, json, pkgutil
import app.domain
from app.core.database import Base

for module in pkgutil.walk_packages(app.domain.__path__, prefix="app.domain."):
    if module.name.endswith(".models"):
        importlib.import_module(module.name)

print(json.dumps(sorted(Base.metadata.tables)))
"""


def _tables(script: str) -> list[str]:
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_every_defined_model_is_registered_for_migrations() -> None:
    registered = set(_tables(TABLES_VIA_MODELS_MODULE))
    defined = set(_tables(TABLES_DEFINED_ANYWHERE))

    missing = defined - registered
    assert not missing, (
        f"app/models.py에 import되지 않은 모델이 있습니다: {sorted(missing)}. "
        "추가하지 않으면 마이그레이션이 생성되지 않습니다."
    )


def test_current_schema_is_as_expected() -> None:
    """현재 스키마를 한눈에 보여주는 고정 목록(새 테이블을 추가하면 함께 갱신한다)."""
    assert set(_tables(TABLES_VIA_MODELS_MODULE)) == {
        "users",
        "refresh_tokens",
        "conversations",
        "messages",
        "diary_entries",
        "diary_weekly_reviews",
        "diary_study_progress",
        "notebooks",
        "notebook_topics",
        "document_chunks",
        "user_preferences",
        "llm_providers",
        "llm_plan_routes",
        "coupons",
        "answer_level_names",
    }
