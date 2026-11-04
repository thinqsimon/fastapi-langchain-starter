"""LLM-03: 크레딧이 소진된 공급사를 모든 사용자의 요청에서 빼고 다시 넣는 동작을 실제 DB로 검증한다.

실제 공급자는 부르지 않는다. 오류 글자와 예외 모양은 tests/test_llm_account_exhausted.py가 지킨다.
"""

import threading
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.exceptions import LLMExhaustedError
from app.domain.admin.models import LlmProvider
from app.domain.admin.repositories import LlmProviderRepository
from app.domain.admin.services import AdminLlmSettingsService
from app.llm.chains import chat, diary
from app.llm.fake import build_fake_chat_model
from tests.api.accounts import ADMIN, MEMBER
from tests.api.test_diary import auth_headers
from tests.api.test_stream_errors import read_events

KEYS = "/api/admin/llm-providers"
ROUTES = "/api/admin/llm-routes"
OUT_OF_CREDIT = "Your credit balance is too low to access the Anthropic API."
EXHAUSTED_MESSAGE = "이번 달 AI 사용량이 소진되었습니다."


@pytest.fixture
def admin_headers(api_client: TestClient, admin_enabled: None) -> dict[str, str]:
    return auth_headers(api_client, ADMIN)


@pytest.fixture
def service(db_session: Session) -> AdminLlmSettingsService:
    return AdminLlmSettingsService(db_session)


def _set_key(client: TestClient, headers: dict[str, str], provider: str, key: str = "k") -> None:
    res = client.patch(f"{KEYS}/{provider}", json={"api_key": key}, headers=headers)
    assert res.status_code == 200, res.text


def _route(
    client: TestClient, headers: dict[str, str], plan: str, provider: str, model: str
) -> dict:
    res = client.post(
        ROUTES, json={"plan": plan, "provider": provider, "model": model}, headers=headers
    )
    assert res.status_code == 201, res.text
    return res.json()


def _chain(service: AdminLlmSettingsService, plan: str = "free") -> list[str]:
    return [attempt.provider for attempt in service.active_provider_chain(plan)]


def _row(db_session: Session, provider: str) -> LlmProvider:
    row = db_session.execute(
        select(LlmProvider)
        .where(LlmProvider.provider == provider)
        .execution_options(populate_existing=True)
    ).scalar_one()
    return row


def _age_check(db_session: Session, provider: str, minutes: int = 61) -> None:
    """마지막 확인 시각을 과거로 돌린다."""
    _row(db_session, provider).exhausted_checked_at = datetime.now(UTC) - timedelta(minutes=minutes)
    db_session.commit()


@pytest.fixture
def two_providers(api_client: TestClient, admin_headers: dict[str, str]) -> None:
    """free: Claude → OpenAI. 두 공급자 모두 키가 있다."""
    _set_key(api_client, admin_headers, "anthropic")
    _set_key(api_client, admin_headers, "openai")
    _route(api_client, admin_headers, "free", "anthropic", "haiku")
    _route(api_client, admin_headers, "free", "openai", "mini")


# ----- 제외와 저장 -----


def test_exhausted_provider_leaves_every_plan(
    two_providers: None,
    api_client: TestClient,
    admin_headers: dict[str, str],
    service: AdminLlmSettingsService,
    db_session: Session,
) -> None:
    _route(api_client, admin_headers, "max", "anthropic", "opus")
    _route(api_client, admin_headers, "max", "openai", "gpt")
    assert _chain(service, "free") == ["anthropic", "openai"]

    service.record_provider_states({"anthropic": True})

    assert _chain(service, "free") == ["openai"]
    assert _chain(service, "max") == ["openai"]
    row = _row(db_session, "anthropic")
    assert row.exhausted_at is not None
    assert row.exhausted_checked_at == row.exhausted_at


def test_all_routes_of_exhausted_provider_are_removed(
    two_providers: None,
    api_client: TestClient,
    admin_headers: dict[str, str],
    service: AdminLlmSettingsService,
) -> None:
    _route(api_client, admin_headers, "free", "anthropic", "sonnet")
    service.record_provider_states({"anthropic": True})
    assert _chain(service) == ["openai"]


# ----- 재확인 -----


