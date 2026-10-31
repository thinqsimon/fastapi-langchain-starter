"""CHAT-03: 내 답변 수준 저장, 단계 이름(관리자 변경), 채팅·일기에 수준이 실리는지."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.domain.answer_level.models import AnswerLevelName
from app.llm.prompts.answer_level import LEVEL_INSTRUCTIONS
from tests.api.accounts import ADMIN, MEMBER
from tests.api.test_diary import auth_headers, draft_for, say, start_chat

LEVELS = "/api/answer-levels"
MY_LEVEL = "/api/auth/me/answer-level"


@pytest.fixture
def clean_names(db_session: Session) -> None:
    """E2E가 같은 로컬 DB에 남긴 이름 변경이 있을 수 있어 트랜잭션 안에서 지우고 시작한다."""
    db_session.query(AnswerLevelName).delete()
    db_session.flush()


def test_new_user_has_no_level_and_can_choose_one(api_client: TestClient) -> None:
    headers = auth_headers(api_client, MEMBER)
    assert api_client.get("/api/auth/me", headers=headers).json()["answer_level"] is None

    res = api_client.put(MY_LEVEL, json={"answer_level": 4}, headers=headers)
    assert res.status_code == 200 and res.json()["answer_level"] == 4
    assert api_client.get("/api/auth/me", headers=headers).json()["answer_level"] == 4

    for bad in (0, 6, "3단계", None):
        assert (
            api_client.put(MY_LEVEL, json={"answer_level": bad}, headers=headers).status_code == 422
        )
    assert api_client.put(MY_LEVEL, json={"answer_level": 3}).status_code == 401


def test_level_list_shows_default_names_and_descriptions(
    api_client: TestClient, clean_names: None
) -> None:
    headers = auth_headers(api_client, MEMBER)
    levels = api_client.get(LEVELS, headers=headers).json()

    assert [(lv["level"], lv["name"]) for lv in levels] == [
        (1, "왕초보"),
        (2, "입문"),
        (3, "기초"),
        (4, "실전"),
        (5, "심화"),
    ]
    assert all(lv["audience"] and lv["style"] and lv["example"] for lv in levels)
    assert api_client.get(LEVELS).status_code == 401


def test_admin_renames_and_resets_a_level_name(
    api_client: TestClient, admin_enabled: None, clean_names: None
) -> None:
    admin = auth_headers(api_client, ADMIN)
    member = auth_headers(api_client, MEMBER)

    res = api_client.patch("/api/admin/answer-levels/1", json={"name": "  새내기 "}, headers=admin)
    assert res.status_code == 200
    assert (res.json()["name"], res.json()["default_name"]) == ("새내기", "왕초보")
    assert api_client.get(LEVELS, headers=member).json()[0]["name"] == "새내기"

    # 기본 이름과 같게 바꾸면 따로 저장하지 않는다. 기본 이름으로 되돌리기도 된다.
    api_client.patch("/api/admin/answer-levels/2", json={"name": "입문"}, headers=admin)
    res = api_client.delete("/api/admin/answer-levels/1/name", headers=admin)
    assert res.status_code == 200 and res.json()["name"] == "왕초보"
    assert [lv["name"] for lv in api_client.get(LEVELS, headers=member).json()][:2] == [
        "왕초보",
        "입문",
    ]

    bad = [
        api_client.patch("/api/admin/answer-levels/9", json={"name": "x"}, headers=admin),
        api_client.patch("/api/admin/answer-levels/1", json={"name": "   "}, headers=admin),
        api_client.patch("/api/admin/answer-levels/1", json={"name": "가" * 21}, headers=admin),
    ]
    assert [r.status_code for r in bad] == [422, 422, 422]
    assert (
        api_client.patch(
            "/api/admin/answer-levels/1", json={"name": "x"}, headers=member
        ).status_code
        == 403
    )


def _capture_chat_system_prompt(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    from app.llm.chains import chat
    from app.llm.prompts.chat import build_chat_prompt

    seen: list[str] = []

    def spy(system_prompt: str) -> Any:
        seen.append(system_prompt)
        return build_chat_prompt(system_prompt)

    monkeypatch.setattr(chat, "build_chat_prompt", spy)
    return seen


def test_chat_answers_at_level_2_until_chosen_then_at_the_chosen_level(
    api_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen = _capture_chat_system_prompt(monkeypatch)
    headers = auth_headers(api_client, MEMBER)
    conversation_id = start_chat(api_client, headers)

    say(api_client, headers, conversation_id, "API가 뭐예요?")
    assert LEVEL_INSTRUCTIONS[2] in seen[-1]

    api_client.put(MY_LEVEL, json={"answer_level": 5}, headers=headers)
    say(api_client, headers, conversation_id, "REST는요?")
    assert LEVEL_INSTRUCTIONS[5] in seen[-1] and LEVEL_INSTRUCTIONS[2] not in seen[-1]


def test_diary_draft_and_weekly_review_get_the_users_level(
    api_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.domain.diary import services
    from app.llm.chains import diary

    levels: list[int | None] = []
    real_draft, real_review = diary.draft_diary, diary.review_week

    async def draft_spy(*args: Any, **kwargs: Any) -> Any:
        levels.append(kwargs.get("answer_level"))
        return await real_draft(*args, **kwargs)

    async def review_spy(*args: Any, **kwargs: Any) -> Any:
        levels.append(kwargs.get("answer_level"))
        return await real_review(*args, **kwargs)

    monkeypatch.setattr(services, "draft_diary", draft_spy)
    monkeypatch.setattr(services, "review_week", review_spy)

    headers = auth_headers(api_client, MEMBER)
    api_client.put(MY_LEVEL, json={"answer_level": 3}, headers=headers)
    conversation_id = start_chat(api_client, headers)
    say(api_client, headers, conversation_id, "오늘 JWT를 배웠어요")
    draft = draft_for(api_client, headers, conversation_id)
    assert api_client.post("/api/diary", json=draft, headers=headers).status_code == 201
    assert api_client.get("/api/diary/weekly", headers=headers).status_code == 200

    assert levels == [3, 3]
