"""ADMIN-01·03: 공급자 API 키와 요금제별 LLM 라우팅을 실제 DB에서 검증한다."""

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain.admin.models import LlmProvider
from app.domain.admin.services import AdminLlmSettingsService
from tests.api.accounts import ADMIN, MEMBER
from tests.api.test_diary import auth_headers

KEYS = "/api/admin/llm-providers"
ROUTES = "/api/admin/llm-routes"


def _set_key(api_client: TestClient, headers: dict[str, str], provider: str, key: str) -> None:
    res = api_client.patch(f"{KEYS}/{provider}", json={"api_key": key}, headers=headers)
    assert res.status_code == 200, res.text


def _route(
    api_client: TestClient, headers: dict[str, str], plan: str, provider: str, model: str, **patch
) -> dict:
    res = api_client.post(
        ROUTES, json={"plan": plan, "provider": provider, "model": model}, headers=headers
    )
    assert res.status_code == 201, res.text
    route = res.json()
    if patch:
        res = api_client.patch(f"{ROUTES}/{route['id']}", json=patch, headers=headers)
        assert res.status_code == 200, res.text
        route = res.json()
    return route


def test_non_admin_is_forbidden(api_client: TestClient, admin_enabled: None) -> None:
    headers = auth_headers(api_client, MEMBER)

    assert api_client.get(KEYS, headers=headers).status_code == 403
    assert api_client.get(ROUTES, headers=headers).status_code == 403
    assert (
        api_client.post(
            ROUTES, json={"plan": "free", "provider": "openai", "model": "x"}, headers=headers
        ).status_code
        == 403
    )


def test_anonymous_is_unauthorized(api_client: TestClient) -> None:
    assert api_client.get(KEYS).status_code == 401


def test_nobody_is_admin_when_setting_is_empty(api_client: TestClient) -> None:
    """ADMIN_EMAILS를 비워 두면(기본값) 아무도 관리자 화면에 들어갈 수 없다."""
    headers = auth_headers(api_client, ADMIN)

    assert api_client.get(KEYS, headers=headers).status_code == 403
    assert api_client.get("/api/auth/me", headers=headers).json()["is_admin"] is False


def test_me_reports_admin_flag_and_plan(api_client: TestClient, admin_enabled: None) -> None:
    """프론트가 '관리자' 버튼을 보여줄지 /auth/me의 is_admin으로 정한다. 요금제 기본값은 free."""
    me = api_client.get("/api/auth/me", headers=auth_headers(api_client, ADMIN)).json()
    assert me["is_admin"] is True and me["plan"] == "free"
    assert not api_client.get("/api/auth/me", headers=auth_headers(api_client, MEMBER)).json()[
        "is_admin"
    ]


def test_first_read_seeds_three_providers_without_keys_and_no_routes(
    api_client: TestClient, admin_enabled: None
) -> None:
    headers = auth_headers(api_client, ADMIN)
    rows = api_client.get(KEYS, headers=headers).json()

    assert [row["provider"] for row in rows] == ["openai", "anthropic", "google_genai"]
    assert all(row["has_api_key"] is False for row in rows)
    assert all("api_key" not in row and "encrypted_api_key" not in row for row in rows)
    assert api_client.get(ROUTES, headers=headers).json() == []


