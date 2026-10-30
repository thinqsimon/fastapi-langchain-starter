"""ADMIN-02: 관리자가 사용자를 검색해 그 계정으로 테스트한다(쓰기 허용·삭제 차단·로그)."""

import logging

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import decode_access_claims
from tests.api.accounts import ADMIN, MEMBER
from tests.api.test_diary import auth_headers

USERS = "/api/admin/users"


def _acting_headers(api_client: TestClient, admin_headers: dict[str, str], email: str) -> dict:
    target = api_client.get(USERS, params={"q": email}, headers=admin_headers).json()[0]
    res = api_client.post(f"{USERS}/{target['id']}/acting-token", headers=admin_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["user"]["email"] == email
    assert body["expires_in"] == settings.ADMIN_TEST_TOKEN_EXPIRE_MINUTES * 60
    assert "refresh_token" not in body
    return {"Authorization": f"Bearer {body['access_token']}"}


def test_search_is_admin_only_and_matches_email_or_name(
    api_client: TestClient, admin_enabled: None
) -> None:
    member_headers = auth_headers(api_client, MEMBER)
    admin_headers = auth_headers(api_client, ADMIN)

    assert api_client.get(USERS, params={"q": "a"}, headers=member_headers).status_code == 403
    assert api_client.get(USERS, headers=admin_headers).status_code == 422  # q 필수

    by_email = api_client.get(USERS, params={"q": "MEMBER@"}, headers=admin_headers).json()
    assert [u["email"] for u in by_email] == [MEMBER["email"]]
    assert set(by_email[0]) == {"id", "email", "display_name", "is_active", "created_at"}

    by_name = api_client.get(USERS, params={"q": "일반"}, headers=admin_headers).json()
    assert [u["email"] for u in by_name] == [MEMBER["email"]]


def test_acting_token_reads_and_writes_as_target_but_cannot_delete_or_change_account(
    api_client: TestClient, admin_enabled: None, caplog: pytest.LogCaptureFixture
) -> None:
    member_headers = auth_headers(api_client, MEMBER)
    admin_headers = auth_headers(api_client, ADMIN)
    own = api_client.post(
        "/api/conversations", json={"title": "신고된 대화"}, headers=member_headers
    )
    conversation_id = own.json()["id"]

    with caplog.at_level(logging.INFO):
        acting = _acting_headers(api_client, admin_headers, MEMBER["email"])
    assert "admin_test_started" in caplog.text

    # 대상 사용자로 보인다(관리자 권한은 없다).
    me = api_client.get("/api/auth/me", headers=acting).json()
    assert me["email"] == MEMBER["email"] and me["is_admin"] is False
    assert api_client.get(USERS, params={"q": "a"}, headers=acting).status_code == 403

    # 읽기와 쓰기(재현에 필요)는 된다.
    titles = [c["title"] for c in api_client.get("/api/conversations", headers=acting).json()]
    assert titles == ["신고된 대화"]
    with caplog.at_level(logging.INFO):
        created = api_client.post(
            "/api/conversations", json={"title": "관리자 재현"}, headers=acting
        )
    assert created.status_code == 201
    assert "admin_test_write" in caplog.text and "method=POST" in caplog.text
    assert (
        api_client.patch(
            f"/api/conversations/{conversation_id}", json={"title": "제목 수정"}, headers=acting
        ).status_code
        == 200
    )

    # 삭제와 계정 변경은 막힌다.
    blocked = [
        api_client.delete(f"/api/conversations/{conversation_id}", headers=acting),
        api_client.patch("/api/auth/me", json={"display_name": "바꿈"}, headers=acting),
        api_client.put(
            "/api/auth/me/password",
            json={"current_password": MEMBER["password"], "new_password": "new-secret-password"},
            headers=acting,
        ),
    ]
    assert [r.status_code for r in blocked] == [403, 403, 403]
    assert all("테스트 중에는" in r.json()["error"]["message"] for r in blocked)

    # 대상 사용자의 데이터는 그대로 남아 있다(관리자가 만든 대화 포함).
    titles = [
        c["title"] for c in api_client.get("/api/conversations", headers=member_headers).json()
    ]
    assert sorted(titles) == ["관리자 재현", "제목 수정"]


def test_acting_token_carries_actor_and_rejects_self_or_unknown(
    api_client: TestClient, admin_enabled: None
) -> None:
    admin_headers = auth_headers(api_client, ADMIN)
    auth_headers(api_client, MEMBER)
    me = api_client.get("/api/auth/me", headers=admin_headers).json()
    target = api_client.get(USERS, params={"q": MEMBER["email"]}, headers=admin_headers).json()[0]

    token = api_client.post(f"{USERS}/{target['id']}/acting-token", headers=admin_headers).json()[
        "access_token"
    ]
    claims = decode_access_claims(token)
    assert claims.subject == target["id"] and claims.actor == me["id"]

    assert (
        api_client.post(f"{USERS}/{me['id']}/acting-token", headers=admin_headers).status_code
        == 400
    )
    assert (
        api_client.post(
            f"{USERS}/00000000-0000-0000-0000-000000000000/acting-token", headers=admin_headers
        ).status_code
        == 404
    )
    assert (
        api_client.post(
            f"{USERS}/{target['id']}/acting-token", headers=auth_headers(api_client, MEMBER)
        ).status_code
        == 403
    )


def test_normal_token_has_no_actor_and_is_not_restricted(api_client: TestClient) -> None:
    headers = auth_headers(api_client, MEMBER)
    token = headers["Authorization"].removeprefix("Bearer ")
    assert decode_access_claims(token).actor is None

    conversation_id = api_client.post(
        "/api/conversations", json={"title": "x"}, headers=headers
    ).json()["id"]
    assert (
        api_client.delete(f"/api/conversations/{conversation_id}", headers=headers).status_code
        == 204
    )
