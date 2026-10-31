"""ADMIN-05: 관리자가 잊어버린 비밀번호를 초기화하고, 사용자를 삭제한다."""

import logging
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain.chat.models import Conversation
from app.domain.coupon.models import Coupon
from tests.api.accounts import ADMIN, MEMBER
from tests.api.test_diary import auth_headers

USERS = "/api/admin/users"
DEFAULT_URL = "/api/admin/password-reset/default"
MISSING = "00000000-0000-0000-0000-000000000000"


@pytest.fixture(autouse=True)
def code_default_password(monkeypatch: pytest.MonkeyPatch) -> None:
    """개발자의 .env에 기본 암호가 있어도 테스트는 코드 기본값(12345678)으로 시작한다."""
    monkeypatch.setattr(settings, "ADMIN_RESET_PASSWORD_DEFAULT", None)


def _find(api_client: TestClient, admin_headers: dict[str, str], email: str) -> dict:
    found = api_client.get(USERS, params={"q": email}, headers=admin_headers).json()
    return next(user for user in found if user["email"] == email)


def _login(api_client: TestClient, email: str, password: str) -> int:
    return api_client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code


def test_default_password_is_admin_only_and_follows_server_setting(
    api_client: TestClient, admin_enabled: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    member_headers = auth_headers(api_client, MEMBER)
    admin_headers = auth_headers(api_client, ADMIN)
    assert api_client.get(DEFAULT_URL).status_code == 401
    assert api_client.get(DEFAULT_URL, headers=member_headers).status_code == 403
    assert api_client.get(DEFAULT_URL, headers=admin_headers).json() == {"password": "12345678"}

    monkeypatch.setattr(settings, "ADMIN_RESET_PASSWORD_DEFAULT", "class-2026!")
    assert api_client.get(DEFAULT_URL, headers=admin_headers).json() == {"password": "class-2026!"}

    # 규칙(8~72자)에 맞지 않는 설정은 쓰지 않는다. 직접 입력한 암호로는 여전히 초기화된다.
    monkeypatch.setattr(settings, "ADMIN_RESET_PASSWORD_DEFAULT", "short")
    assert api_client.get(DEFAULT_URL, headers=admin_headers).status_code == 503
    url = f"{USERS}/{_find(api_client, admin_headers, MEMBER['email'])['id']}/password-reset"
    assert api_client.post(url, json={}, headers=admin_headers).status_code == 503
    typed = api_client.post(url, json={"password": "typed-pass-1"}, headers=admin_headers)
    assert typed.status_code == 200, typed.text


def test_reset_to_default_password_signs_out_other_sessions(
    api_client: TestClient, admin_enabled: None, caplog: pytest.LogCaptureFixture
) -> None:
    api_client.post("/api/auth/signup", json=MEMBER)
    old_tokens = api_client.post(
        "/api/auth/login", json={"email": MEMBER["email"], "password": MEMBER["password"]}
    ).json()
    admin_headers = auth_headers(api_client, ADMIN)
    target = _find(api_client, admin_headers, MEMBER["email"])
    assert target["is_admin"] is False

    with caplog.at_level(logging.INFO):
        res = api_client.post(
            f"{USERS}/{target['id']}/password-reset", json={}, headers=admin_headers
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["password_source"] == "default"
    assert body["user"]["email"] == MEMBER["email"]
    assert "password" not in body  # 비밀번호 자체는 응답에 싣지 않는다

    assert _login(api_client, MEMBER["email"], MEMBER["password"]) == 401
    assert _login(api_client, MEMBER["email"], "12345678") == 200
    # 원래 쓰던 기기의 로그인(리프레시 토큰)은 끊긴다.
    refreshed = api_client.post(
        "/api/auth/refresh", json={"refresh_token": old_tokens["refresh_token"]}
    )
    assert refreshed.status_code == 401

    logs = [r.getMessage() for r in caplog.records if "admin_password_reset" in r.getMessage()]
    assert len(logs) == 1
    assert "source=default" in logs[0] and "revoked_sessions=1" in logs[0]
    assert "12345678" not in logs[0] and MEMBER["email"] not in logs[0]


def test_reset_to_typed_password_uses_signup_rules(
    api_client: TestClient, admin_enabled: None
) -> None:
    auth_headers(api_client, MEMBER)
    admin_headers = auth_headers(api_client, ADMIN)
    url = f"{USERS}/{_find(api_client, admin_headers, MEMBER['email'])['id']}/password-reset"

    assert (
        api_client.post(url, json={"password": "1234567"}, headers=admin_headers).status_code == 422
    )
    assert (
        api_client.post(url, json={"password": "x" * 73}, headers=admin_headers).status_code == 422
    )

    res = api_client.post(url, json={"password": "새 비밀번호 1234"}, headers=admin_headers)
    assert res.status_code == 200, res.text
    assert res.json()["password_source"] == "custom"
    assert _login(api_client, MEMBER["email"], "새 비밀번호 1234") == 200
    assert _login(api_client, MEMBER["email"], "12345678") == 401


def test_admin_accounts_cannot_be_reset_or_deleted(
    api_client: TestClient, admin_enabled: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth_headers(api_client, MEMBER)
    admin_headers = auth_headers(api_client, ADMIN)
    me = _find(api_client, admin_headers, ADMIN["email"])
    assert me["is_admin"] is True
    assert (
        api_client.post(
            f"{USERS}/{me['id']}/password-reset", json={}, headers=admin_headers
        ).status_code
        == 403
    )
    assert api_client.delete(f"{USERS}/{me['id']}", headers=admin_headers).status_code == 403

    # 다른 관리자 계정도 여기서 다루지 않는다.
    monkeypatch.setattr(settings, "ADMIN_EMAILS", f"{ADMIN['email']},{MEMBER['email']}")
    other = _find(api_client, admin_headers, MEMBER["email"])
    assert other["is_admin"] is True
    res = api_client.delete(f"{USERS}/{other['id']}", headers=admin_headers)
    assert res.status_code == 403
    assert "관리자 계정은 여기서 삭제할 수 없습니다" in res.text
    assert _login(api_client, MEMBER["email"], MEMBER["password"]) == 200


def test_only_admins_reach_the_endpoints_and_unknown_users_are_404(
    api_client: TestClient, admin_enabled: None
) -> None:
    member_headers = auth_headers(api_client, MEMBER)
    admin_headers = auth_headers(api_client, ADMIN)
    target_id = _find(api_client, admin_headers, MEMBER["email"])["id"]

    reset = f"{USERS}/{target_id}/password-reset"
    assert api_client.post(reset, json={}).status_code == 401
    assert api_client.post(reset, json={}, headers=member_headers).status_code == 403
    assert api_client.delete(f"{USERS}/{target_id}", headers=member_headers).status_code == 403

    missing_reset = f"{USERS}/{MISSING}/password-reset"
    assert api_client.post(missing_reset, json={}, headers=admin_headers).status_code == 404
    assert api_client.delete(f"{USERS}/{MISSING}", headers=admin_headers).status_code == 404


def test_delete_removes_account_and_records_but_keeps_coupon_history(
    api_client: TestClient,
    admin_enabled: None,
    db_session: Session,
    caplog: pytest.LogCaptureFixture,
) -> None:
    member_headers = auth_headers(api_client, MEMBER)
    admin_headers = auth_headers(api_client, ADMIN)
    created = api_client.post(
        "/api/conversations", json={"title": "지워질 대화"}, headers=member_headers
    )
    assert created.status_code == 201, created.text
    coupon = api_client.post(
        "/api/admin/coupons", json={"plan": "pro", "duration": "1m"}, headers=admin_headers
    ).json()[0]
    redeemed = api_client.post(
        "/api/coupons/redeem", json={"code": coupon["code"]}, headers=member_headers
    )
    assert redeemed.status_code == 200, redeemed.text
    target_id = uuid.UUID(_find(api_client, admin_headers, MEMBER["email"])["id"])

    with caplog.at_level(logging.INFO):
        res = api_client.delete(f"{USERS}/{target_id}", headers=admin_headers)
    assert res.status_code == 204, res.text

    assert api_client.get(USERS, params={"q": MEMBER["email"]}, headers=admin_headers).json() == []
    assert _login(api_client, MEMBER["email"], MEMBER["password"]) == 401
    assert api_client.get("/api/auth/me", headers=member_headers).status_code == 401

    db_session.expire_all()
    remaining = db_session.scalar(
        select(func.count()).select_from(Conversation).where(Conversation.user_id == target_id)
    )
    assert remaining == 0
    kept = db_session.get(Coupon, uuid.UUID(coupon["id"]))
    assert kept is not None and kept.redeemed_by is None  # 쿠폰 기록은 남고 사용자 칸만 비워진다
    assert any("admin_user_deleted" in r.getMessage() for r in caplog.records)
