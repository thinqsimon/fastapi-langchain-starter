from app.llm.providers import get_chat_model


def test_fake_llm_streams() -> None:
    model = get_chat_model()
    chunks = [c.content for c in model.stream("hi")]
    assert "".join(str(c) for c in chunks)
