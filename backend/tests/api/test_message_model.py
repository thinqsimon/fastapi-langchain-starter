"""LLM-02: 답변마다 공급자·모델을 저장하고, 사용량 비용은 모델별 단가로 계산한다."""

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain.chat.models import Message
from app.llm.pricing import estimate_cost_usd
from tests.api.test_diary import auth_headers

ACCOUNT = {"email": "model-tag@example.com", "password": "secret-password", "display_name": "모델"}


def _chat(api_client: TestClient, headers: dict[str, str], text: str) -> str:
    conversation_id = api_client.post(
        "/api/conversations", json={"title": "모델 기록"}, headers=headers
    ).json()["id"]
    res = api_client.post(
        f"/api/conversations/{conversation_id}/stream", json={"content": text}, headers=headers
    )
    assert res.status_code == 200
    return conversation_id


def test_assistant_message_records_provider_and_model(
    api_client: TestClient, db_session: Session
) -> None:
    headers = auth_headers(api_client, ACCOUNT)
    conversation_id = _chat(api_client, headers, "안녕")

    messages = api_client.get(
        f"/api/conversations/{conversation_id}/messages", headers=headers
    ).json()
    user, assistant = messages[0], messages[1]
    assert user["role"] == "user" and user["provider"] is None and user["model"] is None
    assert assistant["role"] == "assistant"
    assert assistant["provider"] == settings.LLM_PROVIDER == "fake"
    assert assistant["model"] == settings.LLM_MODEL

    # 대화 상세에도 같은 값이 실린다.
    detail = api_client.get(f"/api/conversations/{conversation_id}", headers=headers).json()
    assert detail["messages"][1]["model"] == settings.LLM_MODEL


def test_usage_is_summed_per_model(api_client: TestClient, db_session: Session) -> None:
    headers = auth_headers(api_client, ACCOUNT)
    conversation_id = _chat(api_client, headers, "안녕")

    # 다른 공급자가 답한 것처럼 한 건, 모델을 모르는 예전 답변처럼 한 건을 심는다.
    db_session.add(
        Message(
            conversation_id=conversation_id,
            role="assistant",
            content="gemini 답",
            input_tokens=1_000_000,
            output_tokens=0,
            provider="google_genai",
            model="gemini-2.5-flash",
        )
    )
    db_session.add(
        Message(
            conversation_id=conversation_id,
            role="assistant",
            content="예전 답",
            input_tokens=10,
            output_tokens=10,
        )
    )
    db_session.flush()

    usage = api_client.get("/api/usage/me", headers=headers).json()
    by_model = {item["model"]: item for item in usage["by_model"]}

    assert by_model["gemini-2.5-flash"]["provider"] == "google_genai"
    assert Decimal(by_model["gemini-2.5-flash"]["estimated_cost_usd"]) == estimate_cost_usd(
        "gemini-2.5-flash", 1_000_000, 0
    )
    # 모델을 모르는 답변은 .env 모델로 집계된다(fake 테스트에선 LLM_MODEL 기본값).
    assert settings.LLM_MODEL in by_model
    assert usage["message_count"] == sum(item["message_count"] for item in usage["by_model"])
    assert Decimal(usage["estimated_cost_usd"]) == sum(
        (Decimal(item["estimated_cost_usd"]) for item in usage["by_model"]), Decimal(0)
    )
    assert usage["input_tokens"] == sum(item["input_tokens"] for item in usage["by_model"])
