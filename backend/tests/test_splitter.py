"""RAG 텍스트 분할 검증."""

from app.llm.rag.splitter import split_text


def test_short_text_stays_one_chunk() -> None:
    assert split_text("짧은 글입니다.", chunk_size=100) == ["짧은 글입니다."]


def test_every_chunk_fits_the_limit() -> None:
    text = "\n\n".join(f"{i}번째 문단입니다. " * 10 for i in range(8))

    chunks = split_text(text, chunk_size=200, overlap=0)

    assert len(chunks) > 1
    assert all(len(chunk) <= 200 for chunk in chunks)


def test_chunks_overlap_so_boundary_sentences_survive() -> None:
    text = "\n\n".join(f"문단{i}번 내용입니다" for i in range(8))

    chunks = split_text(text, chunk_size=40, overlap=8)

    assert len(chunks) > 1
    # 뒤 조각은 앞 조각의 끝부분을 품어, 경계에 걸친 문장이 사라지지 않는다.
    assert chunks[0][-8:] in chunks[1]


def test_text_without_separators_is_cut_by_length() -> None:
    chunks = split_text("가" * 250, chunk_size=100, overlap=0)

    assert [len(c) for c in chunks] == [100, 100, 50]


def test_blank_text_yields_nothing() -> None:
    assert split_text("   \n\n  ", chunk_size=100) == []


def test_invalid_arguments_are_rejected() -> None:
    import pytest

    with pytest.raises(ValueError, match="chunk_size"):
        split_text("abc", chunk_size=0)
    with pytest.raises(ValueError, match="overlap"):
        split_text("abc", chunk_size=10, overlap=10)
