"""ADMIN-03: 관리자가 사용자 요금제를 지정하면 그 사용자의 채팅이 그 요금제의 라우트를 탄다."""

import logging

import pytest
from fastapi.testclient import TestClient

from tests.api.accounts import ADMIN, MEMBER
from tests.api.test_diary import auth_headers

USERS = "/api/admin/users"
KEYS = "/api/admin/llm-providers"
ROUTES = "/api/admin/llm-routes"


def _member_id(api_client: TestClient, admin_headers: dict[str, str]) -> str:
    return api_client.get(USERS, params={"q": MEMBER["email"]}, headers=admin_headers).json()[0][
        "id"
    ]


def test_admin_sets_plan_and_user_sees_it(
    api_client: TestClient, admin_enabled: None, caplog: pytest.LogCaptureFixture
) -> None:
    member_headers = auth_headers(api_client, MEMBER)
    admin_headers = auth_headers(api_client, ADMIN)
    member_id = _member_id(api_client, admin_headers)
    assert api_client.get("/api/auth/me", headers=member_headers).json()["plan"] == "free"

    with caplog.at_level(logging.INFO):
        res = api_client.patch(
            f"{USERS}/{member_id}/plan", json={"plan": "pro"}, headers=admin_headers
        )
    assert res.status_code == 200 and res.json()["plan"] == "pro"
    assert "admin_plan_changed" in caplog.text and "previous=free" in caplog.text
    assert api_client.get("/api/auth/me", headers=member_headers).json()["plan"] == "pro"

    assert (
        api_client.patch(
            f"{USERS}/{member_id}/plan", json={"plan": "vip"}, headers=admin_headers
        ).status_code
        == 422
    )
    assert (
        api_client.patch(
            f"{USERS}/{member_id}/plan", json={"plan": "max"}, headers=member_headers
        ).status_code
        == 403
    )
    assert (
        api_client.patch(
            f"{USERS}/00000000-0000-0000-0000-000000000000/plan",
            json={"plan": "max"},
            headers=admin_headers,
        ).status_code
        == 404
    )


def test_chat_uses_the_plan_route_and_records_plan(
    api_client: TestClient, admin_enabled: None
) -> None:
    """LLM_PROVIDER=fake라 실제 호출은 없지만, 어느 라우트를 골랐는지는 메시지에 기록된다."""
    member_headers = auth_headers(api_client, MEMBER)
    admin_headers = auth_headers(api_client, ADMIN)
    member_id = _member_id(api_client, admin_headers)

    for provider in ("openai", "anthropic"):
        api_client.patch(
            f"{KEYS}/{provider}", json={"api_key": f"k-{provider}"}, headers=admin_headers
        )
    api_client.post(
        ROUTES,
        json={"plan": "free", "provider": "openai", "model": "gpt-4o-mini"},
        headers=admin_headers,
    )
    api_client.post(
        ROUTES,
        json={"plan": "pro", "provider": "anthropic", "model": "claude-pro-test"},
        headers=admin_headers,
    )

    def ask(text: str) -> dict:
        conversation_id = api_client.post(
            "/api/conversations", json={"title": text}, headers=member_headers
        ).json()["id"]
        assert (
            api_client.post(
                f"/api/conversations/{conversation_id}/stream",
                json={"content": text},
                headers=member_headers,
            ).status_code
            == 200
        )
        messages = api_client.get(
            f"/api/conversations/{conversation_id}/messages", headers=member_headers
        ).json()
        return messages[-1]

    free_answer = ask("free 요금제 질문")
    assert (free_answer["provider"], free_answer["model"], free_answer["plan"]) == (
        "openai",
        "gpt-4o-mini",
        "free",
    )

    api_client.patch(f"{USERS}/{member_id}/plan", json={"plan": "pro"}, headers=admin_headers)
    pro_answer = ask("pro 요금제 질문")
    assert (pro_answer["provider"], pro_answer["model"], pro_answer["plan"]) == (
        "anthropic",
        "claude-pro-test",
        "pro",
    )

    # max는 라우트가 없어 free 라우트를 따르지만, 기록되는 요금제는 max다.
    api_client.patch(f"{USERS}/{member_id}/plan", json={"plan": "max"}, headers=admin_headers)
    max_answer = ask("max 요금제 질문")
    assert (max_answer["provider"], max_answer["model"], max_answer["plan"]) == (
        "openai",
        "gpt-4o-mini",
        "max",
    )
