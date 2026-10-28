"""NOTE-01: /study-notes 노트 파서. DB 없이 돈다."""

import pytest

from app.core.exceptions import AppError
from app.domain.notebook.parser import filename_stem, join_tags, parse_notebook, split_tags

SAMPLE = """---
title: SpaceXyzDiary 배움노트 #01
project: SpaceXyzDiary
session: b4a801d7
topics: 2
---
# SpaceXyzDiary 배움노트 #01 · 2026-10-27

> 첫 줄 요약.
> 둘째 줄 요약.

## 목차
| # | 주제 | 유형 | 난이도 |
|---|---|---|---|
| 1 | 스킬 만들기 | 워크플로 | ★☆☆ |

---

## 1. 스킬 만들기
> 한 줄 요약: 스킬은 절차를 적은 md 파일이다.

`유형` 워크플로 | `태그` claude-code, skill, 자동화 | `난이도` ★☆☆

### 핵심 개념
본문 첫 단락.

```markdown
---
name: handoff
---
## 코드 블록 안의 제목은 주제가 아니다
```

---

## 2. 유니코드 정규화
> 한 줄 요약: NFC와 NFD.

`유형` 문제해결 | `태그` unicode, nfc ,nfd,, nfc | `난이도` ★★★

### 문제 → 원인 → 해결 → 재발 방지
증상 설명.

---
"""


def test_sample_note_is_split_into_topics() -> None:
    parsed = parse_notebook(SAMPLE, "2026-10-27_01.md")

    assert parsed.title == "SpaceXyzDiary 배움노트 #01"
    assert parsed.project == "SpaceXyzDiary"
    assert parsed.summary == "첫 줄 요약.\n둘째 줄 요약."
    assert [topic.title for topic in parsed.topics] == ["스킬 만들기", "유니코드 정규화"]


def test_fenced_heading_and_separator_stay_in_content() -> None:
    first = parse_notebook(SAMPLE).topics[0]

    assert first.content.startswith("> 한 줄 요약")
    assert "## 코드 블록 안의 제목은 주제가 아니다" in first.content
    assert "---\nname: handoff\n---" in first.content
    # 주제 사이의 구분선은 본문에 남기지 않는다.
    assert first.content.endswith("```")


def test_tilde_fence_is_also_a_fence() -> None:
    parsed = parse_notebook("## A\n~~~\n## B\n~~~\n")

    assert [topic.title for topic in parsed.topics] == ["A"]
    assert parsed.topics[0].content == "~~~\n## B\n~~~"


def test_longer_fence_contains_shorter_fence_lines() -> None:
    text = "## A\n````markdown\n```python\nprint(1)\n```\n## 펜스 안\n````\n## B\n본문\n"
    parsed = parse_notebook(text)

    assert [topic.title for topic in parsed.topics] == ["A", "B"]
    assert parsed.topics[0].content == "````markdown\n```python\nprint(1)\n```\n## 펜스 안\n````"


def test_closing_fence_must_match_opening_character() -> None:
    # ~~~는 ```를 닫지 못한다. 닫히지 않은 펜스는 파일 끝까지 본문이다.
    parsed = parse_notebook("## A\n```\n~~~\n## 아직 펜스 안\n")

    assert [topic.title for topic in parsed.topics] == ["A"]
    assert "## 아직 펜스 안" in parsed.topics[0].content


def test_toc_heading_is_skipped_even_with_trailing_spaces() -> None:
    parsed = parse_notebook("## 목차   \n| 1 | x |\n\n## 실제 주제\n내용\n")

    assert [topic.title for topic in parsed.topics] == ["실제 주제"]
    assert parsed.topics[0].content == "내용"


def test_numbering_is_optional_and_file_order_wins() -> None:
    parsed = parse_notebook("## 제목\nx\n## 12. 둘\ny\n## 3. 셋\nz\n")

    assert [topic.title for topic in parsed.topics] == ["제목", "둘", "셋"]


def test_meta_line_sets_fields_and_is_removed() -> None:
    first, second = parse_notebook(SAMPLE).topics

    assert (first.kind, first.tags, first.difficulty) == (
        "워크플로",
        ["claude-code", "skill", "자동화"],
        1,
    )
    assert (second.kind, second.tags, second.difficulty) == (
        "문제해결",
        ["unicode", "nfc", "nfd"],
        3,
    )
    assert "`태그`" not in first.content
    assert "`태그`" not in second.content


def test_only_first_meta_line_is_consumed() -> None:
    text = "## A\n`유형` 개념 | `태그` a\n\n본문에 `유형` 설명 | `태그` b 라는 말이 있다\n"
    topic = parse_notebook(text).topics[0]

    assert topic.kind == "개념"
    assert topic.tags == ["a"]
    assert topic.content == "본문에 `유형` 설명 | `태그` b 라는 말이 있다"


def test_meta_inside_fence_is_ignored_and_difficulty_is_optional() -> None:
    text = "## A\n```\n`유형` 개념 | `태그` x\n```\n`유형` 개념 | `태그` y\n"
    topic = parse_notebook(text).topics[0]

    assert topic.kind == "개념"
    assert topic.tags == ["y"]
    assert topic.difficulty is None
    assert "`태그` x" in topic.content


