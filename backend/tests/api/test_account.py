"""ACC-01 계정 정보 수정(이름·이메일·비밀번호) 검증."""

import httpx
import pytest
from fastapi.testclient import TestClient

ACCOUNT = {"email": "account@example.com", "password": "secret-password", "display_name": "교육생"}
NEW_PASSWORD = "brand-new-password"


def login(client: TestClient, email: str, password: str) -> httpx.Response:
    return client.post("/api/auth/login", json={"email": email, "password": password})


def bearer(tokens: dict[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def refresh(client: TestClient, tokens: dict[str, str]) -> httpx.Response:
    return client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})


@pytest.fixture
def tokens(api_client: TestClient) -> dict[str, str]:
    api_client.post("/api/auth/signup", json=ACCOUNT)
    return login(api_client, ACCOUNT["email"], ACCOUNT["password"]).json()


def test_account_changes_require_authentication(api_client: TestClient) -> None:
    assert api_client.patch("/api/auth/me", json={"display_name": "x"}).status_code == 401
    assert (
        api_client.put(
            "/api/auth/me/email", json={"email": "x@example.com", "current_password": "x"}
        ).status_code
        == 401
    )
    assert (
        api_client.put(
            "/api/auth/me/password",
            json={"current_password": "x", "new_password": NEW_PASSWORD},
        ).status_code
        == 401
    )


def test_change_display_name(api_client: TestClient, tokens: dict[str, str]) -> None:
    res = api_client.patch(
        "/api/auth/me", json={"display_name": "  새 이름 "}, headers=bearer(tokens)
    )

    assert res.status_code == 200
    assert res.json()["display_name"] == "새 이름"
    assert api_client.get("/api/auth/me", headers=bearer(tokens)).json()["display_name"] == (
        "새 이름"
    )


def test_blank_display_name_is_rejected(api_client: TestClient, tokens: dict[str, str]) -> None:
    res = api_client.patch("/api/auth/me", json={"display_name": "   "}, headers=bearer(tokens))

    assert res.status_code == 422


def test_change_email_then_login_with_it(api_client: TestClient, tokens: dict[str, str]) -> None:
    res = api_client.put(
        "/api/auth/me/email",
        json={"email": "renamed@example.com", "current_password": ACCOUNT["password"]},
        headers=bearer(tokens),
    )

    assert res.status_code == 200
    assert res.json()["email"] == "renamed@example.com"
    assert login(api_client, "renamed@example.com", ACCOUNT["password"]).status_code == 200
    assert login(api_client, ACCOUNT["email"], ACCOUNT["password"]).status_code == 401


def test_change_email_checks_current_password(
    api_client: TestClient, tokens: dict[str, str]
) -> None:
    """400이어야 한다. 401이면 프론트엔드가 토큰 재발급을 시도하다 로그아웃시킨다."""
    res = api_client.put(
        "/api/auth/me/email",
        json={"email": "renamed@example.com", "current_password": "wrong-password"},
        headers=bearer(tokens),
    )

    assert res.status_code == 400
    assert res.json()["error"]["code"] == "WRONG_PASSWORD"


def test_change_email_to_taken_address_conflicts(
    api_client: TestClient, tokens: dict[str, str]
) -> None:
    api_client.post("/api/auth/signup", json={**ACCOUNT, "email": "taken@example.com"})

    res = api_client.put(
        "/api/auth/me/email",
        json={"email": "taken@example.com", "current_password": ACCOUNT["password"]},
        headers=bearer(tokens),
    )

    assert res.status_code == 409


def test_email_taken_at_the_last_moment_conflicts(
    api_client: TestClient, tokens: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    """중복 확인을 통과한 직후 다른 계정이 같은 이메일을 가져가도 500이 아니라 409다."""
    api_client.post("/api/auth/signup", json={**ACCOUNT, "email": "raced@example.com"})
    monkeypatch.setattr("app.domain.auth.repositories.UserRepository.get_by_email", lambda *_: None)

    res = api_client.put(
        "/api/auth/me/email",
        json={"email": "raced@example.com", "current_password": ACCOUNT["password"]},
        headers=bearer(tokens),
    )

    assert res.status_code == 409


def test_keeping_the_same_email_is_fine(api_client: TestClient, tokens: dict[str, str]) -> None:
    res = api_client.put(
        "/api/auth/me/email",
        json={"email": ACCOUNT["email"], "current_password": ACCOUNT["password"]},
        headers=bearer(tokens),
    )

    assert res.status_code == 200


def test_change_password_keeps_this_screen_and_logs_out_others(
    api_client: TestClient, tokens: dict[str, str]
) -> None:
    other_device = login(api_client, ACCOUNT["email"], ACCOUNT["password"]).json()

    res = api_client.put(
        "/api/auth/me/password",
        json={"current_password": ACCOUNT["password"], "new_password": NEW_PASSWORD},
        headers=bearer(tokens),
    )

    assert res.status_code == 200
    new_tokens = res.json()
    # 지금 화면은 새 토큰으로 계속 쓴다.
    assert api_client.get("/api/auth/me", headers=bearer(new_tokens)).status_code == 200
    assert refresh(api_client, new_tokens).status_code == 200
    # 다른 기기와 이 기기의 예전 리프레시 토큰은 모두 끊긴다.
    assert refresh(api_client, other_device).status_code == 401
    assert refresh(api_client, tokens).status_code == 401


def test_login_uses_the_new_password(api_client: TestClient, tokens: dict[str, str]) -> None:
    api_client.put(
        "/api/auth/me/password",
        json={"current_password": ACCOUNT["password"], "new_password": NEW_PASSWORD},
        headers=bearer(tokens),
    )

    assert login(api_client, ACCOUNT["email"], NEW_PASSWORD).status_code == 200
    assert login(api_client, ACCOUNT["email"], ACCOUNT["password"]).status_code == 401


def test_change_password_checks_current_password(
    api_client: TestClient, tokens: dict[str, str]
) -> None:
    res = api_client.put(
        "/api/auth/me/password",
        json={"current_password": "wrong-password", "new_password": NEW_PASSWORD},
        headers=bearer(tokens),
    )

    assert res.status_code == 400
    assert res.json()["error"]["code"] == "WRONG_PASSWORD"
    # 틀려도 기존 로그인은 그대로다.
    assert refresh(api_client, tokens).status_code == 200


def test_new_password_must_differ(api_client: TestClient, tokens: dict[str, str]) -> None:
    res = api_client.put(
        "/api/auth/me/password",
        json={"current_password": ACCOUNT["password"], "new_password": ACCOUNT["password"]},
        headers=bearer(tokens),
    )

    assert res.status_code == 400
    assert res.json()["error"]["code"] == "BAD_REQUEST"


def test_short_new_password_is_rejected(api_client: TestClient, tokens: dict[str, str]) -> None:
    res = api_client.put(
        "/api/auth/me/password",
        json={"current_password": ACCOUNT["password"], "new_password": "short"},
        headers=bearer(tokens),
    )

    assert res.status_code == 422
