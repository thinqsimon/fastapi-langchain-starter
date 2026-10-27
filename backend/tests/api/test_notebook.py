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


@pytest.mark.parametrize(
    "method,path,payload",
    [
        ("GET", "/api/notebooks", None),
        ("POST", "/api/notebooks/upload", {"filename": "a.md", "content": "# a\n\nb"}),
        ("POST", "/api/notebooks", {"title": "a"}),
        ("GET", f"/api/notebooks/topics/{uuid.uuid4()}", None),
        ("PATCH", f"/api/notebooks/topics/{uuid.uuid4()}", {"completed": True}),
        ("DELETE", f"/api/notebooks/topics/{uuid.uuid4()}", None),
        ("POST", f"/api/notebooks/{uuid.uuid4()}/topics", {"title": "a"}),
        ("PATCH", f"/api/notebooks/{uuid.uuid4()}", {"title": "a"}),
        ("DELETE", f"/api/notebooks/{uuid.uuid4()}", None),
    ],
)
def test_notebook_requires_auth(
    client: TestClient, method: str, path: str, payload: object
) -> None:
    assert client.request(method, path, json=payload).status_code == 401


def test_upload_splits_topics_and_list_omits_content(
    api_client: TestClient, owner: dict[str, str]
) -> None:
    notebook = upload(api_client, owner)

    assert notebook["title"] == "SpaceXyzDiary 배움노트 #01"
    assert notebook["filename"] == FILENAME
    assert notebook["project"] == "SpaceXyzDiary"
    assert notebook["summary"] == "첫 줄 요약."
    topics = notebook["topics"]
    assert [topic["title"] for topic in topics] == ["스킬 만들기", "유니코드 정규화"]
    assert [topic["position"] for topic in topics] == [1, 2]
    assert "content" not in topics[0]
    assert topics[0]["kind"] == "워크플로"
    assert topics[0]["tags"] == ["claude-code", "skill"]
    assert topics[0]["difficulty"] == 1
    assert topics[0]["completed"] is False
    assert topics[1]["difficulty"] == 3

    listed = api_client.get("/api/notebooks", headers=owner).json()
    assert [item["id"] for item in listed] == [notebook["id"]]
    assert "content" not in listed[0]["topics"][0]

    detail = api_client.get(f"/api/notebooks/topics/{topics[0]['id']}", headers=owner)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["content"].startswith("> 한 줄 요약.")
    assert "## 코드 블록 안의 제목은 주제가 아니다" in body["content"]
    assert "`태그`" not in body["content"]
    assert body["created_at"]


def test_upload_same_filename_conflicts_until_deleted(
    api_client: TestClient, owner: dict[str, str]
) -> None:
    first = upload(api_client, owner)

    duplicate = api_client.post(
        "/api/notebooks/upload",
        headers=owner,
        json={
            "filename": f"folder/{FILENAME}",
            "content": "---\nproject: SpaceXyzDiary\n---\n# 다른 내용\n\n본문",
        },
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["error"]["code"] == "CONFLICT"
    assert "이미 올렸습니다" in duplicate.json()["error"]["message"]

    # 다른 이름이면 같은 내용이어도 된다.
    upload(api_client, owner, filename="2026-10-28_01.md")

    assert api_client.delete(f"/api/notebooks/{first['id']}", headers=owner).status_code == 204
    upload(api_client, owner)
    titles = [item["filename"] for item in api_client.get("/api/notebooks", headers=owner).json()]
    assert sorted(titles) == sorted([FILENAME, "2026-10-28_01.md"])


def test_same_filename_from_other_project_is_allowed(
    api_client: TestClient, owner: dict[str, str]
) -> None:
    upload(api_client, owner)
    other_project = SAMPLE.replace("project: SpaceXyzDiary", "project: ai-one-park").replace(
        "title: SpaceXyzDiary 배움노트 #01", "title: ai-one-park 배움노트 #01"
    )
    second = upload(api_client, owner, content=other_project)

    assert (second["project"], second["filename"]) == ("ai-one-park", FILENAME)
    listed = api_client.get("/api/notebooks", headers=owner).json()
    assert sorted(item["project"] for item in listed) == ["SpaceXyzDiary", "ai-one-park"]

    # 같은 프로젝트의 같은 파일은 여전히 거부된다.
    duplicate = api_client.post(
        "/api/notebooks/upload",
        headers=owner,
        json={"filename": FILENAME, "content": other_project},
    )
    assert duplicate.status_code == 409, duplicate.text


def test_plain_markdown_without_project_can_repeat(
    api_client: TestClient, owner: dict[str, str]
) -> None:
    first = upload(api_client, owner, filename="memo.md", content="# 메모\n\n첫 단락\n")
    second = upload(api_client, owner, filename="memo.md", content="# 메모\n\n둘째 단락\n")

    assert first["id"] != second["id"]
    listed = api_client.get("/api/notebooks", headers=owner).json()
    assert [item["project"] for item in listed] == [None, None]


def test_upload_rejects_empty_and_invalid_payloads(
    api_client: TestClient, owner: dict[str, str]
) -> None:
    empty = api_client.post(
        "/api/notebooks/upload", headers=owner, json={"filename": "a.md", "content": "\n\n"}
    )
    assert empty.status_code == 400, empty.text
    assert empty.json()["error"]["code"] == "BAD_REQUEST"
    assert "내용이 없습니다" in empty.json()["error"]["message"]

    assert (
        api_client.post("/api/notebooks/upload", headers=owner, json={"filename": "a.md"})
    ).status_code == 422
    assert (
        api_client.post(
            "/api/notebooks/upload",
            headers=owner,
            json={"filename": " ", "content": "# a\n\nb"},
        )
    ).status_code == 422
    assert (
        api_client.post(
            "/api/notebooks/upload",
            headers=owner,
            json={"filename": "a.md", "content": "x" * 500_001},
        )
    ).status_code == 422
    assert api_client.get("/api/notebooks", headers=owner).json() == []


def test_upload_without_h2_becomes_single_topic(
    api_client: TestClient, owner: dict[str, str]
) -> None:
    notebook = upload(api_client, owner, filename="memo.md", content="# 메모\n\n첫 단락\n")

    assert notebook["title"] == "메모"
    assert [topic["title"] for topic in notebook["topics"]] == ["메모"]
    detail = api_client.get(
        f"/api/notebooks/topics/{notebook['topics'][0]['id']}", headers=owner
    ).json()
    assert detail["content"] == "첫 단락"


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
        service.upload(user.id, FILENAME, "---\nproject: p\n---\n# a\n\nb")
    assert api_client.get("/api/notebooks", headers=owner).json() == []