def test_recheck_lets_one_request_try_after_the_interval(
    two_providers: None, service: AdminLlmSettingsService, db_session: Session
) -> None:
    service.record_provider_states({"anthropic": True})

    _age_check(db_session, "anthropic", minutes=59)
    assert _chain(service) == ["openai"]  # 아직 간격이 안 지났다

    _age_check(db_session, "anthropic", minutes=61)
    assert _chain(service) == ["anthropic", "openai"]  # 이 요청만 시도한다
    assert _chain(service) == ["openai"]  # 다음 요청은 다시 뺀다


def test_recheck_success_clears_and_failure_keeps_first_detection(
    two_providers: None, service: AdminLlmSettingsService, db_session: Session
) -> None:
    service.record_provider_states({"anthropic": True})
    first = _row(db_session, "anthropic").exhausted_at
    _age_check(db_session, "anthropic")

    # 또 소진: 처음 감지 시각은 그대로, 마지막 확인 시각만 새로워진다.
    service.record_provider_states({"anthropic": True})
    row = _row(db_session, "anthropic")
    assert row.exhausted_at == first
    assert row.exhausted_checked_at is not None and row.exhausted_checked_at > first
    assert _chain(service) == ["openai"]

    # 성공: 표시가 지워지고 모두에게 돌아온다.
    service.record_provider_states({"anthropic": False})
    row = _row(db_session, "anthropic")
    assert row.exhausted_at is None and row.exhausted_checked_at is None
    assert _chain(service) == ["anthropic", "openai"]


def test_recheck_with_other_error_keeps_excluding_for_another_interval(
    two_providers: None,
    api_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    service: AdminLlmSettingsService,
    db_session: Session,
) -> None:
    """네트워크 오류는 소진이 풀렸다는 증거가 아니다."""
    service.record_provider_states({"anthropic": True})
    _age_check(db_session, "anthropic")
    calls = _fake_llm(monkeypatch, {"haiku": "Connection error."})

    _ask(api_client, auth_headers(api_client, MEMBER))

    assert calls == ["haiku", "mini"]
    assert _row(db_session, "anthropic").exhausted_at is not None
    assert _chain(service) == ["openai"]


