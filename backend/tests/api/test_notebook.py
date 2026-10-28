"""NOTE-01: 학습장 업로드·주제 CRUD·계정 격리를 실제 DB에서 검증한다."""

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
from app.domain.auth.models import User
from app.domain.notebook.models import Notebook, NotebookTopic
from app.domain.notebook.services import NotebookService
from tests.api.test_diary import auth_headers

ACCOUNT = {
    "email": "notebook@example.com",
    "password": "secret-password",
    "display_name": "교육생",
}
OTHER = {
    "email": "notebook-other@example.com",
    "password": "secret-password",
    "display_name": "타인",
}
FILENAME = "2026-10-27_01.md"
SAMPLE = """---
title: SpaceXyzDiary 배움노트 #01
project: SpaceXyzDiary
---
# SpaceXyzDiary 배움노트 #01 · 2026-10-27

> 첫 줄 요약.

## 목차
| # | 주제 |
|---|---|
| 1 | 스킬 만들기 |

## 1. 스킬 만들기
> 한 줄 요약.

`유형` 워크플로 | `태그` claude-code, skill | `난이도` ★☆☆

### 핵심 개념
본문.

```markdown
## 코드 블록 안의 제목은 주제가 아니다
```

---

## 2. 유니코드 정규화
`유형` 문제해결 | `태그` unicode | `난이도` ★★★

증상 설명.
"""


@pytest.fixture
def owner(api_client: TestClient) -> dict[str, str]:
    return auth_headers(api_client, ACCOUNT)


@pytest.fixture
def other(api_client: TestClient) -> dict[str, str]:
    return auth_headers(api_client, OTHER)


