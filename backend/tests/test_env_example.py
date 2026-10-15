"""설정과 `.env.example`이 어긋나지 않게 막는다.

Fork한 사람은 `.env.example`만 보고 환경을 만든다. 설정을 추가하고 예시 파일을 빠뜨리면
"문서대로 했는데 안 된다"가 되므로 여기서 걸러낸다.
"""

import re

from app.core.config import Settings
from tests.support import BACKEND_DIR

ENV_EXAMPLE = BACKEND_DIR.parent / ".env.example"

# 백엔드 설정이 아니라 docker compose나 프론트엔드가 쓰는 값들
NON_SETTINGS_KEYS = {
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "POSTGRES_PORT",
    "NEXT_PUBLIC_API_BASE_URL",
}


def example_keys() -> set[str]:
    return set(re.findall(r"^([A-Z0-9_]+)=", ENV_EXAMPLE.read_text(encoding="utf-8"), re.M))


def test_every_setting_is_documented() -> None:
    missing = set(Settings.model_fields) - example_keys()

    assert not missing, f".env.example에 다음 설정이 빠졌습니다: {sorted(missing)}"


def test_example_has_no_unknown_keys() -> None:
    unknown = example_keys() - set(Settings.model_fields) - NON_SETTINGS_KEYS

    assert not unknown, f".env.example에 쓰이지 않는 키가 있습니다: {sorted(unknown)}"


def test_example_contains_no_real_secrets() -> None:
    """예시 파일에 진짜 키가 들어가는 사고를 막는다."""
    text = ENV_EXAMPLE.read_text(encoding="utf-8")

    for line in text.splitlines():
        if line.startswith(("LLM_API_KEY=", "OPENAI_API_KEY=", "ANTHROPIC_API_KEY=")):
            assert line.split("=", 1)[1].strip() == "", f"예시 파일에 값이 들어 있습니다: {line}"