def test_key_is_stored_encrypted_never_returned_and_cleared_by_empty_string(
    api_client: TestClient, admin_enabled: None, db_session: Session
) -> None:
    headers = auth_headers(api_client, ADMIN)

    res = api_client.patch(f"{KEYS}/anthropic", json={"api_key": "sk-ant-secret"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["has_api_key"] is True
    assert "sk-ant-secret" not in res.text

    row = db_session.query(LlmProvider).filter_by(provider="anthropic").one()
    assert row.encrypted_api_key and "sk-ant-secret" not in row.encrypted_api_key

    res = api_client.patch(f"{KEYS}/anthropic", json={"api_key": ""}, headers=headers)
    assert res.json()["has_api_key"] is False
    assert (
        api_client.patch(f"{KEYS}/mistral", json={"api_key": "k"}, headers=headers).status_code
        == 422
    )


def test_routes_crud_and_forced_is_exclusive_per_plan(
    api_client: TestClient, admin_enabled: None
) -> None:
    headers = auth_headers(api_client, ADMIN)

    free_openai = _route(api_client, headers, "free", "openai", " gpt-4o-mini ")
    free_google = _route(api_client, headers, "free", "google_genai", "gemini-2.5-flash")
    pro_claude = _route(api_client, headers, "pro", "anthropic", "claude-sonnet-4-5")

    # 순서는 요금제 안에서 매겨진다. 모델 앞뒤 공백은 정리된다. 키가 없으면 has_api_key=false.
    assert (free_openai["priority"], free_google["priority"], pro_claude["priority"]) == (1, 2, 1)
    assert free_openai["model"] == "gpt-4o-mini"
    assert free_openai["has_api_key"] is False
    listed = api_client.get(ROUTES, headers=headers).json()
    assert [(r["plan"], r["priority"], r["provider"]) for r in listed] == [
        ("free", 1, "openai"),
        ("free", 2, "google_genai"),
        ("pro", 1, "anthropic"),
    ]

    # 강제 사용은 요금제당 하나. free에서 바꿔도 pro는 그대로다.
    api_client.patch(f"{ROUTES}/{free_openai['id']}", json={"forced": True}, headers=headers)
    api_client.patch(f"{ROUTES}/{pro_claude['id']}", json={"forced": True}, headers=headers)
    api_client.patch(f"{ROUTES}/{free_google['id']}", json={"forced": True}, headers=headers)
    forced = {r["id"]: r["forced"] for r in api_client.get(ROUTES, headers=headers).json()}
    assert forced == {free_openai["id"]: False, free_google["id"]: True, pro_claude["id"]: True}

    # 보낸 필드만 바뀐다.
    res = api_client.patch(
        f"{ROUTES}/{free_google['id']}",
        json={"model": "gemini-2.5-pro", "enabled": False, "priority": 1},
        headers=headers,
    )
    assert (
        res.json()["model"],
        res.json()["enabled"],
        res.json()["priority"],
        res.json()["forced"],
    ) == (
        "gemini-2.5-pro",
        False,
        1,
        True,
    )

    assert api_client.delete(f"{ROUTES}/{pro_claude['id']}", headers=headers).status_code == 204
    assert api_client.delete(f"{ROUTES}/{pro_claude['id']}", headers=headers).status_code == 404
    assert [r["plan"] for r in api_client.get(ROUTES, headers=headers).json()] == ["free", "free"]


def test_route_validation(api_client: TestClient, admin_enabled: None) -> None:
    headers = auth_headers(api_client, ADMIN)
    bad = [
        {"plan": "vip", "provider": "openai", "model": "x"},
        {"plan": "free", "provider": "mistral", "model": "x"},
        {"plan": "free", "provider": "openai", "model": "   "},
    ]
    assert [api_client.post(ROUTES, json=b, headers=headers).status_code for b in bad] == [422] * 3
    route = _route(api_client, headers, "free", "openai", "gpt-4o-mini")
    assert (
        api_client.patch(
            f"{ROUTES}/{route['id']}", json={"priority": 0}, headers=headers
        ).status_code
        == 422
    )
    assert (
        api_client.patch(
            f"{ROUTES}/00000000-0000-0000-0000-000000000000",
            json={"enabled": False},
            headers=headers,
        ).status_code
        == 404
    )


def test_saving_a_key_needs_the_encryption_key(
    api_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "ADMIN_EMAILS", ADMIN["email"])
    monkeypatch.setattr(settings, "SETTINGS_ENCRYPTION_KEY", "")
    headers = auth_headers(api_client, ADMIN)

    res = api_client.patch(f"{KEYS}/openai", json={"api_key": "sk-1"}, headers=headers)

    assert res.status_code == 503
    assert "SETTINGS_ENCRYPTION_KEY" in res.json()["error"]["message"]
    # 키를 지우는 것과 라우트 변경은 암호화 키 없이도 된다.
    assert (
        api_client.patch(f"{KEYS}/openai", json={"api_key": ""}, headers=headers).status_code == 200
    )


def test_active_chain_per_plan_falls_back_to_free_then_env(
    api_client: TestClient, admin_enabled: None, db_session: Session
) -> None:
    """요금제 라우트(켜짐+키) → 없으면 free 라우트 → 그것도 없으면 빈 목록(.env). 강제는 하나만."""
    headers = auth_headers(api_client, ADMIN)
    service = AdminLlmSettingsService(db_session)

    assert service.active_provider_chain("free") == []
    assert service.active_provider_chain("max") == []

    _set_key(api_client, headers, "openai", "k-openai")
    _set_key(api_client, headers, "google_genai", "k-google")
    _route(api_client, headers, "free", "google_genai", "gemini-2.5-flash")
    _route(api_client, headers, "free", "openai", "gpt-4o-mini")
    # 키 없는 공급자(anthropic) 라우트와 꺼둔 라우트는 쓰이지 않는다.
    _route(api_client, headers, "pro", "anthropic", "claude-sonnet-4-5")
    _route(api_client, headers, "free", "openai", "gpt-4.1", enabled=False)

    free = [(a.provider, a.model, a.api_key) for a in service.active_provider_chain("free")]
    assert free == [
        ("google_genai", "gemini-2.5-flash", "k-google"),
        ("openai", "gpt-4o-mini", "k-openai"),
    ]
    # pro는 쓸 수 있는 라우트가 없어 free를 따른다. max는 라우트가 아예 없어 free를 따른다.
    assert [a.provider for a in service.active_provider_chain("pro")] == ["google_genai", "openai"]
    assert [a.provider for a in service.active_provider_chain("max")] == ["google_genai", "openai"]
    assert [a.provider for a in service.active_provider_chain("vip")] == ["google_genai", "openai"]

    # pro에 쓸 수 있는 라우트가 생기면 그것만 쓴다(free와 섞지 않는다).
    pro_openai = _route(api_client, headers, "pro", "openai", "gpt-4.1")
    assert [(a.provider, a.model) for a in service.active_provider_chain("pro")] == [
        ("openai", "gpt-4.1")
    ]

    # 강제 라우트가 있으면 그것 하나만.
    api_client.patch(f"{ROUTES}/{pro_openai['id']}", json={"forced": True}, headers=headers)
    free_google = next(
        r
        for r in api_client.get(ROUTES, headers=headers).json()
        if r["plan"] == "free" and r["provider"] == "google_genai"
    )
    api_client.patch(f"{ROUTES}/{free_google['id']}", json={"forced": True}, headers=headers)
    assert [a.provider for a in service.active_provider_chain("free")] == ["google_genai"]
    assert [a.model for a in service.active_provider_chain("pro")] == ["gpt-4.1"]

    # 강제 라우트의 키가 사라지면 쓸 수 없으니 나머지 순서로 돌아간다.
    _set_key(api_client, headers, "google_genai", "")
    assert [a.provider for a in service.active_provider_chain("free")] == ["openai"]


def test_active_chain_skips_keys_it_cannot_decrypt(
    api_client: TestClient,
    admin_enabled: None,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """암호화 키가 바뀌면 그 공급자만 건너뛴다(.env 기본 동작으로). 요청 전체는 막지 않는다."""
    headers = auth_headers(api_client, ADMIN)
    _set_key(api_client, headers, "openai", "k")
    _route(api_client, headers, "free", "openai", "gpt-4o-mini")

    monkeypatch.setattr(settings, "SETTINGS_ENCRYPTION_KEY", Fernet.generate_key().decode())

    assert AdminLlmSettingsService(db_session).active_provider_chain("free") == []
