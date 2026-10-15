"""SAMPLE-01 배움일기 코치 API 검증 (스타터킷 활용 샘플 서비스)."""

from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

ACCOUNT = {"email": "diary@example.com", "password": "secret-password", "display_name": "교육생"}
OTHER = {"email": "diary-other@example.com", "password": "secret-password", "display_name": "타인"}
ENTRY = {"learned": "의존성 주입", "difficult": "세션 범위", "next_plan": "테스트 작성"}


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


def test_diary_requires_authentication(api_client: TestClient) -> None:
    assert api_client.get("/api/diary").status_code == 401


def test_create_and_list_entry(api_client: TestClient, headers: dict[str, str]) -> None:
    created = api_client.post("/api/diary", json=ENTRY, headers=headers)

    assert created.status_code == 201
    assert created.json()["learned"] == ENTRY["learned"]
    assert created.json()["entry_date"] == today().isoformat()

    listed = api_client.get("/api/diary", headers=headers).json()
    assert len(listed) == 1


def test_one_entry_per_day(api_client: TestClient, headers: dict[str, str]) -> None:
    api_client.post("/api/diary", json=ENTRY, headers=headers)

    duplicate = api_client.post("/api/diary", json=ENTRY, headers=headers)

    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "CONFLICT"


def test_update_entry(api_client: TestClient, headers: dict[str, str]) -> None:
    entry_id = api_client.post("/api/diary", json=ENTRY, headers=headers).json()["id"]

    updated = api_client.patch(
        f"/api/diary/{entry_id}",
        json={**ENTRY, "learned": "고쳐 쓴 내용"},
        headers=headers,
    )

    assert updated.status_code == 200
    assert updated.json()["learned"] == "고쳐 쓴 내용"


def test_other_users_entry_is_not_found(api_client: TestClient, headers: dict[str, str]) -> None:
    entry_id = api_client.post("/api/diary", json=ENTRY, headers=headers).json()["id"]
    other_headers = auth_headers(api_client, OTHER)

    res = api_client.get(f"/api/diary/{entry_id}", headers=other_headers)

    assert res.status_code == 404


def test_draft_is_generated_from_conversation(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    """코칭 대화 → 일기 초안. 스타터킷의 대화 기능을 그대로 재사용한다."""
    conversation_id = api_client.post(
        "/api/conversations", json={"title": "오늘 코칭"}, headers=headers
    ).json()["id"]
    api_client.post(
        f"/api/conversations/{conversation_id}/stream",
        json={"content": "오늘 의존성 주입을 배웠어요"},
        headers=headers,
    )

    res = api_client.post(
        "/api/diary/draft", json={"conversation_id": conversation_id}, headers=headers
    )

    assert res.status_code == 200
    draft = res.json()
    assert set(draft) == {"learned", "difficult", "next_plan"}
    assert all(draft.values())


def test_draft_rejects_other_users_conversation(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    conversation_id = api_client.post(
        "/api/conversations", json={"title": "비밀"}, headers=headers
    ).json()["id"]
    other_headers = auth_headers(api_client, OTHER)

    res = api_client.post(
        "/api/diary/draft", json={"conversation_id": conversation_id}, headers=other_headers
    )

    assert res.status_code == 404


def test_weekly_review_summarizes_entries(api_client: TestClient, headers: dict[str, str]) -> None:
    monday = today() - timedelta(days=today().weekday())
    for offset in (0, 1):
        api_client.post(
            "/api/diary",
            json={**ENTRY, "entry_date": (monday + timedelta(days=offset)).isoformat()},
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


def test_draft_from_empty_conversation_is_not_found(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    """대화는 있지만 메시지가 없으면 초안을 만들 수 없다."""
    conversation_id = api_client.post(
        "/api/conversations", json={"title": "빈 대화"}, headers=headers
    ).json()["id"]

    res = api_client.post(
        "/api/diary/draft", json={"conversation_id": conversation_id}, headers=headers
    )

    assert res.status_code == 404
