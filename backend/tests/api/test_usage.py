"""OPT-USAGE 토큰 사용량·비용 검증."""

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

ACCOUNT = {"email": "usage@example.com", "password": "secret-password", "display_name": "사용자"}


@pytest.fixture
def headers(api_client: TestClient) -> dict[str, str]:
    api_client.post("/api/auth/signup", json=ACCOUNT)
    tokens = api_client.post(
        "/api/auth/login", json={"email": ACCOUNT["email"], "password": ACCOUNT["password"]}
    ).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_usage_requires_authentication(api_client: TestClient) -> None:
    assert api_client.get("/api/usage/me").status_code == 401


def test_usage_starts_at_zero(api_client: TestClient, headers: dict[str, str]) -> None:
    res = api_client.get("/api/usage/me", headers=headers)

    assert res.status_code == 200
    body = res.json()
    assert body["message_count"] == 0
    assert body["total_tokens"] == 0
    assert Decimal(body["estimated_cost_usd"]) == 0


def test_usage_only_counts_own_messages(api_client: TestClient, headers: dict[str, str]) -> None:
    """다른 사용자의 대화는 내 사용량에 들어오지 않는다."""
    conversation_id = api_client.post(
        "/api/conversations", json={"title": "내 대화"}, headers=headers
    ).json()["id"]
    api_client.post(
        f"/api/conversations/{conversation_id}/stream",
        json={"content": "안녕"},
        headers=headers,
    )

    other = {**ACCOUNT, "email": "usage-other@example.com"}
    api_client.post("/api/auth/signup", json=other)
    other_tokens = api_client.post(
        "/api/auth/login", json={"email": other["email"], "password": other["password"]}
    ).json()
    other_headers = {"Authorization": f"Bearer {other_tokens['access_token']}"}

    res = api_client.get("/api/usage/me", headers=other_headers)

    assert res.json()["message_count"] == 0
