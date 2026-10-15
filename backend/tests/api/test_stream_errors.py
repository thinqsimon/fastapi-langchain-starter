"""스트리밍 중 오류가 났을 때의 동작 검증.

HTTP 상태 코드를 이미 보낸 뒤라 오류를 SSE 이벤트로 알려야 한다.
이때 내부 메시지(API 키 관련 문구, 스택 등)가 클라이언트로 새지 않아야 한다.
"""

import logging

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import LLMError

ACCOUNT = {"email": "stream@example.com", "password": "secret-password", "display_name": "스트림"}
INTERNAL_SECRET = "sk-internal-key-should-not-leak"


@pytest.fixture
def conversation(api_client: TestClient) -> tuple[str, dict[str, str]]:
    api_client.post("/api/auth/signup", json=ACCOUNT)
    tokens = api_client.post(
        "/api/auth/login", json={"email": ACCOUNT["email"], "password": ACCOUNT["password"]}
    ).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    conversation_id = api_client.post(
        "/api/conversations", json={"title": "오류 테스트"}, headers=headers
    ).json()["id"]
    return conversation_id, headers


def read_events(response) -> list[tuple[str, str]]:
    events: list[tuple[str, str]] = []
    name = "message"
    for line in response.text.splitlines():
        if line.startswith("event:"):
            name = line.removeprefix("event:").strip()
        elif line.startswith("data:"):
            events.append((name, line.removeprefix("data:").strip()))
    return events


def test_llm_failure_is_reported_without_leaking_internals(
    api_client: TestClient,
    conversation: tuple[str, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """공급자 오류 메시지가 그대로 전달되면 키 정보 등이 노출될 수 있다."""
    conversation_id, headers = conversation

    def explode(*_args: object, **_kwargs: object) -> object:
        raise RuntimeError(f"Missing credentials. api_key={INTERNAL_SECRET}")

    monkeypatch.setattr("app.llm.chains.chat.get_chat_model", explode)

    res = api_client.post(
        f"/api/conversations/{conversation_id}/stream",
        json={"content": "안녕"},
        headers=headers,
    )

    assert res.status_code == 200  # 스트림은 열렸으므로 200
    errors = [data for name, data in read_events(res) if name == "error"]
    assert errors, "error 이벤트가 오지 않았습니다"
    assert INTERNAL_SECRET not in res.text
    assert "api_key" not in res.text


def test_llm_failure_is_wrapped_as_llm_error(monkeypatch: pytest.MonkeyPatch) -> None:
    """공급자별 예외를 LLMError 하나로 묶어 상위 계층이 분기하지 않게 한다."""
    import asyncio

    from app.llm.chains.chat import stream_reply

    def explode(*_args: object, **_kwargs: object) -> object:
        raise RuntimeError("provider exploded")

    monkeypatch.setattr("app.llm.chains.chat.get_chat_model", explode)

    async def consume() -> None:
        async for _ in stream_reply("안녕"):
            pass

    with pytest.raises(LLMError):
        asyncio.run(consume())


def test_unexpected_failure_is_logged_with_stack(
    api_client: TestClient,
    conversation: tuple[str, dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """클라이언트에 감춘 내용은 서버 로그에서 찾을 수 있어야 한다."""
    conversation_id, headers = conversation

    def explode(*_args: object, **_kwargs: object) -> object:
        raise RuntimeError(f"Missing credentials. api_key={INTERNAL_SECRET}")

    monkeypatch.setattr("app.llm.chains.chat.get_chat_model", explode)

    with caplog.at_level(logging.WARNING):
        api_client.post(
            f"/api/conversations/{conversation_id}/stream",
            json={"content": "안녕"},
            headers=headers,
        )

    assert "stream_failed" in caplog.text
