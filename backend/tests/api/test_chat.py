"""CHAT-01 대화 이력 API, LLM-01 스트리밍 검증.

LLM은 LLM_PROVIDER=fake로 대체되므로 실제 API를 호출하지 않는다.
"""

import json

import pytest
from fastapi.testclient import TestClient

ACCOUNT = {"email": "chatter@example.com", "password": "secret-password", "display_name": "대화자"}
OTHER = {"email": "other@example.com", "password": "secret-password", "display_name": "타인"}


def auth_headers(client: TestClient, account: dict[str, str]) -> dict[str, str]:
    client.post("/api/auth/signup", json=account)
    tokens = client.post(
        "/api/auth/login",
        json={"email": account["email"], "password": account["password"]},
    ).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def headers(api_client: TestClient) -> dict[str, str]:
    return auth_headers(api_client, ACCOUNT)


def create_conversation(client: TestClient, headers: dict[str, str], title: str = "첫 대화") -> str:
    res = client.post("/api/conversations", json={"title": title}, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


def test_conversations_require_authentication(api_client: TestClient) -> None:
    assert api_client.get("/api/conversations").status_code == 401
    assert api_client.post("/api/conversations", json={"title": "x"}).status_code == 401


def test_create_and_list_conversations(api_client: TestClient, headers: dict[str, str]) -> None:
    create_conversation(api_client, headers, "두 번째")
    create_conversation(api_client, headers, "첫 번째")

    res = api_client.get("/api/conversations", headers=headers)

    assert res.status_code == 200
    titles = [item["title"] for item in res.json()]
    assert set(titles) == {"첫 번째", "두 번째"}


def test_rename_conversation(api_client: TestClient, headers: dict[str, str]) -> None:
    conversation_id = create_conversation(api_client, headers)

    res = api_client.patch(
        f"/api/conversations/{conversation_id}", json={"title": "새 제목"}, headers=headers
    )

    assert res.status_code == 200
    assert res.json()["title"] == "새 제목"


def test_delete_conversation(api_client: TestClient, headers: dict[str, str]) -> None:
    conversation_id = create_conversation(api_client, headers)

    assert (
        api_client.delete(f"/api/conversations/{conversation_id}", headers=headers).status_code
        == 204
    )
    assert (
        api_client.get(f"/api/conversations/{conversation_id}", headers=headers).status_code == 404
    )


def test_other_users_conversation_is_not_found(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    """남의 대화는 403이 아니라 404로 숨긴다(존재 여부가 드러나지 않도록)."""
    conversation_id = create_conversation(api_client, headers)
    other_headers = auth_headers(api_client, OTHER)

    res = api_client.get(f"/api/conversations/{conversation_id}", headers=other_headers)

    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def read_sse_events(response) -> list[tuple[str, str]]:
    """SSE 본문을 (event, data) 목록으로 바꾼다."""
    events: list[tuple[str, str]] = []
    event = "message"
    for line in response.text.splitlines():
        if line.startswith("event:"):
            event = line.removeprefix("event:").strip()
        elif line.startswith("data:"):
            events.append((event, line.removeprefix("data:").strip()))
    return events


def test_stream_returns_tokens_and_saves_history(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    conversation_id = create_conversation(api_client, headers)

    res = api_client.post(
        f"/api/conversations/{conversation_id}/stream",
        json={"content": "안녕하세요"},
        headers=headers,
    )

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")

    events = read_sse_events(res)
    tokens = [data for name, data in events if name == "token"]
    assert tokens, "토큰 이벤트가 하나도 오지 않았습니다"
    assert any(name == "done" for name, _ in events)

    # 사용자 메시지와 응답이 모두 이력에 남는다.
    messages = api_client.get(
        f"/api/conversations/{conversation_id}/messages", headers=headers
    ).json()
    assert [message["role"] for message in messages] == ["user", "assistant"]
    assert messages[0]["content"] == "안녕하세요"
    assert messages[1]["content"]


def test_first_message_becomes_conversation_title(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    conversation_id = create_conversation(api_client, headers, "새 대화")

    api_client.post(
        f"/api/conversations/{conversation_id}/stream",
        json={"content": "파이썬 데코레이터가 뭔가요?"},
        headers=headers,
    )

    detail = api_client.get(f"/api/conversations/{conversation_id}", headers=headers).json()
    assert detail["title"] == "파이썬 데코레이터가 뭔가요?"


def test_conversation_detail_includes_messages(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    conversation_id = create_conversation(api_client, headers)
    api_client.post(
        f"/api/conversations/{conversation_id}/stream",
        json={"content": "첫 질문"},
        headers=headers,
    )

    detail = api_client.get(f"/api/conversations/{conversation_id}", headers=headers).json()

    assert len(detail["messages"]) == 2
    assert detail["messages"][0]["content"] == "첫 질문"


def test_empty_message_is_rejected(api_client: TestClient, headers: dict[str, str]) -> None:
    conversation_id = create_conversation(api_client, headers)

    res = api_client.post(
        f"/api/conversations/{conversation_id}/stream", json={"content": ""}, headers=headers
    )

    assert res.status_code == 422
    assert json.loads(res.text)["error"]["code"] == "VALIDATION_ERROR"
