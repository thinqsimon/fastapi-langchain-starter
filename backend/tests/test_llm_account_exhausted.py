"""공급자의 크레딧·지출 한도 소진 오류를 알아보는지 본다.

진짜 SDK와 LangChain이 로컬 서버의 응답을 받게 해서, 앱이 실제로 받는 예외로 확인한다.
SDK를 올리다 오류 모양이 바뀌면 여기서 드러난다. 실제 API는 부르지 않는다.
응답 본문은 각 공급자의 오류 문서를 따랐다(ADR-0012 후속).
"""

import json
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import pytest

from app.core.config import settings
from app.llm import providers
from app.llm.providers import get_chat_model, is_account_exhausted

_MODEL = {
    "anthropic": "claude-haiku-5-5",
    "openai": "gpt-4.1-mini",
    "google_genai": "gemini-2.5-flash",
}


def _claude(error_type: str, message: str, **extra: object) -> dict[str, object]:
    return {
        "type": "error",
        "error": {"type": error_type, "message": message, **extra},
        "request_id": "req_test",
    }


def _openai(error_type: str, code: str, message: str = "오류") -> dict[str, object]:
    return {"error": {"message": message, "type": error_type, "param": None, "code": code}}


def _gemini(code: int, status: str, message: str) -> dict[str, object]:
    return {"error": {"code": code, "message": message, "status": status}}


_QUOTA = "You exceeded your current quota, please check your plan and billing details."
_CREDIT = "Your credit balance is too low to access the Anthropic API."

EXHAUSTED = [
    ("anthropic", 400, _claude("invalid_request_error", _CREDIT)),
    (
        "anthropic",
        400,
        _claude("invalid_request_error", "You have reached your specified API usage limits."),
    ),
    (
        "anthropic",
        400,
        _claude(
            "invalid_request_error", "You have reached your specified workspace API usage limits."
        ),
    ),
    ("anthropic", 402, _claude("billing_error", "There's an issue with your billing.")),
    (
        "anthropic",
        429,
        _claude(
            "rate_limit_error",
            "You have reached your API usage limits.",
            details={"error_code": "enforced_spend_limit_reached"},
        ),
    ),
    ("openai", 429, _openai("insufficient_quota", "insufficient_quota", _QUOTA)),
    ("openai", 429, _openai("insufficient_quota", "credit_balance_exhausted")),
    ("openai", 429, _openai("insufficient_quota", "organization_spend_limit_exceeded")),
    ("openai", 429, _openai("insufficient_quota", "project_spend_limit_exceeded")),
    ("openai", 429, _openai("insufficient_quota", "organization_usage_limit_exceeded")),
    (
        "google_genai",
        429,
        _gemini(429, "RESOURCE_EXHAUSTED", "Your prepayment credits are depleted."),
    ),
    (
        "google_genai",
        429,
        _gemini(429, "RESOURCE_EXHAUSTED", "Your project has exceeded its monthly spending cap."),
    ),
    (
        "google_genai",
        429,
        _gemini(
            429, "RESOURCE_EXHAUSTED", "Your billing account has exceeded its monthly spending cap."
        ),
    ),
    (
        "google_genai",
        402,
        _gemini(402, "payment_required", "Your Prepay credit balance is depleted."),
    ),
]

# 같은 공급자의 다른 모델은 답할 수 있어서 건너뛰면 안 되는 오류.
NOT_EXHAUSTED = [
    ("anthropic", 429, _claude("rate_limit_error", "Would exceed your rate limit.")),
    ("anthropic", 400, _claude("invalid_request_error", "tool_choice is not supported.")),
    ("anthropic", 404, _claude("not_found_error", "model: claude-haiku-5-5")),
    ("anthropic", 529, _claude("overloaded_error", "Overloaded")),
    ("openai", 429, _openai("requests", "rate_limit_exceeded", "Rate limit reached.")),
    ("openai", 404, _openai("invalid_request_error", "model_not_found")),
    ("google_genai", 429, _gemini(429, "RESOURCE_EXHAUSTED", _QUOTA)),
    ("google_genai", 404, _gemini(404, "NOT_FOUND", "models/x is not found.")),
    ("google_genai", 503, _gemini(503, "UNAVAILABLE", "The model is overloaded.")),
]


class _LlmServer(ThreadingHTTPServer):
    """정해 둔 응답을 돌려주고 받은 요청 수를 센다."""

    status = 500
    body: dict[str, object] = {}  # noqa: RUF012 - 테스트마다 통째로 바꾼다
    request_count = 0


class _Handler(BaseHTTPRequestHandler):
    server: _LlmServer

    def do_POST(self) -> None:
        self.rfile.read(int(self.headers.get("content-length", 0)))
        self.server.request_count += 1
        data = json.dumps(self.server.body).encode()
        self.send_response(self.server.status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002, ANN401 - 표준 라이브러리 서명
        pass


@pytest.fixture
def llm_server(monkeypatch: pytest.MonkeyPatch) -> Iterator[_LlmServer]:
    server = _LlmServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    # fake 안전장치를 끄고 진짜 모델 객체를 만들되, 요청은 로컬 서버로만 간다.
    monkeypatch.setattr(settings, "LLM_PROVIDER", "openai")
    monkeypatch.setattr(settings, "LLM_BASE_URL", f"http://127.0.0.1:{server.server_address[1]}")
    yield server
    server.shutdown()
    server.server_close()
    thread.join()


async def _error_from(provider: str) -> Exception:
    chat_model = get_chat_model(provider=provider, model=_MODEL[provider], api_key="k")
    try:
        async for _ in chat_model.astream("안녕"):
            pass
    except Exception as exc:
        return exc
    raise AssertionError("오류가 나야 한다")


@pytest.fixture
def no_sdk_retries(monkeypatch: pytest.MonkeyPatch) -> None:
    """재시도 대기만큼 테스트가 늘어지지 않게 한다. 판별은 재시도와 상관없다."""
    monkeypatch.setattr(providers, "_MAX_RETRIES", {"google_genai": 1, "openai": 0, "anthropic": 0})


@pytest.mark.asyncio
@pytest.mark.usefixtures("no_sdk_retries")
@pytest.mark.parametrize(("provider", "status", "body"), EXHAUSTED)
async def test_recognizes_exhausted_account(
    llm_server: _LlmServer, provider: str, status: int, body: dict[str, object]
) -> None:
    llm_server.status, llm_server.body = status, body
    assert is_account_exhausted(await _error_from(provider))


@pytest.mark.asyncio
@pytest.mark.usefixtures("no_sdk_retries")
@pytest.mark.parametrize(("provider", "status", "body"), NOT_EXHAUSTED)
async def test_other_errors_are_not_exhausted_account(
    llm_server: _LlmServer, provider: str, status: int, body: dict[str, object]
) -> None:
    llm_server.status, llm_server.body = status, body
    assert not is_account_exhausted(await _error_from(provider))


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status", "body"),
    [
        (400, _claude("invalid_request_error", _CREDIT)),
        (402, _claude("billing_error", "There's an issue with your billing.")),
    ],
)
async def test_claude_credit_errors_fail_at_once_without_sdk_retry(
    llm_server: _LlmServer, status: int, body: dict[str, object]
) -> None:
    """Claude의 크레딧 소진은 SDK가 다시 시도하지 않아 다음 라우트로 바로 넘어간다."""
    llm_server.status, llm_server.body = status, body
    await _error_from("anthropic")
    assert llm_server.request_count == 1
