"""공통 기능은 두 프로필에서 동작하고, 서비스 기능은 starter에 노출되지 않는다."""

import os
import subprocess
import sys
from collections.abc import AsyncIterator

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.application import resolve_application
from app.core.config import AppProfile, Settings
from app.core.database import get_db
from app.main import create_app


@pytest.mark.parametrize("profile", ["starter", "diary-coach"])
def test_profile_exposes_only_its_features(profile: AppProfile) -> None:
    client = TestClient(create_app(app_profile=profile))
    schema = client.get("/openapi.json").json()
    paths = schema["paths"]

    assert client.get("/health").json() == {"status": "ok"}
    assert "/api/auth/login" in paths
    assert "/api/conversations" in paths
    assert "/api/usage/me" in paths
    assert ("/api/diary/draft" in paths) == (profile == "diary-coach")
    assert ("/api/me/preferences" in paths) == (profile == "diary-coach")
    if profile == "starter":
        assert client.get("/api/diary").status_code == 404
        assert client.post("/api/diary/draft", json={}).status_code == 404
        assert client.get("/api/me/preferences").status_code == 404
        assert {tag["name"] for tag in schema["tags"]}.isdisjoint({"diary", "preferences"})


def test_starter_does_not_import_sample_service() -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys; from app.main import app; "
            "assert app.state.application_profile == 'starter'; "
            "assert not any(name.startswith(('app.domain.diary', 'app.domain.preferences', "
            "'app.llm.prompts.diary_coach', 'app.llm.chains.diary')) for name in sys.modules)",
        ],
        env={**os.environ, "APP_PROFILE": "starter", "LLM_PROVIDER": "fake"},
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


def test_profiles_are_independent_and_unknown_profile_is_rejected() -> None:
    starter = create_app(app_profile="starter")
    coach = create_app(app_profile="diary-coach")
    assert starter.state.chat_system_prompt == resolve_application("starter").system_prompt
    assert coach.state.chat_system_prompt == resolve_application("diary-coach").system_prompt
    assert starter.state.chat_system_prompt != coach.state.chat_system_prompt
    with pytest.raises(ValidationError):
        Settings(_env_file=None, APP_PROFILE="typo")  # type: ignore[call-arg]
    with pytest.raises(ValueError, match="지원하지 않는"):
        resolve_application("typo")  # type: ignore[arg-type]


def test_each_profile_injects_its_prompt_without_changing_chat_contract(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.domain.chat import services

    prompts: list[str | None] = []

    async def reply(
        *_args: object, system_prompt: str | None = None, **_kwargs: object
    ) -> AsyncIterator[str]:
        prompts.append(system_prompt)
        yield "학습 답변"

    monkeypatch.setattr(services, "stream_reply", reply)
    profiles: tuple[AppProfile, ...] = ("starter", "diary-coach")
    for profile in profiles:
        app = create_app(app_profile=profile)
        app.dependency_overrides[get_db] = lambda: db_session
        with TestClient(app) as client:
            credentials = {"email": f"{profile}@example.com", "password": "secret-password"}
            assert (
                client.post(
                    "/api/auth/signup", json={**credentials, "display_name": "교육생"}
                ).status_code
                == 201
            )
            tokens = client.post("/api/auth/login", json=credentials).json()
            headers = {"Authorization": f"Bearer {tokens['access_token']}"}
            conversation = client.post(
                "/api/conversations", json={"title": "학습"}, headers=headers
            ).json()
            response = client.post(
                f"/api/conversations/{conversation['id']}/stream",
                json={"content": "JWT가 궁금해요"},
                headers=headers,
            )
            assert response.status_code == 200
            assert "event: done" in response.text
            history = client.get(
                f"/api/conversations/{conversation['id']}/messages", headers=headers
            ).json()
            assert [message["role"] for message in history] == ["user", "assistant"]
            assert history[-1]["content"] == "학습 답변"
    assert prompts == [resolve_application(profile).system_prompt for profile in profiles]