def test_meta_line_with_only_type_or_only_tags() -> None:
    only_kind = parse_notebook("## A\n`유형` 설계결정\n본문\n").topics[0]
    only_tags = parse_notebook("## A\n`태그` a, b | `난이도` ★★\n본문\n").topics[0]

    assert (only_kind.kind, only_kind.tags, only_kind.content) == ("설계결정", [], "본문")
    assert (only_tags.kind, only_tags.tags, only_tags.difficulty) == (None, ["a", "b"], 2)


def test_no_h2_falls_back_to_single_topic_without_h1_line() -> None:
    parsed = parse_notebook("# 제목\n\n첫 단락\n\n둘째\n")

    assert parsed.title == "제목"
    assert parsed.summary is None
    assert len(parsed.topics) == 1
    assert parsed.topics[0].title == "제목"
    assert parsed.topics[0].content == "첫 단락\n\n둘째"


@pytest.mark.parametrize("text", ["", "\n \n", "---\ntitle: x\n---\n", "# 제목만\n\n"])
def test_empty_input_raises_400(text: str) -> None:
    with pytest.raises(AppError) as caught:
        parse_notebook(text, "empty.md")
    assert caught.value.status_code == 400


def test_title_fallbacks() -> None:
    assert parse_notebook("# 머리\n## A\nx\n").title == "머리"
    assert parse_notebook("## A\nx\n", "dir/2026-10-27_01.md").title == "2026-10-27_01"
    assert parse_notebook("## A\nx\n").title == "학습장"
    # frontmatter 제목이 비어 있으면 다음 후보로 넘어간다.
    assert parse_notebook('---\ntitle: ""\n---\n# 머리\n## A\nx\n').title == "머리"


def test_frontmatter_without_closing_marker_is_body() -> None:
    parsed = parse_notebook("---\ntitle: x\n## A\nbody\n")

    assert parsed.title == "학습장"
    assert [topic.title for topic in parsed.topics] == ["A"]


def test_leading_horizontal_rule_is_not_frontmatter() -> None:
    parsed = parse_notebook("---\n\n# 제목\n\n본문\n")

    assert parsed.title == "제목"
    assert parsed.topics[0].content.endswith("본문")


def test_crlf_and_bom_are_normalized() -> None:
    parsed = parse_notebook("\ufeff---\r\ntitle: T\r\n---\r\n## A\r\nx\r\ny\r\n")

    assert parsed.title == "T"
    assert parsed.topics[0].content == "x\ny"


def test_long_values_are_truncated_to_column_limits() -> None:
    tags = ", ".join(f"t{index}" for index in range(25))
    text = f"## {'제' * 300}\n`유형` {'k' * 40} | `태그` {tags} | `난이도` {'★' * 7}\n본문\n"
    topic = parse_notebook(text).topics[0]

    assert len(topic.title) == 200
    assert len(topic.kind or "") == 30
    assert len(topic.tags) == 20
    assert topic.difficulty == 5


def test_tags_roundtrip_and_cleanup() -> None:
    assert split_tags(None) == []
    assert split_tags("") == []
    assert split_tags(" a , ,b,a, c ") == ["a", "b", "c"]
    assert join_tags(["a, b", " c ", "a"]) == "a, b, c"
    assert split_tags(join_tags(["x", "y"])) == ["x", "y"]


STUDY_NOTE = (
    "---\ntitle: T\nproject: P\nsession: s\n---\n# T\n\n## 1. 주제\n`유형` 개념 | `태그` a\n본문\n"
)


def test_strict_accepts_study_note_signature() -> None:
    parsed = parse_notebook(STUDY_NOTE, "P_2026-10-28_01.md", strict=True)

    assert (parsed.title, parsed.project, parsed.topics[0].kind) == ("T", "P", "개념")


@pytest.mark.parametrize(
    "text",
    [
        "# 회의록\n\n오늘 할 일\n",
        "## 1장\n내용\n## 2장\n내용\n",
        "---\ntitle: T\n---\n# T\n\n## 1. 주제\n`유형` 개념 | `태그` a\n본문\n",
        "---\nproject: P\n---\n## 1. 주제\n`유형` 개념 | `태그` a\n본문\n",
        "---\ntitle: T\nproject: P\n---\n## 1. 주제\n본문\n",
    ],
)
def test_strict_rejects_files_that_are_not_study_notes(text: str) -> None:
    with pytest.raises(AppError) as caught:
        parse_notebook(text, "x.md", strict=True)
    assert caught.value.status_code == 400
    assert "/study-notes" in getattr(caught.value, "message", str(caught.value))


def test_nul_character_is_rejected_in_any_mode() -> None:
    with pytest.raises(AppError) as caught:
        parse_notebook("PK\x03\x04\x00\x00garbage", "archive.md")
    assert "텍스트(md) 파일만" in getattr(caught.value, "message", str(caught.value))


def test_filename_stem() -> None:
    assert filename_stem("dir/2026-10-27_01.md") == "2026-10-27_01"
    assert filename_stem("C:\\notes\\note.markdown") == "note"
    assert filename_stem("noext") == "noext"
    assert filename_stem("") is None
    assert filename_stem(".md") is None
