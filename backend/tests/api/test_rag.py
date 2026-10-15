"""OPT-RAG 문서 저장·검색 검증.

RAG는 선택 기능이라 꺼져 있으면 API가 등록되지 않는다. 테스트는 켜고 만든 앱을 쓴다.
임베딩은 fake 공급자가 결정적 벡터를 주므로 키 없이 돈다.
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.main import create_app

ACCOUNT = {"email": "rag@example.com", "password": "secret-password", "display_name": "문서"}

HANDBOOK = """
휴가 정책

연차는 입사일 기준으로 매년 15일 주어집니다. 미사용 연차는 다음 해로 이월되지 않습니다.
연차를 쓰려면 최소 3일 전에 팀장 승인을 받아야 합니다.

재택근무 정책

주 2회까지 재택근무를 할 수 있습니다. 재택 근무일에는 오전 10시 스크럼에 반드시 참석해야 합니다.

장비 지원

입사 시 노트북과 모니터가 지급됩니다. 교체 주기는 3년입니다.
"""


@pytest.fixture
def rag_client(db_session: Session) -> Generator[TestClient]:
    """RAG를 켠 앱."""
    app = create_app(rag_enabled=True)
    app.dependency_overrides[get_db] = lambda: db_session

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def headers(rag_client: TestClient) -> dict[str, str]:
    rag_client.post("/api/auth/signup", json=ACCOUNT)
    tokens = rag_client.post(
        "/api/auth/login", json={"email": ACCOUNT["email"], "password": ACCOUNT["password"]}
    ).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_rag_api_is_absent_when_disabled(api_client: TestClient) -> None:
    """기본값은 꺼짐. 꺼져 있으면 엔드포인트 자체가 없다."""
    assert api_client.get("/api/rag/documents").status_code == 404


def test_document_is_split_and_stored(rag_client: TestClient, headers: dict[str, str]) -> None:
    res = rag_client.post(
        "/api/rag/documents",
        json={"source": "사내규정.md", "content": HANDBOOK},
        headers=headers,
    )

    assert res.status_code == 201
    body = res.json()
    assert body["source"] == "사내규정.md"
    assert body["chunk_count"] >= 1

    listed = rag_client.get("/api/rag/documents", headers=headers).json()
    assert listed == [{"source": "사내규정.md", "chunk_count": body["chunk_count"]}]


def test_search_returns_similar_chunks(rag_client: TestClient, headers: dict[str, str]) -> None:
    rag_client.post(
        "/api/rag/documents",
        json={"source": "사내규정.md", "content": HANDBOOK},
        headers=headers,
    )

    res = rag_client.get("/api/rag/search", params={"q": "연차 며칠인가요"}, headers=headers)

    assert res.status_code == 200
    body = res.json()
    assert body["query"] == "연차 며칠인가요"
    assert body["hits"], "검색 결과가 비었습니다"
    assert all(-1.0 <= hit["similarity"] <= 1.0 for hit in body["hits"])
    # 유사도 내림차순이어야 한다.
    similarities = [hit["similarity"] for hit in body["hits"]]
    assert similarities == sorted(similarities, reverse=True)


def test_reindexing_replaces_previous_chunks(
    rag_client: TestClient, headers: dict[str, str]
) -> None:
    """같은 이름으로 다시 올리면 옛 내용이 검색되면 안 된다."""
    rag_client.post(
        "/api/rag/documents",
        json={"source": "규정.md", "content": HANDBOOK},
        headers=headers,
    )
    rag_client.post(
        "/api/rag/documents",
        json={"source": "규정.md", "content": "연차는 20일로 변경되었습니다."},
        headers=headers,
    )

    listed = rag_client.get("/api/rag/documents", headers=headers).json()
    assert len(listed) == 1
    assert listed[0]["chunk_count"] == 1


def test_delete_document(rag_client: TestClient, headers: dict[str, str]) -> None:
    rag_client.post(
        "/api/rag/documents", json={"source": "지울것.md", "content": HANDBOOK}, headers=headers
    )

    assert rag_client.delete("/api/rag/documents/지울것.md", headers=headers).status_code == 204
    assert rag_client.get("/api/rag/documents", headers=headers).json() == []


def test_deleting_unknown_document_is_not_found(
    rag_client: TestClient, headers: dict[str, str]
) -> None:
    assert rag_client.delete("/api/rag/documents/없는문서.md", headers=headers).status_code == 404


def test_rag_requires_authentication(rag_client: TestClient) -> None:
    assert rag_client.get("/api/rag/documents").status_code == 401
    assert rag_client.get("/api/rag/search", params={"q": "x"}).status_code == 401
