"""AUTH-01 인증 API 검증."""

from fastapi.testclient import TestClient

SIGNUP = {"email": "learner@example.com", "password": "secret-password", "display_name": "교육생"}


def signup(client: TestClient, **overrides: str) -> dict:
    return client.post("/api/auth/signup", json={**SIGNUP, **overrides}).json()


def login(client: TestClient, **overrides: str) -> dict:
    payload = {"email": SIGNUP["email"], "password": SIGNUP["password"], **overrides}
    return client.post("/api/auth/login", json=payload).json()


def test_signup_creates_user_without_exposing_password(api_client: TestClient) -> None:
    res = api_client.post("/api/auth/signup", json=SIGNUP)

    assert res.status_code == 201
    body = res.json()
    assert body["email"] == SIGNUP["email"]
    assert body["display_name"] == SIGNUP["display_name"]
    assert body["is_active"] is True
    # 비밀번호는 어떤 형태로도 응답에 나오지 않는다.
    assert "password" not in str(body)
    assert SIGNUP["password"] not in res.text


def test_duplicate_email_returns_conflict(api_client: TestClient) -> None:
    api_client.post("/api/auth/signup", json=SIGNUP)

    res = api_client.post("/api/auth/signup", json=SIGNUP)

    assert res.status_code == 409
    assert res.json()["error"]["code"] == "CONFLICT"


def test_short_password_is_rejected(api_client: TestClient) -> None:
    res = api_client.post("/api/auth/signup", json={**SIGNUP, "password": "short"})

    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_login_returns_token_pair(api_client: TestClient) -> None:
    signup(api_client)

    res = api_client.post(
        "/api/auth/login",
        json={"email": SIGNUP["email"], "password": SIGNUP["password"]},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["token_type"] == "bearer"


def test_login_with_wrong_password_is_unauthorized(api_client: TestClient) -> None:
    signup(api_client)

    res = api_client.post(
        "/api/auth/login",
        json={"email": SIGNUP["email"], "password": "wrong-password"},
    )

    assert res.status_code == 401
    # 가입 여부가 드러나지 않도록 메시지를 구분하지 않는다.
    assert res.json()["error"]["message"] == "이메일 또는 비밀번호가 올바르지 않습니다."


def test_login_with_unknown_email_gives_same_error(api_client: TestClient) -> None:
    res = api_client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": SIGNUP["password"]},
    )

    assert res.status_code == 401
    assert res.json()["error"]["message"] == "이메일 또는 비밀번호가 올바르지 않습니다."


def test_me_requires_token(api_client: TestClient) -> None:
    res = api_client.get("/api/auth/me")

    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


def test_me_rejects_invalid_token(api_client: TestClient) -> None:
    res = api_client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})

    assert res.status_code == 401


def test_me_returns_current_user(api_client: TestClient) -> None:
    signup(api_client)
    tokens = login(api_client)

    res = api_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )

    assert res.status_code == 200
    assert res.json()["email"] == SIGNUP["email"]


def test_refresh_token_cannot_be_used_as_access_token(api_client: TestClient) -> None:
    signup(api_client)
    tokens = login(api_client)

    res = api_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {tokens['refresh_token']}"},
    )

    assert res.status_code == 401


def test_refresh_issues_new_tokens(api_client: TestClient) -> None:
    signup(api_client)
    tokens = login(api_client)

    res = api_client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})

    assert res.status_code == 200
    new_tokens = res.json()
    assert new_tokens["refresh_token"] != tokens["refresh_token"]

    # 새 액세스 토큰으로 보호된 API를 쓸 수 있다.
    me = api_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
    )
    assert me.status_code == 200


def test_used_refresh_token_is_rejected(api_client: TestClient) -> None:
    """한 번 쓴 리프레시 토큰은 폐기된다(탈취된 토큰의 재사용 방지)."""
    signup(api_client)
    tokens = login(api_client)
    api_client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})

    res = api_client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})

    assert res.status_code == 401


def test_logout_invalidates_refresh_token(api_client: TestClient) -> None:
    signup(api_client)
    tokens = login(api_client)

    logout = api_client.post("/api/auth/logout", json={"refresh_token": tokens["refresh_token"]})
    assert logout.status_code == 204

    res = api_client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert res.status_code == 401


def test_inactive_user_cannot_login(api_client: TestClient, db_session) -> None:
    """비활성 계정은 비밀번호가 맞아도 로그인되지 않는다."""
    from app.domain.auth.models import User

    signup(api_client)
    user = db_session.query(User).filter(User.email == SIGNUP["email"]).one()
    user.is_active = False
    db_session.commit()

    res = api_client.post(
        "/api/auth/login",
        json={"email": SIGNUP["email"], "password": SIGNUP["password"]},
    )

    assert res.status_code == 401


def test_token_with_non_uuid_subject_is_rejected(api_client: TestClient) -> None:
    """토큰은 유효해도 sub이 사용자 ID 형식이 아니면 거부한다."""
    from app.core.security import create_access_token

    forged = create_access_token("not-a-uuid")

    res = api_client.get("/api/auth/me", headers={"Authorization": f"Bearer {forged}"})

    assert res.status_code == 401


def test_logout_with_unknown_token_is_still_ok(api_client: TestClient) -> None:
    """이미 만료·폐기된 토큰으로 로그아웃해도 오류를 내지 않는다(멱등)."""
    res = api_client.post("/api/auth/logout", json={"refresh_token": "already-gone"})

    assert res.status_code == 204
