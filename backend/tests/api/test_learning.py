"""COACH-02: 실제 DB에서 회고 보관·복습 진행·계정 격리를 검증한다."""

import uuid
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, LLMError
from app.domain.diary import services
from app.domain.diary.models import DiaryStudyProgress, SavedWeeklyReview
from tests.api.test_diary import ACCOUNT, ENTRY, OTHER, auth_headers


@pytest.fixture
def owner(api_client: TestClient) -> dict[str, str]:
    return auth_headers(api_client, ACCOUNT)


def entry(client: TestClient, owner: dict[str, str], **fields: object) -> dict[str, Any]:
    response = client.post(
        "/api/diary", headers=owner, json={**ENTRY, "entry_date": "2026-10-21", **fields}
    )
    assert response.status_code == 201, response.text
    return response.json()


def review(
    client: TestClient, owner: dict[str, str], reference: str = "2026-10-21"
) -> dict[str, Any]:
    response = client.post("/api/diary/reviews", headers=owner, json={"reference": reference})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize(
    "method,path,payload",
    [
        ("GET", "/api/diary/reviews", None),
        ("POST", "/api/diary/reviews", {"reference": "2026-10-21"}),
        ("DELETE", f"/api/diary/reviews/{uuid.uuid4()}", None),
        ("GET", "/api/diary/study", None),
        ("PUT", f"/api/diary/study/{uuid.uuid4()}", {"completed": True}),
    ],
)
def test_learning_requires_auth(
    client: TestClient, method: str, path: str, payload: object
) -> None:
    assert client.request(method, path, json=payload).status_code == 401


def test_review_uses_whole_selected_week_and_is_saved(
    api_client: TestClient, owner: dict[str, str]
) -> None:
    entry(api_client, owner, entry_date="2026-10-19")
    entry(api_client, owner, entry_date="2026-10-25")
    entry(api_client, owner, entry_date="2026-10-26")
    result = review(api_client, owner, "2026-10-25")
    assert (result["week_start"], result["week_end"], result["entry_count"]) == (
        "2026-10-19",
        "2026-10-25",
        2,
    )
    assert result["grown"] and result["created_at"]
    assert api_client.get("/api/diary/reviews", headers=owner).json() == [result]
    assert review(api_client, owner, "2026-10-26")["entry_count"] == 1
    assert [
        item["week_start"] for item in api_client.get("/api/diary/reviews", headers=owner).json()
    ] == ["2026-10-26", "2026-10-19"]


