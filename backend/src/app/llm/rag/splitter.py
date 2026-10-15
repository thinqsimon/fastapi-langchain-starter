"""긴 글을 검색하기 좋은 크기로 자른다.

문단 → 줄 → 공백 순서로 자연스러운 경계를 먼저 찾고, 그래도 길면 글자 수로 끊는다.
앞뒤 조각이 조금씩 겹치게 해서 경계에 걸친 문장이 통째로 사라지지 않게 한다.
"""

from collections.abc import Iterator

SEPARATORS = ["\n\n", "\n", ". ", " "]


def _split_once(text: str, limit: int) -> Iterator[str]:
    """구분자를 우선순위대로 시도해 limit 이하 조각으로 나눈다."""
    if len(text) <= limit:
        if text.strip():
            yield text
        return

    for separator in SEPARATORS:
        if separator not in text:
            continue

        chunk = ""
        for piece in text.split(separator):
            candidate = f"{chunk}{separator}{piece}" if chunk else piece
            if len(candidate) <= limit:
                chunk = candidate
            else:
                if chunk.strip():
                    yield chunk
                chunk = piece
        if chunk.strip():
            yield chunk
        return

    # 구분자가 하나도 없는 긴 문자열(긴 URL 등)은 글자 수로 끊는다.
    for start in range(0, len(text), limit):
        piece = text[start : start + limit]
        if piece.strip():
            yield piece


def split_text(text: str, chunk_size: int = 800, overlap: int | None = None) -> list[str]:
    """`chunk_size` 이하 조각 목록으로 자른다. 이웃한 조각은 `overlap` 글자만큼 겹친다.

    `overlap`을 생략하면 조각 크기에 맞춰 정한다. 고정값을 쓰면 작은 조각에서 겹침이
    조각보다 커지는 모순이 생긴다.
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size는 1 이상이어야 합니다.")

    if overlap is None:
        overlap = min(100, chunk_size // 5)
    if not 0 <= overlap < chunk_size:
        raise ValueError("overlap은 0 이상 chunk_size 미만이어야 합니다.")

    pieces = [piece.strip() for piece in _split_once(text, chunk_size) if piece.strip()]
    if overlap == 0 or len(pieces) <= 1:
        return pieces

    overlapped = [pieces[0]]
    for previous, current in zip(pieces, pieces[1:], strict=False):
        tail = previous[-overlap:]
        overlapped.append(f"{tail} {current}".strip())
    return overlapped