def test_only_one_of_concurrent_requests_gets_the_recheck(migrated_database: Engine) -> None:
    """여러 연결이 정말 동시에 잡으려 해도 한 건만 얻는다. 실제로 커밋하므로 직접 지운다."""
    provider = f"race-{uuid.uuid4().hex[:8]}"
    long_ago = datetime.now(UTC) - timedelta(hours=2)
    with Session(migrated_database) as session:
        session.add(
            LlmProvider(provider=provider, exhausted_at=long_ago, exhausted_checked_at=long_ago)
        )
        session.commit()

    try:
        workers = 8
        barrier = threading.Barrier(workers)
        results: list[bool] = []
        errors: list[SQLAlchemyError] = []

        def claim() -> None:
            with Session(migrated_database) as session:
                barrier.wait()
                now = datetime.now(UTC)
                try:
                    won = LlmProviderRepository(session).claim_recheck(
                        provider, now, now - timedelta(hours=1)
                    )
                    session.commit()
                    results.append(won)
                except SQLAlchemyError as error:
                    errors.append(error)

        threads = [threading.Thread(target=claim) for _ in range(workers)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        assert errors == []
        assert sorted(results) == [False] * (workers - 1) + [True]
    finally:
        with Session(migrated_database) as session:
            session.execute(delete(LlmProvider).where(LlmProvider.provider == provider))
            session.commit()


# ----- 라우트가 모두 빠질 때 -----


def test_paid_plan_falls_to_free_then_reports_exhausted(
    api_client: TestClient,
    admin_headers: dict[str, str],
    service: AdminLlmSettingsService,
) -> None:
    _set_key(api_client, admin_headers, "anthropic")
    _set_key(api_client, admin_headers, "openai")
    _route(api_client, admin_headers, "max", "anthropic", "opus")
    _route(api_client, admin_headers, "free", "openai", "mini")

    service.record_provider_states({"anthropic": True})
    assert [(a.provider, a.model) for a in service.active_provider_chain("max")] == [
        ("openai", "mini")
    ]

    service.record_provider_states({"openai": True})
    with pytest.raises(LLMExhaustedError) as caught:
        service.active_provider_chain("max")
    assert caught.value.message == EXHAUSTED_MESSAGE
    with pytest.raises(LLMExhaustedError):
        service.active_provider_chain("free")


def test_exhausted_chat_does_not_fall_to_env_provider(
    api_client: TestClient,
    admin_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    service: AdminLlmSettingsService,
) -> None:
    """빈 목록이면 .env 공급자로 새므로, 소진일 때는 공급자를 부르지 않고 안내한다."""
    _set_key(api_client, admin_headers, "anthropic")
    _route(api_client, admin_headers, "free", "anthropic", "haiku")
    service.record_provider_states({"anthropic": True})
    calls = _fake_llm(monkeypatch, {})

    events = _ask(api_client, auth_headers(api_client, MEMBER))

    assert ("error", EXHAUSTED_MESSAGE) in events
    assert calls == []


def test_fork_without_routes_still_uses_env_provider(
    api_client: TestClient, admin_headers: dict[str, str], service: AdminLlmSettingsService
) -> None:
    _set_key(api_client, admin_headers, "anthropic")
    service.record_provider_states({"anthropic": True})
    assert service.active_provider_chain("free") == []


def test_forced_route_is_not_removed(
    two_providers: None,
    api_client: TestClient,
    admin_headers: dict[str, str],
    service: AdminLlmSettingsService,
) -> None:
    routes = api_client.get(ROUTES, headers=admin_headers).json()
    claude = next(r for r in routes if r["provider"] == "anthropic")
    res = api_client.patch(f"{ROUTES}/{claude['id']}", json={"forced": True}, headers=admin_headers)
    assert res.status_code == 200, res.text

    service.record_provider_states({"anthropic": True})

    assert _chain(service) == ["anthropic"]


# ----- 관리자 -----


def test_admin_sees_state_and_recharged_button_restores(
    two_providers: None,
    api_client: TestClient,
    admin_headers: dict[str, str],
    service: AdminLlmSettingsService,
) -> None:
    service.record_provider_states({"anthropic": True})
    rows = {r["provider"]: r for r in api_client.get(KEYS, headers=admin_headers).json()}
    assert rows["anthropic"]["exhausted_at"] and rows["anthropic"]["exhausted_checked_at"]
    assert rows["openai"]["exhausted_at"] is None

    res = api_client.post(f"{KEYS}/anthropic/recharged", headers=admin_headers)

    assert res.status_code == 200, res.text
    assert res.json()["exhausted_at"] is None and res.json()["exhausted_checked_at"] is None
    assert _chain(service) == ["anthropic", "openai"]


@pytest.mark.parametrize("new_key", ["new-key", ""])
def test_changing_or_removing_key_clears_state(
    two_providers: None,
    api_client: TestClient,
    admin_headers: dict[str, str],
    service: AdminLlmSettingsService,
    db_session: Session,
    new_key: str,
) -> None:
    service.record_provider_states({"anthropic": True})

    _set_key(api_client, admin_headers, "anthropic", new_key)

    assert _row(db_session, "anthropic").exhausted_at is None


def test_recharged_is_admin_only(api_client: TestClient, admin_enabled: None) -> None:
    headers = auth_headers(api_client, MEMBER)
    assert api_client.post(f"{KEYS}/anthropic/recharged", headers=headers).status_code == 403


def test_saving_state_failure_does_not_raise(
    service: AdminLlmSettingsService, monkeypatch: pytest.MonkeyPatch, admin_enabled: None
) -> None:
    """상태를 못 저장해도 이미 받은 답변을 망치지 않는다."""

    def broken(*_args: object) -> None:
        raise SQLAlchemyError("저장 실패")

    monkeypatch.setattr(service.providers, "mark_exhausted", broken)
    service.record_provider_states({"anthropic": True})


# ----- 채팅·일기 초안·주간 회고 -----


def _fake_llm(monkeypatch: pytest.MonkeyPatch, failures: dict[str, str]) -> list[str | None]:
    """모델 이름별로 정한 오류를 내는 가짜 공급자. 채팅·일기가 같은 것을 쓴다."""
    calls: list[str | None] = []

    def fake_get_chat_model(*, provider=None, model=None, api_key=None, base_url=None):  # noqa: ANN001, ANN202
        calls.append(model)
        if model in failures:
            raise RuntimeError(failures[model])
        return build_fake_chat_model()

    monkeypatch.setattr(chat, "get_chat_model", fake_get_chat_model)
    monkeypatch.setattr(diary, "get_chat_model", fake_get_chat_model)
    return calls


def _ask(client: TestClient, headers: dict[str, str]) -> list[tuple[str, str]]:
    conversation = client.post("/api/conversations", json={"title": "소진"}, headers=headers).json()
    res = client.post(
        f"/api/conversations/{conversation['id']}/stream",
        json={"content": "오늘 JWT를 배웠어요"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    return read_events(res)


@pytest.fixture
def member_with_chat(
    two_providers: None, api_client: TestClient
) -> Iterator[tuple[dict[str, str], str]]:
    """소진이 아직 없을 때 대화를 만들어 둔 회원."""
    headers = auth_headers(api_client, MEMBER)
    conversation = api_client.post(
        "/api/conversations", json={"title": "소진"}, headers=headers
    ).json()
    res = api_client.post(
        f"/api/conversations/{conversation['id']}/stream",
        json={"content": "오늘 JWT를 배웠어요"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    yield headers, conversation["id"]


def test_chat_detects_excludes_and_recovers(
    two_providers: None,
    api_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    db_session: Session,
) -> None:
    headers = auth_headers(api_client, MEMBER)
    calls = _fake_llm(monkeypatch, {"haiku": OUT_OF_CREDIT})

    # 처음: Claude에서 소진을 알아채고 OpenAI가 답한다.
    assert any(name == "token" for name, _ in _ask(api_client, headers))
    assert calls == ["haiku", "mini"]
    assert _row(db_session, "anthropic").exhausted_at is not None

    # 다음 요청은 Claude를 부르지 않는다.
    calls.clear()
    _ask(api_client, headers)
    assert calls == ["mini"]

    # 1시간 뒤 충전이 됐으면 Claude가 답하고 표시가 지워진다.
    _age_check(db_session, "anthropic")
    calls = _fake_llm(monkeypatch, {})
    _ask(api_client, headers)
    assert calls == ["haiku"]
    assert _row(db_session, "anthropic").exhausted_at is None


def test_chat_ordinary_failure_does_not_mark_exhausted(
    two_providers: None,
    api_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    db_session: Session,
) -> None:
    calls = _fake_llm(monkeypatch, {"haiku": "429 Too Many Requests"})

    _ask(api_client, auth_headers(api_client, MEMBER))

    assert calls == ["haiku", "mini"]
    assert _row(db_session, "anthropic").exhausted_at is None


def test_diary_draft_detects_excludes_and_reports(
    member_with_chat: tuple[dict[str, str], str],
    api_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    db_session: Session,
) -> None:
    headers, conversation_id = member_with_chat
    calls = _fake_llm(monkeypatch, {"haiku": OUT_OF_CREDIT})
    body = {"conversation_id": conversation_id}

    assert api_client.post("/api/diary/draft", json=body, headers=headers).status_code == 200
    assert calls == ["haiku", "mini"]
    assert _row(db_session, "anthropic").exhausted_at is not None

    calls.clear()
    assert api_client.post("/api/diary/draft", json=body, headers=headers).status_code == 200
    assert calls == ["mini"]

    # 남은 공급자까지 소진이면 안내가 나온다.
    calls = _fake_llm(monkeypatch, {"mini": "insufficient_quota"})
    assert api_client.post("/api/diary/draft", json=body, headers=headers).status_code == 503
    assert calls == ["mini"]
    res = api_client.post("/api/diary/draft", json=body, headers=headers)
    assert res.status_code == 503
    assert res.json()["error"] == {"code": "LLM_EXHAUSTED", "message": EXHAUSTED_MESSAGE}
    assert calls == ["mini"]  # 이번에는 공급자를 부르지 않았다


def test_weekly_review_detects_excludes_and_recovers(
    two_providers: None,
    api_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    db_session: Session,
) -> None:
    headers = auth_headers(api_client, MEMBER)
    entry = {"title": "일기", "learned": "JWT를 배웠다", "difficult": "만료 처리"}
    assert api_client.post("/api/diary", json=entry, headers=headers).status_code == 201
    calls = _fake_llm(monkeypatch, {"haiku": OUT_OF_CREDIT})

    assert api_client.get("/api/diary/weekly", headers=headers).status_code == 200
    assert calls == ["haiku", "mini"]
    assert _row(db_session, "anthropic").exhausted_at is not None

    calls.clear()
    assert api_client.get("/api/diary/weekly", headers=headers).status_code == 200
    assert calls == ["mini"]

    _age_check(db_session, "anthropic")
    calls = _fake_llm(monkeypatch, {})
    assert api_client.get("/api/diary/weekly", headers=headers).status_code == 200
    assert calls == ["haiku"]
    assert _row(db_session, "anthropic").exhausted_at is None