def test_duplicate_review_keeps_snapshot_without_calling_llm(
    api_client: TestClient, owner: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    source = entry(api_client, owner)
    saved = review(api_client, owner)

    async def fail(*_args: object) -> None:
        raise AssertionError("이미 저장한 주는 LLM을 호출하면 안 된다")

    monkeypatch.setattr(services, "review_week", fail)
    api_client.delete(f"/api/diary/{source['id']}", headers=owner)
    # 원본 일기를 모두 삭제해도 이미 저장한 회고를 반환한다.
    assert review(api_client, owner, "2026-10-19") == saved
    assert api_client.get("/api/diary/reviews", headers=owner).json() == [saved]


def test_empty_week_does_not_create_review(api_client: TestClient, owner: dict[str, str]) -> None:
    response = api_client.post(
        "/api/diary/reviews", headers=owner, json={"reference": "2026-10-21"}
    )
    assert response.status_code == 404
    assert api_client.get("/api/diary/reviews", headers=owner).json() == []
    assert (
        api_client.post(
            "/api/diary/reviews", headers=owner, json={"reference": "not-a-date"}
        ).status_code
        == 422
    )


def test_llm_failure_leaves_no_saved_review(
    api_client: TestClient, owner: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    entry(api_client, owner)

    async def fail(*_args: object) -> None:
        raise LLMError("일시적인 생성 실패")

    monkeypatch.setattr(services, "review_week", fail)
    assert (
        api_client.post(
            "/api/diary/reviews", headers=owner, json={"reference": "2026-10-21"}
        ).status_code
        == 502
    )
    assert api_client.get("/api/diary/reviews", headers=owner).json() == []


def test_other_users_cannot_read_or_change_learning_data(
    api_client: TestClient, owner: dict[str, str]
) -> None:
    source = entry(api_client, owner)
    saved = review(api_client, owner)
    other = auth_headers(api_client, OTHER)
    assert api_client.get("/api/diary/reviews", headers=other).json() == []
    assert api_client.get("/api/diary/study", headers=other).json() == []
    assert api_client.delete(f"/api/diary/reviews/{saved['id']}", headers=other).status_code == 404
    assert (
        api_client.put(
            f"/api/diary/study/{source['id']}",
            headers=other,
            json={"completed": True, "note": "타인 메모"},
        ).status_code
        == 404
    )
    assert api_client.get("/api/diary/study", headers=owner).json()[0]["note"] == ""
    assert len(api_client.get("/api/diary/reviews", headers=owner).json()) == 1


def test_review_delete_allows_regeneration_without_deleting_diary(
    api_client: TestClient, owner: dict[str, str]
) -> None:
    entry(api_client, owner)
    saved = review(api_client, owner)
    assert api_client.delete(f"/api/diary/reviews/{saved['id']}", headers=owner).status_code == 204
    assert api_client.get("/api/diary/reviews", headers=owner).json() == []
    assert len(api_client.get("/api/diary", headers=owner).json()) == 1
    assert review(api_client, owner)["id"] != saved["id"]


def test_study_notes_completion_and_reopen_persist(
    api_client: TestClient, owner: dict[str, str]
) -> None:
    source = entry(api_client, owner, learned_detail="### 세션\n요청마다 연결을 관리한다")
    items = api_client.get("/api/diary/study", headers=owner).json()
    assert len(items) == 1
    assert items[0]["entry_id"] == source["id"] and not items[0]["completed"]
    assert items[0]["learned_detail"] == source["learned_detail"]
    url = f"/api/diary/study/{source['id']}"
    memo = api_client.put(
        url, headers=owner, json={"completed": False, "note": "Depends의 세션 범위를 이해했다"}
    ).json()
    assert memo["reviewed_at"] is None
    completed = api_client.put(
        url, headers=owner, json={"completed": True, "note": memo["note"]}
    ).json()
    assert completed["reviewed_at"] and completed["completed"]
    assert (
        api_client.put(url, headers=owner, json={"completed": True, "note": memo["note"]}).json()[
            "reviewed_at"
        ]
        == completed["reviewed_at"]
    )
    assert api_client.get("/api/diary/study", headers=owner).json() == [completed]
    reopened = api_client.put(
        url, headers=owner, json={"completed": False, "note": memo["note"]}
    ).json()
    assert (
        not reopened["completed"]
        and reopened["reviewed_at"] is None
        and reopened["note"] == memo["note"]
    )
    assert (
        api_client.put(
            url, headers=owner, json={"completed": False, "note": "x" * 10001}
        ).status_code
        == 422
    )


def test_no_difficulty_is_excluded(api_client: TestClient, owner: dict[str, str]) -> None:
    for value in ("없음", "없어요.", "해당 없음"):
        source = entry(api_client, owner, difficult=value)
        assert (
            api_client.put(
                f"/api/diary/study/{source['id']}", headers=owner, json={"completed": True}
            ).status_code
            == 404
        )
    assert api_client.get("/api/diary/study", headers=owner).json() == []


def test_source_changes_reopen_study_but_preserve_notes_and_delete_cascades(
    api_client: TestClient, owner: dict[str, str], db_session: Session
) -> None:
    source = entry(api_client, owner)
    url = f"/api/diary/study/{source['id']}"
    api_client.put(url, headers=owner, json={"completed": True, "note": "내가 쓴 메모"})
    # 제목만 고친 경우 완료를 유지한다.
    api_client.patch(
        f"/api/diary/{source['id']}", headers=owner, json={**ENTRY, "title": "고친 제목"}
    )
    assert api_client.get("/api/diary/study", headers=owner).json()[0]["completed"]
    api_client.patch(
        f"/api/diary/{source['id']}", headers=owner, json={**ENTRY, "difficult": "새로 어려운 내용"}
    )
    updated = api_client.get("/api/diary/study", headers=owner).json()[0]
    assert not updated["completed"] and updated["reviewed_at"] is None
    assert updated["note"] == "내가 쓴 메모" and updated["difficult"] == "새로 어려운 내용"
    api_client.delete(f"/api/diary/{source['id']}", headers=owner)
    assert api_client.get("/api/diary/study", headers=owner).json() == []
    assert (
        db_session.scalar(
            select(DiaryStudyProgress.entry_id).where(
                DiaryStudyProgress.entry_id == uuid.UUID(source["id"])
            )
        )
        is None
    )


@pytest.mark.parametrize("winner_exists", [True, False])
async def test_weekly_concurrent_insert_is_resolved(
    api_client: TestClient,
    owner: dict[str, str],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    winner_exists: bool,
) -> None:
    entry(api_client, owner)
    saved = review(api_client, owner)
    existing = db_session.scalar(
        select(SavedWeeklyReview).where(SavedWeeklyReview.id == uuid.UUID(saved["id"]))
    )
    assert existing is not None
    user_id = existing.user_id
    service = services.LearningService(db_session)
    results = iter([None, existing if winner_exists else None])
    monkeypatch.setattr(service.repo, "review_for_week", lambda *_args: next(results))

    def collision(*_args: object, **_kwargs: object) -> None:
        raise IntegrityError("insert", {}, Exception("duplicate"))

    monkeypatch.setattr(service.repo, "create_review", collision)
    if winner_exists:
        assert (await service.create_review(user_id, date(2026, 10, 21))).id == existing.id
    else:
        # 해당 사용자의 일기는 존재해야 LLM 생성 뒤 INSERT까지 도달한다.
        with pytest.raises(ConflictError):
            await service.create_review(user_id, date(2026, 10, 21))
