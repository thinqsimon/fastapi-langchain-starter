"""ADMIN-01: 관리자 전용 서버 설정(공급자별 키·모델·우선순위·강제 사용)을 실제 DB에서 검증한다."""

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain.admin.models import LlmProviderSetting
from app.domain.admin.services import AdminLlmSettingsService
from tests.api.accounts import ADMIN, MEMBER
from tests.api.test_diary import auth_headers

URL = "/api/admin/llm-providers"


def test_non_admin_is_forbidden(api_client: TestClient, admin_enabled: None) -> None:
    headers = auth_headers(api_client, MEMBER)

    assert api_client.get(URL, headers=headers).status_code == 403
    assert (
        api_client.patch(f"{URL}/openai", json={"model": "x"}, headers=headers).status_code == 403
    )


def test_anonymous_is_unauthorized(api_client: TestClient) -> None:
    assert api_client.get(URL).status_code == 401


def test_nobody_is_admin_when_setting_is_empty(api_client: TestClient) -> None:
    """ADMIN_EMAILS를 비워 두면(기본값) 아무도 서버 설정에 들어갈 수 없다."""
    headers = auth_headers(api_client, ADMIN)

    assert api_client.get(URL, headers=headers).status_code == 403
    assert api_client.get("/api/auth/me", headers=headers).json()["is_admin"] is False


def test_me_reports_admin_flag(api_client: TestClient, admin_enabled: None) -> None:
    """프론트가 '서버 설정' 버튼을 보여줄지 /auth/me의 is_admin으로 정한다."""
    assert api_client.get("/api/auth/me", headers=auth_headers(api_client, ADMIN)).json()[
        "is_admin"
    ]
    assert not api_client.get("/api/auth/me", headers=auth_headers(api_client, MEMBER)).json()[
        "is_admin"
    ]


def test_first_read_seeds_three_disabled_providers(
    api_client: TestClient, admin_enabled: None
) -> None:
    rows = api_client.get(URL, headers=auth_headers(api_client, ADMIN)).json()

    assert [row["provider"] for row in rows] == ["openai", "anthropic", "google_genai"]
    assert [row["priority"] for row in rows] == [1, 2, 3]
    assert all(row["has_api_key"] is False for row in rows)
    assert all(row["enabled"] is False and row["forced"] is False for row in rows)
    assert all("api_key" not in row and "encrypted_api_key" not in row for row in rows)


def test_patch_changes_only_sent_fields_and_never_returns_the_key(
    api_client: TestClient, admin_enabled: None, db_session: Session
) -> None:
    headers = auth_headers(api_client, ADMIN)

    res = api_client.patch(
        f"{URL}/anthropic",
        json={"api_key": "sk-ant-secret", "model": " claude-x ", "enabled": True},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["has_api_key"] is True
    assert body["model"] == "claude-x"
    assert body["enabled"] is True
    assert "sk-ant-secret" not in res.text

    # 키 없이 모델만 바꾸면 저장된 키는 그대로다.
    res = api_client.patch(f"{URL}/anthropic", json={"model": "claude-y"}, headers=headers)
    assert res.json()["has_api_key"] is True
    assert res.json()["model"] == "claude-y"

    # DB에는 평문이 남지 않는다.
    row = db_session.query(LlmProviderSetting).filter_by(provider="anthropic").one()
    assert row.encrypted_api_key and "sk-ant-secret" not in row.encrypted_api_key

    # 빈 문자열은 키 삭제다.
    res = api_client.patch(f"{URL}/anthropic", json={"api_key": ""}, headers=headers)
    assert res.json()["has_api_key"] is False


def test_forced_is_exclusive(api_client: TestClient, admin_enabled: None) -> None:
    headers = auth_headers(api_client, ADMIN)

    api_client.patch(f"{URL}/openai", json={"forced": True}, headers=headers)
    api_client.patch(f"{URL}/google_genai", json={"forced": True}, headers=headers)

    forced = {r["provider"]: r["forced"] for r in api_client.get(URL, headers=headers).json()}
    assert forced == {"openai": False, "anthropic": False, "google_genai": True}

    api_client.patch(f"{URL}/google_genai", json={"forced": False}, headers=headers)
    assert all(not r["forced"] for r in api_client.get(URL, headers=headers).json())


def test_validation_errors(api_client: TestClient, admin_enabled: None) -> None:
    headers = auth_headers(api_client, ADMIN)

    assert (
        api_client.patch(f"{URL}/mistral", json={"model": "x"}, headers=headers).status_code == 422
    )
    assert (
        api_client.patch(f"{URL}/openai", json={"model": "  "}, headers=headers).status_code == 422
    )
    assert (
        api_client.patch(f"{URL}/openai", json={"priority": 0}, headers=headers).status_code == 422
    )


def test_saving_a_key_needs_the_encryption_key(
    api_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "ADMIN_EMAILS", ADMIN["email"])
    monkeypatch.setattr(settings, "SETTINGS_ENCRYPTION_KEY", "")
    headers = auth_headers(api_client, ADMIN)

    res = api_client.patch(f"{URL}/openai", json={"api_key": "sk-1"}, headers=headers)

    assert res.status_code == 503
    assert "SETTINGS_ENCRYPTION_KEY" in res.json()["error"]["message"]
    # 키를 보내지 않는 변경은 암호화 키 없이도 된다.
    assert (
        api_client.patch(f"{URL}/openai", json={"model": "m"}, headers=headers).status_code == 200
    )


def test_active_chain_follows_priority_then_forced(
    api_client: TestClient, admin_enabled: None, db_session: Session
) -> None:
    """실제로 쓰는 순서: 키가 있고 켜진 것만 우선순위대로. 강제가 있으면 그것만."""
    headers = auth_headers(api_client, ADMIN)
    service = AdminLlmSettingsService(db_session)

    assert service.active_provider_chain() == []

    api_client.patch(
        f"{URL}/openai",
        json={"api_key": "k-openai", "enabled": True, "priority": 2},
        headers=headers,
    )
    api_client.patch(
        f"{URL}/google_genai",
        json={"api_key": "k-google", "enabled": True, "priority": 1},
        headers=headers,
    )
    # 키는 있지만 꺼둔 공급자는 빠진다.
    api_client.patch(
        f"{URL}/anthropic", json={"api_key": "k-claude", "enabled": False}, headers=headers
    )

    chain = service.active_provider_chain()
    assert [(a.provider, a.api_key) for a in chain] == [
        ("google_genai", "k-google"),
        ("openai", "k-openai"),
    ]
    assert chain[1].model == "gpt-4o-mini"

    api_client.patch(f"{URL}/openai", json={"forced": True}, headers=headers)
    assert [a.provider for a in service.active_provider_chain()] == ["openai"]

    # 강제로 지정해도 키가 없으면 쓸 수 없으니 우선순위로 돌아간다.
    api_client.patch(f"{URL}/openai", json={"api_key": ""}, headers=headers)
    assert [a.provider for a in service.active_provider_chain()] == ["google_genai"]


def test_active_chain_skips_rows_it_cannot_decrypt(
    api_client: TestClient,
    admin_enabled: None,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """암호화 키가 바뀌면 그 공급자만 건너뛴다(.env 기본 동작으로). 요청 전체는 막지 않는다."""
    headers = auth_headers(api_client, ADMIN)
    api_client.patch(f"{URL}/openai", json={"api_key": "k", "enabled": True}, headers=headers)

    monkeypatch.setattr(settings, "SETTINGS_ENCRYPTION_KEY", Fernet.generate_key().decode())

    assert AdminLlmSettingsService(db_session).active_provider_chain() == []