def upload(
    client: TestClient,
    headers: dict[str, str],
    filename: str = FILENAME,
    content: str = SAMPLE,
) -> dict[str, Any]:
    response = client.post(
        "/api/notebooks/upload",
        headers=headers,
        json={"filename": filename, "content": content},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_upload_accepts_hand_edited_study_note(
    api_client: TestClient, owner: dict[str, str]
) -> None:
    # 번호 없는 제목, 메타 줄이 한 주제에만 있어도 스킬 노트 서명으로 본다.
    content = (
        "---\ntitle: 손으로 고친 노트\nproject: P\n---\n"
        "## 주제 하나\n`유형` 개념 | `태그` a\n본문\n\n## 메타 없는 주제\n본문\n"
    )
    notebook = upload(api_client, owner, filename="P_2026-10-28_01.md", content=content)

    assert notebook["title"] == "손으로 고친 노트"
    assert [topic["title"] for topic in notebook["topics"]] == ["주제 하나", "메타 없는 주제"]


def test_manual_notebook_and_topic_crud(api_client: TestClient, owner: dict[str, str]) -> None:
    created = api_client.post("/api/notebooks", headers=owner, json={"title": " 직접 쓴 학습장 "})
    assert created.status_code == 201, created.text
    notebook = created.json()
    assert notebook["title"] == "직접 쓴 학습장"
    assert notebook["filename"] is None
    assert notebook["topics"] == []

    first = api_client.post(
        f"/api/notebooks/{notebook['id']}/topics",
        headers=owner,
        json={
            "title": "새 주제",
            "tags": ["a, b", " c "],
            "kind": " 개념 ",
            "difficulty": 2,
            "content": "본문",
        },
    )
    assert first.status_code == 201, first.text
    topic = first.json()
    assert (topic["position"], topic["kind"], topic["tags"]) == (1, "개념", ["a", "b", "c"])
    assert (topic["difficulty"], topic["content"], topic["completed"]) == (2, "본문", False)

    second = api_client.post(
        f"/api/notebooks/{notebook['id']}/topics", headers=owner, json={"title": "둘째"}
    ).json()
    assert second["position"] == 2

    done = api_client.patch(
        f"/api/notebooks/topics/{topic['id']}", headers=owner, json={"completed": True}
    )
    assert done.status_code == 200, done.text
    assert done.json()["completed"] is True
    assert done.json()["title"] == "새 주제"
    assert done.json()["tags"] == ["a", "b", "c"]

    edited = api_client.patch(
        f"/api/notebooks/topics/{topic['id']}",
        headers=owner,
        json={
            "kind": "",
            "difficulty": None,
            "title": "바꾼 제목",
            "content": "새 본문",
            "tags": [],
        },
    ).json()
    assert (edited["kind"], edited["difficulty"], edited["title"]) == (None, None, "바꾼 제목")
    assert (edited["content"], edited["tags"], edited["completed"]) == ("새 본문", [], True)

    assert (
        api_client.patch(
            f"/api/notebooks/topics/{topic['id']}", headers=owner, json={"title": "   "}
        ).status_code
        == 422
    )
    assert (
        api_client.patch(
            f"/api/notebooks/topics/{topic['id']}", headers=owner, json={"difficulty": 9}
        ).status_code
        == 422
    )
    assert (
        api_client.post(
            f"/api/notebooks/{notebook['id']}/topics", headers=owner, json={"title": ""}
        ).status_code
        == 422
    )

    renamed = api_client.patch(
        f"/api/notebooks/{notebook['id']}", headers=owner, json={"title": "이름 변경"}
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["title"] == "이름 변경"
    assert [item["title"] for item in renamed.json()["topics"]] == ["바꾼 제목", "둘째"]

    assert (
        api_client.delete(f"/api/notebooks/topics/{topic['id']}", headers=owner).status_code == 204
    )
    assert api_client.get(f"/api/notebooks/topics/{topic['id']}", headers=owner).status_code == 404
    # 지운 번호는 다시 쓰지 않는다.
    third = api_client.post(
        f"/api/notebooks/{notebook['id']}/topics", headers=owner, json={"title": "셋째"}
    ).json()
    assert third["position"] == 3

    assert api_client.delete(f"/api/notebooks/{notebook['id']}", headers=owner).status_code == 204
    assert api_client.get("/api/notebooks", headers=owner).json() == []
    assert api_client.get(f"/api/notebooks/topics/{third['id']}", headers=owner).status_code == 404


def test_keep_topics_in_bulk_and_one_by_one(api_client: TestClient, owner: dict[str, str]) -> None:
    notebook = upload(api_client, owner)
    first, second = (topic["id"] for topic in notebook["topics"])
    assert all(topic["kept"] is False and topic["kept_at"] is None for topic in notebook["topics"])

    kept = api_client.patch(
        "/api/notebooks/topics/keep",
        headers=owner,
        json={"topic_ids": [second, first, first], "kept": True},
    )
    assert kept.status_code == 200, kept.text
    assert [topic["id"] for topic in kept.json()] == [second, first]
    assert all(topic["kept"] is True and topic["kept_at"] for topic in kept.json())
    assert "content" not in kept.json()[0]

    listed = api_client.get("/api/notebooks", headers=owner).json()[0]["topics"]
    assert [topic["kept"] for topic in listed] == [True, True]

    released = api_client.patch(
        "/api/notebooks/topics/keep", headers=owner, json={"topic_ids": [first], "kept": False}
    ).json()
    assert (released[0]["kept"], released[0]["kept_at"]) == (False, None)

    single = api_client.patch(
        f"/api/notebooks/topics/{second}", headers=owner, json={"kept": False}
    ).json()
    assert (single["kept"], single["kept_at"], single["title"]) == (False, None, "유니코드 정규화")
    assert single["completed"] is False

    assert (
        api_client.patch(
            "/api/notebooks/topics/keep", headers=owner, json={"topic_ids": [], "kept": True}
        ).status_code
        == 422
    )


def test_keep_rejects_foreign_topic_and_changes_nothing(
    api_client: TestClient, owner: dict[str, str], other: dict[str, str]
) -> None:
    mine = upload(api_client, owner)["topics"][0]["id"]
    theirs = upload(api_client, other)["topics"][0]["id"]

    response = api_client.patch(
        "/api/notebooks/topics/keep",
        headers=owner,
        json={"topic_ids": [mine, theirs], "kept": True},
    )
    assert response.status_code == 404, response.text

    assert api_client.get(f"/api/notebooks/topics/{mine}", headers=owner).json()["kept"] is False
    assert api_client.get(f"/api/notebooks/topics/{theirs}", headers=other).json()["kept"] is False
    assert (
        api_client.patch(
            "/api/notebooks/topics/keep",
            headers=owner,
            json={"topic_ids": [str(uuid.uuid4())], "kept": True},
        ).status_code
        == 404
    )


def test_delete_notebook_cascades_topics(
    api_client: TestClient, owner: dict[str, str], db_session: Session
) -> None:
    notebook = upload(api_client, owner)
    notebook_id = uuid.UUID(notebook["id"])
    assert (
        db_session.scalar(select(NotebookTopic).where(NotebookTopic.notebook_id == notebook_id))
        is not None
    )

    assert api_client.delete(f"/api/notebooks/{notebook_id}", headers=owner).status_code == 204

    assert db_session.scalar(select(Notebook).where(Notebook.id == notebook_id)) is None
    assert (
        db_session.scalar(select(NotebookTopic).where(NotebookTopic.notebook_id == notebook_id))
        is None
    )


def test_other_user_gets_404_and_empty_list(
    api_client: TestClient, owner: dict[str, str], other: dict[str, str]
) -> None:
    notebook = upload(api_client, owner)
    topic_id = notebook["topics"][0]["id"]
    notebook_id = notebook["id"]

    assert api_client.get("/api/notebooks", headers=other).json() == []
    attempts = [
        ("GET", f"/api/notebooks/topics/{topic_id}", None),
        ("PATCH", f"/api/notebooks/topics/{topic_id}", {"completed": True}),
        ("DELETE", f"/api/notebooks/topics/{topic_id}", None),
        ("POST", f"/api/notebooks/{notebook_id}/topics", {"title": "침입"}),
        ("PATCH", f"/api/notebooks/{notebook_id}", {"title": "침입"}),
        ("DELETE", f"/api/notebooks/{notebook_id}", None),
    ]
    for method, path, payload in attempts:
        response = api_client.request(method, path, headers=other, json=payload)
        assert response.status_code == 404, (method, path, response.text)
        assert response.json()["error"]["code"] == "NOT_FOUND"

    # 존재하지 않는 id도 같은 404다.
    assert api_client.get(f"/api/notebooks/topics/{uuid.uuid4()}", headers=owner).status_code == 404
    assert api_client.delete(f"/api/notebooks/{uuid.uuid4()}", headers=owner).status_code == 404

    mine = api_client.get("/api/notebooks", headers=owner).json()
    assert mine[0]["title"] == "SpaceXyzDiary 배움노트 #01"
    assert mine[0]["topics"][0]["completed"] is False
    assert len(mine[0]["topics"]) == 2


def test_concurrent_upload_collision_becomes_conflict(
    api_client: TestClient,
    owner: dict[str, str],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = db_session.scalar(select(User).where(User.email == ACCOUNT["email"]))
    assert user is not None
    service = NotebookService(db_session)
    # 중복 검사는 통과했지만 INSERT 직전에 다른 요청이 먼저 저장한 상황
    monkeypatch.setattr(service.notebooks, "get_by_project_filename", lambda *_args: None)

    def collision(*_args: object, **_kwargs: object) -> None:
        raise IntegrityError("insert", {}, Exception("duplicate"))

    monkeypatch.setattr(service.notebooks, "create", collision)

    with pytest.raises(ConflictError):
        service.upload(user.id, FILENAME, SAMPLE)
    assert api_client.get("/api/notebooks", headers=owner).json() == []
