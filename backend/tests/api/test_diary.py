"""배움일기 코치 API 검증 (스타터킷 활용 샘플 서비스).

SAMPLE-01(기본 흐름)과 DIARY-01~03(채팅 단위 일기, 제목·순번, 내일 할 것·푸터)을 확인한다.
"""

from collections.abc import Sequence
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.domain.chat.models import Message
from app.llm.chains.diary import DiaryDraft

ACCOUNT = {"email": "diary@example.com", "password": "secret-password", "display_name": "교육생"}
OTHER = {"email": "diary-other@example.com", "password": "secret-password", "display_name": "타인"}
ENTRY = {
    "title": "직접 쓴 일기",
    "learned": "의존성 주입",
    "difficult": "세션 범위",
    "next_plan": "테스트 작성",
}


def auth_headers(client: TestClient, account: dict[str, str]) -> dict[str, str]:
    client.post("/api/auth/signup", json=account)
    tokens = client.post(
        "/api/auth/login", json={"email": account["email"], "password": account["password"]}
    ).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def headers(api_client: TestClient) -> dict[str, str]:
    return auth_headers(api_client, ACCOUNT)


def today() -> date:
    return datetime.now(UTC).date()


def say(client: TestClient, headers: dict[str, str], conversation_id: str, content: str) -> None:
    res = client.post(
        f"/api/conversations/{conversation_id}/stream", json={"content": content}, headers=headers
    )
    assert res.status_code == 200


def start_chat(
    client: TestClient, headers: dict[str, str], content: str = "오늘 의존성 주입을 배웠어요"
) -> str:
    conversation_id = client.post(
        "/api/conversations", json={"title": "코칭"}, headers=headers
    ).json()["id"]
    say(client, headers, conversation_id, content)
    return conversation_id


def draft_for(client: TestClient, headers: dict[str, str], conversation_id: str) -> dict[str, Any]:
    res = client.post(
        "/api/diary/draft", json={"conversation_id": conversation_id}, headers=headers
    )
    assert res.status_code == 200, res.text
    return res.json()


def eligible_ids(client: TestClient, headers: dict[str, str]) -> list[str]:
    return [c["id"] for c in client.get("/api/diary/conversations", headers=headers).json()]


def test_diary_requires_authentication(api_client: TestClient) -> None:
    assert api_client.get("/api/diary").status_code == 401
    assert api_client.get("/api/diary/conversations").status_code == 401


def test_create_and_list_entry(api_client: TestClient, headers: dict[str, str]) -> None:
    created = api_client.post("/api/diary", json=ENTRY, headers=headers)

    assert created.status_code == 201
    body = created.json()
    assert body["title"] == ENTRY["title"]
    assert body["entry_date"] == today().isoformat()
    assert body["day_sequence"] == 1
    assert len(api_client.get("/api/diary", headers=headers).json()) == 1


def test_title_is_required(api_client: TestClient, headers: dict[str, str]) -> None:
    res = api_client.post("/api/diary", json={**ENTRY, "title": "   "}, headers=headers)

    assert res.status_code == 422


# --- DIARY-01 채팅 단위 일기와 재발행 조건 -------------------------------------------


def test_chats_with_messages_can_be_picked(api_client: TestClient, headers: dict[str, str]) -> None:
    conversation_id = start_chat(api_client, headers)
    api_client.post("/api/conversations", json={"title": "빈 대화"}, headers=headers)

    listed = api_client.get("/api/diary/conversations", headers=headers).json()

    assert [c["id"] for c in listed] == [conversation_id]
    assert listed[0]["diary_count"] == 0


def test_other_users_chats_are_not_listed(api_client: TestClient, headers: dict[str, str]) -> None:
    start_chat(api_client, headers)

    assert eligible_ids(api_client, auth_headers(api_client, OTHER)) == []


