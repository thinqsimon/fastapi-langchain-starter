"""테스트가 실제 LLM API를 부르지 않는다는 것을 강제한다.

실수로 진짜 공급자가 쓰이면 CI가 키를 요구하거나(실패) 비용이 발생한다.
"""

import os
import re

from app.core.config import settings
from app.llm.fake import FakeChatModel
from app.llm.providers import get_chat_model
from tests.support import BACKEND_DIR

CI_WORKFLOW = BACKEND_DIR.parent / ".github" / "workflows" / "ci.yml"
E2E_SCRIPT = BACKEND_DIR.parent / "scripts" / "e2e.sh"


def test_test_session_uses_fake_provider() -> None:
    assert os.environ.get("LLM_PROVIDER") == "fake"
    assert settings.LLM_PROVIDER == "fake"


def test_get_chat_model_returns_the_test_double() -> None:
    assert isinstance(get_chat_model(), FakeChatModel)


def test_ci_workflow_pins_fake_provider() -> None:
    """CI 설정에서 fake 공급자가 빠지면 실제 호출이 일어날 수 있다."""
    text = CI_WORKFLOW.read_text(encoding="utf-8")

    assert re.search(r"^\s*LLM_PROVIDER:\s*fake\s*$", text, re.M), (
        "ci.yml에 LLM_PROVIDER: fake 가 없습니다"
    )


def test_e2e_script_pins_fake_provider() -> None:
    text = E2E_SCRIPT.read_text(encoding="utf-8")

    assert 'LLM_PROVIDER="fake"' in text, "e2e.sh에 LLM_PROVIDER=fake 가 없습니다"


def test_no_api_key_is_needed_for_tests() -> None:
    """키 없이도 모델을 만들 수 있어야 한다(Fork 직후 바로 초록불)."""
    model = get_chat_model()

    assert "".join(str(chunk.content) for chunk in model.stream("안녕"))


def test_test_session_never_targets_a_remote_database() -> None:
    """테스트가 운영 DB에 붙는 사고를 막는다."""
    from app.core.config import settings as app_settings

    host = app_settings.TEST_DATABASE_URL
    assert "localhost" in host or "127.0.0.1" in host, (
        f"테스트 DB가 로컬이 아닙니다: {host.split('@')[-1]}"
    )
