"""CHAT-04: 답변마다 수준을 기록하고, 한 번만 다른 수준으로 묻고, 추천 질문을 함께 받는다."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx import Response

from app.llm.fake import DEFAULT_REPLY, FAKE_QUESTIONS
from app.llm.prompts.answer_level import LEVEL_INSTRUCTIONS, REANSWER_INSTRUCTION
from app.llm.prompts.suggested_questions import OPEN_TAG
from tests.api.accounts import MEMBER
from tests.api.test_chat import read_sse_events
from tests.api.test_diary import auth_headers

MY_LEVEL = "/api/auth/me/answer-level"
SUGGEST = "/api/me/preferences/suggest-questions"


def start(client: TestClient) -> tuple[dict[str, str], str]:
    headers = auth_headers(client, MEMBER)
    conversation_id = client.post(
        "/api/conversations", json={"title": "학습"}, headers=headers
    ).json()["id"]
    return headers, conversation_id


def ask(
    client: TestClient,
    headers: dict[str, str],
    conversation_id: str,
    content: str,
    answer_level: int | None = None,
) -> Response:
    body: dict[str, object] = {"content": content}
    if answer_level is not None:
        body["answer_level"] = answer_level
    res = client.post(f"/api/conversations/{conversation_id}/stream", json=body, headers=headers)
    assert res.status_code == 200, res.text
    return res


def history(
    client: TestClient, headers: dict[str, str], conversation_id: str
) -> list[dict[str, object]]:
    res = client.get(f"/api/conversations/{conversation_id}/messages", headers=headers)
    return res.json()


def test_each_answer_keeps_its_level_and_a_one_time_level_leaves_the_setting(
    api_client: TestClient,
) -> None:
    headers, conversation_id = start(api_client)

    ask(api_client, headers, conversation_id, "API가 뭐예요?")
    ask(api_client, headers, conversation_id, "API가 뭐예요?", answer_level=4)

    assert [
        (m["role"], m["answer_level"]) for m in history(api_client, headers, conversation_id)
    ] == [
        ("user", None),
        ("assistant", 2),
        ("user", None),
        ("assistant", 4),
    ]
    # 이번 한 번만 바꾼 것이라 아직 고르지 않은 상태 그대로다.
    assert api_client.get("/api/auth/me", headers=headers).json()["answer_level"] is None

    api_client.put(MY_LEVEL, json={"answer_level": 5}, headers=headers)
    ask(api_client, headers, conversation_id, "REST는요?")
    assert history(api_client, headers, conversation_id)[-1]["answer_level"] == 5


def test_same_question_at_another_level_asks_for_a_fresh_explanation(
    api_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.llm.chains import chat
    from app.llm.prompts.chat import build_chat_prompt

    seen: list[str] = []

    def spy(system_prompt: str) -> Any:
        seen.append(system_prompt)
        return build_chat_prompt(system_prompt)

    monkeypatch.setattr(chat, "build_chat_prompt", spy)
    headers, conversation_id = start(api_client)

    ask(api_client, headers, conversation_id, "API가 뭐예요?")
    assert REANSWER_INSTRUCTION not in seen[-1]
    # 답변 아래 수준 버튼: 같은 질문을 1단계로 다시 보낸다.
    # 앞 답변을 가리키지 말고 새로 설명하게 한다.
    ask(api_client, headers, conversation_id, "API가 뭐예요?", answer_level=1)
    assert LEVEL_INSTRUCTIONS[1] in seen[-1] and REANSWER_INSTRUCTION in seen[-1]

    # 새 질문에 수준만 실어 보내거나, 같은 질문을 수준 없이 다시 보내면 붙이지 않는다.
    ask(api_client, headers, conversation_id, "REST는요?", answer_level=3)
    assert REANSWER_INSTRUCTION not in seen[-1]
    ask(api_client, headers, conversation_id, "API가 뭐예요?")
    assert REANSWER_INSTRUCTION not in seen[-1]


def test_one_time_level_outside_1_to_5_is_rejected(api_client: TestClient) -> None:
    headers, conversation_id = start(api_client)

    res = api_client.post(
        f"/api/conversations/{conversation_id}/stream",
        json={"content": "질문", "answer_level": 6},
        headers=headers,
    )

    assert res.status_code == 422


def test_suggested_questions_are_off_until_turned_on(api_client: TestClient) -> None:
    headers, conversation_id = start(api_client)

    ask(api_client, headers, conversation_id, "useEffect가 뭐예요?")

    assert (
        api_client.get("/api/me/preferences", headers=headers).json()["suggest_questions"] is False
    )
    assert history(api_client, headers, conversation_id)[-1]["suggested_questions"] == []


def test_turned_on_answers_keep_three_questions_without_showing_the_tag(
    api_client: TestClient,
) -> None:
    headers, conversation_id = start(api_client)
    turned_on = api_client.put(SUGGEST, json={"enabled": True}, headers=headers)
    assert turned_on.status_code == 200 and turned_on.json()["suggest_questions"] is True

    res = ask(api_client, headers, conversation_id, "useEffect가 뭐예요?")

    streamed = "".join(data for name, data in read_sse_events(res) if name == "token")
    assert OPEN_TAG not in streamed
    assert not any(question in streamed for question in FAKE_QUESTIONS)
    answer = history(api_client, headers, conversation_id)[-1]
    assert answer["content"] == DEFAULT_REPLY
    assert answer["suggested_questions"] == list(FAKE_QUESTIONS)

    api_client.put(SUGGEST, json={"enabled": False}, headers=headers)
    ask(api_client, headers, conversation_id, "그다음은요?")
    assert history(api_client, headers, conversation_id)[-1]["suggested_questions"] == []