def test_draft_is_generated_from_the_chosen_chat(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    conversation_id = start_chat(api_client, headers)
    messages = api_client.get(f"/api/conversations/{conversation_id}", headers=headers).json()[
        "messages"
    ]

    draft = draft_for(api_client, headers, conversation_id)

    assert draft["conversation_id"] == conversation_id
    # 초안이 다룬 마지막 대화 시각. 저장할 때 그대로 돌려보낸다.
    assert datetime.fromisoformat(draft["source_last_message_at"]) == datetime.fromisoformat(
        messages[-1]["created_at"]
    )
    assert draft["learned"] and draft["learned_detail"] and draft["difficult"]


def test_written_chat_is_hidden_until_it_has_new_messages(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    conversation_id = start_chat(api_client, headers)
    saved = api_client.post(
        "/api/diary", json=draft_for(api_client, headers, conversation_id), headers=headers
    )
    assert saved.status_code == 201

    assert eligible_ids(api_client, headers) == []

    say(api_client, headers, conversation_id, "그다음에 테스트 픽스처를 배웠어요")
    listed = api_client.get("/api/diary/conversations", headers=headers).json()
    assert [c["id"] for c in listed] == [conversation_id]
    assert listed[0]["diary_count"] == 1


def test_chat_without_new_messages_is_rejected(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    """목록에서 숨기는 것만으로는 부족하다. API를 직접 불러도 막아야 한다."""
    conversation_id = start_chat(api_client, headers)
    draft = draft_for(api_client, headers, conversation_id)
    api_client.post("/api/diary", json=draft, headers=headers)

    redraft = api_client.post(
        "/api/diary/draft", json={"conversation_id": conversation_id}, headers=headers
    )
    resave = api_client.post("/api/diary", json=draft, headers=headers)
    without_time = {k: v for k, v in draft.items() if k != "source_last_message_at"}
    resave_without_time = api_client.post("/api/diary", json=without_time, headers=headers)

    assert redraft.status_code == 409
    assert resave.status_code == 409
    assert resave_without_time.status_code == 409


def test_rewrite_covers_only_new_messages(
    api_client: TestClient, headers: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    """다시 쓰는 일기는 새 대화가 주제이고, 이전 대화는 맥락으로만 넘긴다."""
    conversation_id = start_chat(api_client, headers, "의존성 주입을 배웠어요")
    api_client.post(
        "/api/diary", json=draft_for(api_client, headers, conversation_id), headers=headers
    )
    say(api_client, headers, conversation_id, "픽스처를 배웠어요")

    seen: dict[str, list[str]] = {}

    async def fake_draft(
        new_messages: Sequence[tuple[str, str]],
        context_messages: Sequence[tuple[str, str]] = (),
    ) -> DiaryDraft:
        seen["new"] = [content for _, content in new_messages]
        seen["context"] = [content for _, content in context_messages]
        return DiaryDraft(
            keywords="픽스처",
            learned="픽스처를 배웠다.",
            learned_detail="### 픽스처\n- 테스트 준비 코드",
            difficult="범위",
            next_plan="",
            next_plan_evidence="",
        )

    monkeypatch.setattr("app.domain.diary.services.draft_diary", fake_draft)
    draft = draft_for(api_client, headers, conversation_id)

    assert seen["new"][0] == "픽스처를 배웠어요"
    assert len(seen["new"]) == 2  # 새 질문과 그 답변
    assert seen["context"][0] == "의존성 주입을 배웠어요"
    assert api_client.post("/api/diary", json=draft, headers=headers).status_code == 201


def test_future_source_time_cannot_hide_the_chat(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    """실제보다 미래 시각을 보내도 마지막 대화 시각으로 맞춘다(채팅이 영영 숨는 일 방지)."""
    conversation_id = start_chat(api_client, headers)
    draft = draft_for(api_client, headers, conversation_id)
    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()

    saved = api_client.post(
        "/api/diary", json={**draft, "source_last_message_at": future}, headers=headers
    )
    say(api_client, headers, conversation_id, "하나 더 배웠어요")

    assert saved.status_code == 201
    assert eligible_ids(api_client, headers) == [conversation_id]


def test_source_time_without_timezone_is_rejected(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    conversation_id = start_chat(api_client, headers)
    draft = draft_for(api_client, headers, conversation_id)

    res = api_client.post(
        "/api/diary",
        json={**draft, "source_last_message_at": "2026-10-20T10:00:00"},
        headers=headers,
    )

    assert res.status_code == 422


def test_deleting_the_diary_makes_the_chat_available_again(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    conversation_id = start_chat(api_client, headers)
    entry = api_client.post(
        "/api/diary", json=draft_for(api_client, headers, conversation_id), headers=headers
    ).json()

    assert api_client.delete(f"/api/diary/{entry['id']}", headers=headers).status_code == 204
    assert api_client.get(f"/api/diary/{entry['id']}", headers=headers).status_code == 404
    assert eligible_ids(api_client, headers) == [conversation_id]


def test_draft_rejects_other_users_conversation(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    conversation_id = start_chat(api_client, headers)
    other_headers = auth_headers(api_client, OTHER)

    draft = api_client.post(
        "/api/diary/draft", json={"conversation_id": conversation_id}, headers=other_headers
    )
    save = api_client.post(
        "/api/diary", json={**ENTRY, "conversation_id": conversation_id}, headers=other_headers
    )

    assert draft.status_code == 404
    assert save.status_code == 404


def test_empty_conversation_cannot_become_a_diary(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    """대화는 있지만 메시지가 없으면 초안도, 저장도 할 수 없다."""
    conversation_id = api_client.post(
        "/api/conversations", json={"title": "빈 대화"}, headers=headers
    ).json()["id"]

    draft = api_client.post(
        "/api/diary/draft", json={"conversation_id": conversation_id}, headers=headers
    )
    save = api_client.post(
        "/api/diary", json={**ENTRY, "conversation_id": conversation_id}, headers=headers
    )

    assert draft.status_code == 404
    assert save.status_code == 404


# --- DIARY-02 제목·순번·배운 내용 상세 -------------------------------------------------


def test_title_is_today_and_keywords_whatever_the_chat_date(
    api_client: TestClient, headers: dict[str, str], db_session: Session
) -> None:
    conversation_id = start_chat(api_client, headers)
    # 채팅은 사흘 전에 했다고 가정한다.
    db_session.execute(
        update(Message)
        .where(Message.conversation_id == conversation_id)
        .values(created_at=datetime.now(UTC) - timedelta(days=3))
    )
    db_session.commit()

    draft = draft_for(api_client, headers, conversation_id)

    assert draft["entry_date"] == today().isoformat()
    assert draft["title"] == f"{today().isoformat()} 테스트 keywords"


def test_draft_uses_the_users_local_date(api_client: TestClient, headers: dict[str, str]) -> None:
    """서버(UTC)와 사용자 날짜가 다른 새벽 시간대: 화면이 보낸 날짜로 제목과 순번을 정한다."""
    local_day = (today() + timedelta(days=1)).isoformat()
    api_client.post("/api/diary", json={**ENTRY, "entry_date": local_day}, headers=headers)
    conversation_id = start_chat(api_client, headers)

    res = api_client.post(
        "/api/diary/draft",
        json={"conversation_id": conversation_id, "entry_date": local_day},
        headers=headers,
    )

    assert res.json()["entry_date"] == local_day
    assert res.json()["title"] == f"{local_day}(2) 테스트 keywords"


def test_several_entries_on_the_same_day(api_client: TestClient, headers: dict[str, str]) -> None:
    first = api_client.post("/api/diary", json=ENTRY, headers=headers)
    second = api_client.post("/api/diary", json=ENTRY, headers=headers)

    assert (first.status_code, second.status_code) == (201, 201)
    assert (first.json()["day_sequence"], second.json()["day_sequence"]) == (1, 2)
    listed = api_client.get("/api/diary", headers=headers).json()
    assert [e["day_sequence"] for e in listed] == [2, 1]  # 최신 일기가 위


def test_second_diary_of_the_day_gets_numbered_title(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    api_client.post("/api/diary", json=ENTRY, headers=headers)
    conversation_id = start_chat(api_client, headers)

    draft = draft_for(api_client, headers, conversation_id)
    saved = api_client.post("/api/diary", json=draft, headers=headers).json()

    assert draft["title"] == f"{today().isoformat()}(2) 테스트 keywords"
    assert saved["title"] == draft["title"]
    assert saved["day_sequence"] == 2


def test_saved_title_follows_the_actual_order(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    """초안을 만든 뒤 다른 일기가 먼저 저장되면 순번을 실제에 맞춘다."""
    conversation_id = start_chat(api_client, headers)
    draft = draft_for(api_client, headers, conversation_id)  # 이 시점엔 첫 일기
    api_client.post("/api/diary", json=ENTRY, headers=headers)  # 다른 일기가 먼저 저장됨

    saved = api_client.post("/api/diary", json=draft, headers=headers).json()

    assert saved["day_sequence"] == 2
    assert saved["title"] == f"{today().isoformat()}(2) 테스트 keywords"


def test_learned_detail_is_saved_as_markdown(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    detail = "### 의존성 주입\n- `Depends`로 세션을 받는다\n\n### 세션 범위\n요청마다 새로 연다."

    saved = api_client.post(
        "/api/diary", json={**ENTRY, "learned_detail": detail}, headers=headers
    ).json()

    assert saved["learned_detail"] == detail


def test_simultaneous_save_on_the_same_day_conflicts(
    api_client: TestClient, headers: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    """두 요청이 같은 순번을 동시에 계산한 경우를 흉내 낸다. 500이 아니라 409여야 한다."""
    api_client.post("/api/diary", json=ENTRY, headers=headers)
    monkeypatch.setattr(
        "app.domain.diary.repositories.DiaryRepository.next_day_sequence", lambda *_: 1
    )

    res = api_client.post("/api/diary", json=ENTRY, headers=headers)

    assert res.status_code == 409
    assert len(api_client.get("/api/diary", headers=headers).json()) == 1


# --- DIARY-03 내일 할 것·푸터 -------------------------------------------------------


def test_draft_leaves_next_plan_blank_without_a_plan_in_chat(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    """가짜 모델은 근거 없는 값을 채우므로 근거 확인에서 걸러져 비워진다."""
    conversation_id = start_chat(api_client, headers)

    assert draft_for(api_client, headers, conversation_id)["next_plan"] == ""


def test_blank_next_plan_is_saved_without_the_item(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    blank = api_client.post("/api/diary", json={**ENTRY, "next_plan": "  "}, headers=headers)
    missing = api_client.post(
        "/api/diary",
        json={k: v for k, v in ENTRY.items() if k != "next_plan"},
        headers=headers,
    )
    written = api_client.post("/api/diary", json=ENTRY, headers=headers)

    assert blank.json()["next_plan"] is None
    assert missing.json()["next_plan"] is None
    assert written.json()["next_plan"] == ENTRY["next_plan"]


def test_footer_is_fixed_when_saved(api_client: TestClient, headers: dict[str, str]) -> None:
    first = api_client.post("/api/diary", json=ENTRY, headers=headers).json()
    api_client.put(
        "/api/me/preferences",
        json={"catchphrase": "문구", "diary_footer": "새 푸터"},
        headers=headers,
    )
    second = api_client.post("/api/diary", json=ENTRY, headers=headers).json()
    edited = api_client.patch(
        f"/api/diary/{first['id']}", json={**ENTRY, "learned": "고쳐 쓴 내용"}, headers=headers
    ).json()

    assert first["footer"] == "감사 합니다."
    assert second["footer"] == "새 푸터"
    # 설정을 바꾸거나 일기를 고쳐도 지난 일기의 푸터는 그대로다.
    assert edited["footer"] == "감사 합니다."


def test_blank_footer_is_not_attached(api_client: TestClient, headers: dict[str, str]) -> None:
    api_client.put(
        "/api/me/preferences", json={"catchphrase": "문구", "diary_footer": ""}, headers=headers
    )

    assert api_client.post("/api/diary", json=ENTRY, headers=headers).json()["footer"] is None


# --- 수정·권한·주간 회고 --------------------------------------------------------------


def test_update_entry(api_client: TestClient, headers: dict[str, str]) -> None:
    entry_id = api_client.post("/api/diary", json=ENTRY, headers=headers).json()["id"]

    updated = api_client.patch(
        f"/api/diary/{entry_id}",
        json={**ENTRY, "title": "고친 제목", "learned_detail": "### 소제목", "next_plan": ""},
        headers=headers,
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["title"] == "고친 제목"
    assert body["learned_detail"] == "### 소제목"
    assert body["next_plan"] is None


def test_other_users_entry_is_not_found(api_client: TestClient, headers: dict[str, str]) -> None:
    entry_id = api_client.post("/api/diary", json=ENTRY, headers=headers).json()["id"]
    other_headers = auth_headers(api_client, OTHER)

    assert api_client.get(f"/api/diary/{entry_id}", headers=other_headers).status_code == 404
    assert api_client.delete(f"/api/diary/{entry_id}", headers=other_headers).status_code == 404


def test_weekly_review_summarizes_entries(api_client: TestClient, headers: dict[str, str]) -> None:
    monday = today() - timedelta(days=today().weekday())
    api_client.post("/api/diary", json={**ENTRY, "entry_date": monday.isoformat()}, headers=headers)
    api_client.post(
        "/api/diary",
        json={**ENTRY, "next_plan": None, "entry_date": (monday + timedelta(days=1)).isoformat()},
        headers=headers,
    )

    res = api_client.get("/api/diary/weekly", headers=headers)

    assert res.status_code == 200
    review = res.json()
    assert review["entry_count"] == 2
    assert review["week_start"] == monday.isoformat()
    assert review["grown"] and review["repeated_difficulty"] and review["suggestion"]


def test_weekly_review_without_entries_is_not_found(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    res = api_client.get("/api/diary/weekly", headers=headers)

    assert res.status_code == 404
