"""ADMIN-01: 앞 공급자가 실패하면 다음 우선순위로 자동 전환한다(실제 공급자는 부르지 않는다)."""

import pytest

from app.core.exceptions import LLMError
from app.llm.chains import chat, diary
from app.llm.fake import build_fake_chat_model
from app.llm.providers import ProviderAttempt

CHAIN = (
    ProviderAttempt(provider="broken", model="x", api_key="k1"),
    ProviderAttempt(provider="backup", model="y", api_key="k2"),
)


def _dispatcher(calls: list[str | None]):  # noqa: ANN202 - 테스트 보조
    def fake_get_chat_model(*, provider=None, model=None, api_key=None, base_url=None):  # noqa: ANN001
        calls.append(provider)
        if provider == "broken":
            raise RuntimeError("insufficient_quota")
        return build_fake_chat_model()

    return fake_get_chat_model


@pytest.mark.asyncio
async def test_stream_reply_falls_over_before_sending_anything(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str | None] = []
    monkeypatch.setattr(chat, "get_chat_model", _dispatcher(calls))

    chunks = [c async for c in chat.stream_reply("안녕", providers=CHAIN)]

    assert "".join(chunks)
    assert calls == ["broken", "backup"]


@pytest.mark.asyncio
async def test_stream_reply_gives_up_when_every_provider_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def explode(**_kwargs: object) -> object:
        raise RuntimeError("quota")

    monkeypatch.setattr(chat, "get_chat_model", explode)

    with pytest.raises(LLMError):
        async for _ in chat.stream_reply("안녕", providers=CHAIN):
            pass


@pytest.mark.asyncio
async def test_stream_reply_without_admin_settings_uses_env_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """관리자가 아무것도 설정하지 않으면(빈 목록) 예전처럼 .env 공급자 하나만 쓴다."""
    calls: list[str | None] = []
    monkeypatch.setattr(chat, "get_chat_model", _dispatcher(calls))

    assert "".join([c async for c in chat.stream_reply("안녕", providers=[])])
    assert calls == [None]


@pytest.mark.asyncio
async def test_draft_and_review_fall_over_too(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str | None] = []
    monkeypatch.setattr(diary, "get_chat_model", _dispatcher(calls))

    draft = await diary.draft_diary([("user", "오늘 JWT를 배웠어요")], providers=CHAIN)
    review = await diary.review_week(["일기 하나"], providers=CHAIN)

    assert draft.learned and review.grown
    assert calls == ["broken", "backup", "broken", "backup"]


OUT_OF_CREDIT = "Your credit balance is too low to access the Anthropic API."


def _failing(calls: list[str | None], failures: dict[str, str]):  # noqa: ANN202 - 테스트 보조
    """모델 이름별로 정한 오류를 내는 가짜 공급자. 목록에 없는 모델은 정상으로 답한다."""

    def fake_get_chat_model(*, provider=None, model=None, api_key=None, base_url=None):  # noqa: ANN001
        calls.append(model)
        if model in failures:
            raise RuntimeError(failures[model])
        return build_fake_chat_model()

    return fake_get_chat_model


def _routes(*routes: tuple[str, str]) -> tuple[ProviderAttempt, ...]:
    return tuple(ProviderAttempt(provider=p, model=m, api_key="k") for p, m in routes)


@pytest.mark.asyncio
async def test_exhausted_provider_skips_its_next_route(monkeypatch: pytest.MonkeyPatch) -> None:
    """1·2번이 모두 Claude면 크레딧이 떨어졌을 때 2번을 건너뛰고 3번으로 바로 간다."""
    calls: list[str | None] = []
    monkeypatch.setattr(chat, "get_chat_model", _failing(calls, {"haiku": OUT_OF_CREDIT}))
    routes = _routes(("anthropic", "haiku"), ("anthropic", "opus"), ("openai", "gpt"))

    assert "".join([c async for c in chat.stream_reply("안녕", providers=routes)])
    assert calls == ["haiku", "gpt"]


@pytest.mark.asyncio
async def test_exhausted_provider_is_skipped_even_when_not_adjacent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str | None] = []
    failures = {"haiku": OUT_OF_CREDIT, "gpt": "잠깐 실패"}
    monkeypatch.setattr(chat, "get_chat_model", _failing(calls, failures))
    routes = _routes(
        ("anthropic", "haiku"), ("openai", "gpt"), ("anthropic", "opus"), ("google_genai", "flash")
    )

    assert "".join([c async for c in chat.stream_reply("안녕", providers=routes)])
    assert calls == ["haiku", "gpt", "flash"]


@pytest.mark.asyncio
async def test_ordinary_failure_still_tries_the_same_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """그냥 한도 초과는 모델별일 수 있어(Gemini) 같은 공급자의 다음 모델을 시도한다."""
    calls: list[str | None] = []
    failures = {"flash": "429 RESOURCE_EXHAUSTED. You exceeded your current quota"}
    monkeypatch.setattr(chat, "get_chat_model", _failing(calls, failures))
    routes = _routes(("google_genai", "flash"), ("google_genai", "lite"))

    assert "".join([c async for c in chat.stream_reply("안녕", providers=routes)])
    assert calls == ["flash", "lite"]


@pytest.mark.asyncio
async def test_gives_up_when_only_exhausted_routes_remain(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str | None] = []
    monkeypatch.setattr(chat, "get_chat_model", _failing(calls, {"haiku": OUT_OF_CREDIT}))
    routes = _routes(("anthropic", "haiku"), ("anthropic", "opus"))

    with pytest.raises(LLMError) as caught:
        async for _ in chat.stream_reply("안녕", providers=routes):
            pass

    assert calls == ["haiku"]
    assert OUT_OF_CREDIT in str(caught.value.__cause__)


@pytest.mark.asyncio
async def test_last_route_failure_reason_is_logged(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """모든 라우트가 실패해도 크레딧 소진 같은 사유를 로그에서 찾을 수 있다."""
    monkeypatch.setattr(chat, "get_chat_model", _failing([], {"haiku": OUT_OF_CREDIT}))

    with pytest.raises(LLMError):
        async for _ in chat.stream_reply("안녕", providers=_routes(("anthropic", "haiku"))):
            pass

    assert OUT_OF_CREDIT in caplog.text


@pytest.mark.asyncio
async def test_draft_and_review_skip_exhausted_provider_too(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str | None] = []
    monkeypatch.setattr(diary, "get_chat_model", _failing(calls, {"haiku": OUT_OF_CREDIT}))
    routes = _routes(("anthropic", "haiku"), ("anthropic", "opus"), ("openai", "gpt"))

    draft = await diary.draft_diary([("user", "오늘 JWT를 배웠어요")], providers=routes)
    review = await diary.review_week(["일기 하나"], providers=routes)

    assert draft.learned and review.grown
    assert calls == ["haiku", "gpt", "haiku", "gpt"]


@pytest.mark.asyncio
async def test_draft_and_review_give_up_when_only_exhausted_routes_remain(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str | None] = []
    monkeypatch.setattr(diary, "get_chat_model", _failing(calls, {"haiku": OUT_OF_CREDIT}))
    routes = _routes(("anthropic", "haiku"), ("anthropic", "opus"))

    with pytest.raises(LLMError):
        await diary.draft_diary([("user", "오늘 JWT를 배웠어요")], providers=routes)
    with pytest.raises(LLMError):
        await diary.review_week(["일기 하나"], providers=routes)

    assert calls == ["haiku", "haiku"]
