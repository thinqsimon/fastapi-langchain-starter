"""PREF-01 개인 설정(캐치프레이즈·일기 푸터) 검증."""

import pytest
from fastapi.testclient import TestClient

from app.domain.preferences.services import DEFAULT_CATCHPHRASE, DEFAULT_DIARY_FOOTER

ACCOUNT = {"email": "pref@example.com", "password": "secret-password", "display_name": "설정"}


def auth_headers(client: TestClient, account: dict[str, str]) -> dict[str, str]:
    client.post("/api/auth/signup", json=account)
    tokens = client.post(
        "/api/auth/login", json={"email": account["email"], "password": account["password"]}
    ).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def headers(api_client: TestClient) -> dict[str, str]:
    return auth_headers(api_client, ACCOUNT)


def test_preferences_require_authentication(api_client: TestClient) -> None:
    assert api_client.get("/api/me/preferences").status_code == 401


def test_defaults_when_never_saved(api_client: TestClient, headers: dict[str, str]) -> None:
    res = api_client.get("/api/me/preferences", headers=headers)

    assert res.status_code == 200
    assert res.json() == {
        "catchphrase": DEFAULT_CATCHPHRASE,
        "diary_footer": DEFAULT_DIARY_FOOTER,
        "suggest_questions": False,
    }


def test_default_values_match_requirement() -> None:
    """요구사항에 적힌 문구 그대로여야 한다."""
    assert (
        DEFAULT_CATCHPHRASE
        == "풀스택 화이팅 !!!  절실하게 공부합시다!!! 운영진 분들 강사님 감사합니다."
    )
    assert DEFAULT_DIARY_FOOTER == "감사 합니다."


def test_update_is_persisted(api_client: TestClient, headers: dict[str, str]) -> None:
    body = {"catchphrase": "오늘도 한 걸음", "diary_footer": "내일 또 봐요"}

    assert api_client.put("/api/me/preferences", json=body, headers=headers).status_code == 200
    assert api_client.get("/api/me/preferences", headers=headers).json() == {
        **body,
        "suggest_questions": False,
    }


def test_blank_values_are_allowed(api_client: TestClient, headers: dict[str, str]) -> None:
    """푸터를 비우면 일기에 붙지 않아야 하므로 빈 값 저장을 허용한다."""
    res = api_client.put(
        "/api/me/preferences", json={"catchphrase": "", "diary_footer": "  "}, headers=headers
    )

    assert res.status_code == 200
    assert res.json() == {"catchphrase": "", "diary_footer": "", "suggest_questions": False}


def test_preferences_are_per_user(api_client: TestClient, headers: dict[str, str]) -> None:
    api_client.put(
        "/api/me/preferences",
        json={"catchphrase": "내 문구", "diary_footer": "내 푸터"},
        headers=headers,
    )
    other = auth_headers(api_client, {**ACCOUNT, "email": "pref-other@example.com"})

    assert api_client.get("/api/me/preferences", headers=other).json()["catchphrase"] == (
        DEFAULT_CATCHPHRASE
    )


def test_reset_restores_defaults(api_client: TestClient, headers: dict[str, str]) -> None:
    api_client.put(
        "/api/me/preferences",
        json={"catchphrase": "바꾼 문구", "diary_footer": ""},
        headers=headers,
    )

    res = api_client.delete("/api/me/preferences", headers=headers)

    defaults = {
        "catchphrase": DEFAULT_CATCHPHRASE,
        "diary_footer": DEFAULT_DIARY_FOOTER,
        "suggest_questions": False,
    }
    assert res.status_code == 200
    assert res.json() == defaults
    assert api_client.get("/api/me/preferences", headers=headers).json() == defaults
    # 저장한 적이 없어도 되돌리기는 성공한다.
    assert api_client.delete("/api/me/preferences", headers=headers).status_code == 200


def test_saving_again_overwrites(api_client: TestClient, headers: dict[str, str]) -> None:
    for footer in ("처음 푸터", "다시 쓴 푸터"):
        api_client.put(
            "/api/me/preferences",
            json={"catchphrase": "문구", "diary_footer": footer},
            headers=headers,
        )

    assert api_client.get("/api/me/preferences", headers=headers).json()["diary_footer"] == (
        "다시 쓴 푸터"
    )


def test_suggest_questions_switch_is_per_user_and_survives_phrase_reset(
    api_client: TestClient, headers: dict[str, str]
) -> None:
    """CHAT-04: 추천 질문 설정은 문구의 '기본값으로'와 따로 저장된다."""
    switch = "/api/me/preferences/suggest-questions"
    assert api_client.put(switch, json={"enabled": True}).status_code == 401

    res = api_client.put(switch, json={"enabled": True}, headers=headers)
    assert res.status_code == 200
    assert res.json()["suggest_questions"] is True
    api_client.put(
        "/api/me/preferences", json={"catchphrase": "문구", "diary_footer": ""}, headers=headers
    )
    assert api_client.delete("/api/me/preferences", headers=headers).json()["suggest_questions"]
    other = auth_headers(api_client, {**ACCOUNT, "email": "pref-switch@example.com"})
    assert not api_client.get("/api/me/preferences", headers=other).json()["suggest_questions"]

    api_client.put(switch, json={"enabled": False}, headers=headers)
    assert not api_client.get("/api/me/preferences", headers=headers).json()["suggest_questions"]
