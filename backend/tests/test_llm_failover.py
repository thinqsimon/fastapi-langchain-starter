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
