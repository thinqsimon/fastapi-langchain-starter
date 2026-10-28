"""notebook 도메인 - 마크다운 학습 노트 파서.

/study-notes 스킬이 만드는 노트 형식을 기준으로 하되 일반 마크다운도 받아들인다.

- 1행이 ``---`` 이고 닫는 ``---`` 까지 전부 ``key: value`` (또는 빈 줄)이면 frontmatter로 읽는다
- 코드 펜스(``` 또는 ~~~) 안은 전부 본문이다. 펜스 밖의 ``## 제목`` 이 주제 경계다
- ``## 목차`` 는 주제가 아니다. ``## 1. 제목`` 의 번호는 있어도 되고 없어도 되며 순서는 등장 순이다
- 주제 안의 `` `유형` … | `태그` … | `난이도` ★★☆ `` 메타 줄은 필드로 읽고 본문에서 뺀다
- 주제가 하나도 없으면 본문 전체가 주제 하나가 된다. 저장할 내용이 없으면 AppError(400)
- ``strict=True`` 면 /study-notes 노트의 서명이 없을 때 AppError(400). 업로드 API가 쓴다.
  서명 = frontmatter title·project, ``## 주제`` 1개 이상, ``유형``/``태그`` 메타 줄 1개 이상
- NUL 문자가 섞인 내용은 모드와 무관하게 거부한다
- 닫는 펜스는 여는 펜스와 같은 문자로 같거나 더 긴 길이여야 한다(CommonMark).
  닫히지 않은 펜스는 파일 끝까지 본문이다
"""

import re
from collections.abc import Iterable
from dataclasses import dataclass, field

from app.core.exceptions import AppError

TOPIC_HEADING = re.compile(r"^## (?:\d+\.\s*)?(.+?)\s*$")
H1_LINE = re.compile(r"^#\s+(.+?)\s*$")
FENCE_LINE = re.compile(r"^\s{0,3}(`{3,}|~{3,})(.*)$")
FRONTMATTER_LINE = re.compile(r"^([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*$")
KIND_FIELD = re.compile(r"`유형`\s*([^|]*?)\s*(?:\||$)")
TAGS_FIELD = re.compile(r"`태그`\s*([^|]*?)\s*(?:\||$)")
DIFFICULTY_FIELD = re.compile(r"`난이도`\s*(★+)")

TOC_TITLE = "목차"
DEFAULT_TITLE = "학습장"
EMPTY_MESSAGE = "학습장에 저장할 내용이 없습니다."
NOT_STUDY_NOTE_MESSAGE = (
    "/study-notes로 만든 학습 노트(md)만 올릴 수 있습니다. "
    "frontmatter의 title·project와 `## 주제`, `유형`/`태그` 메타 줄이 필요합니다."
)
BINARY_MESSAGE = "텍스트(md) 파일만 올릴 수 있습니다. 이미지·압축 파일은 올릴 수 없습니다."
MAX_TITLE = 200
MAX_KIND = 30
MAX_PROJECT = 100
MAX_TAGS = 20
MAX_TAG = 50
MAX_DIFFICULTY = 5


@dataclass
class ParsedTopic:
    title: str
    content: str = ""
    kind: str | None = None
    tags: list[str] = field(default_factory=list)
    difficulty: int | None = None


@dataclass
class ParsedNotebook:
    title: str
    project: str | None
    summary: str | None
    topics: list[ParsedTopic]


def split_tags(value: str | None) -> list[str]:
    """쉼표로 나누고 공백·빈 값·중복을 없앤다. 저장(쉼표 결합)과 API(list) 사이의 공통 규칙."""
    if not value:
        return []
    tags: list[str] = []
    for raw in value.split(","):
        tag = raw.strip()[:MAX_TAG]
        if tag and tag not in tags:
            tags.append(tag)
            if len(tags) >= MAX_TAGS:
                break
    return tags


def join_tags(tags: Iterable[str]) -> str:
    """태그 목록을 저장용 문자열로. 태그 안의 쉼표도 구분자로 취급해 저장 형식이 깨지지 않는다."""
    return ", ".join(split_tags(",".join(tags)))


def filename_stem(filename: str | None) -> str | None:
    """경로와 확장자를 뺀 파일 이름. 제목이 없는 파일의 제목으로 쓴다."""
    if not filename:
        return None
    name = filename.replace("\\", "/").rsplit("/", 1)[-1].strip()
    stem = name.rsplit(".", 1)[0] if "." in name else name
    return stem.strip() or None


def parse_notebook(
    text: str, filename: str | None = None, *, strict: bool = False
) -> ParsedNotebook:
    if "\x00" in text:
        # PostgreSQL은 텍스트에 NUL을 허용하지 않는다. 이미지·압축 파일을 올린 경우다.
        raise AppError(BINARY_MESSAGE)
    normalized = text.lstrip("﻿").replace("\r\n", "\n").replace("\r", "\n")
    if not normalized.strip():
        raise AppError(EMPTY_MESSAGE)
    meta, body = _split_frontmatter(normalized.split("\n"))
    segments = _split_segments(body)
    heading, summary, preamble = _parse_preamble(segments[0][1])

    topics: list[ParsedTopic] = []
    for title, lines in segments[1:]:
        if title is None or title == TOC_TITLE:
            continue
        content_lines, kind, tags, difficulty = _extract_meta(lines)
        topics.append(
            ParsedTopic(
                title=title[:MAX_TITLE],
                content=_trim(content_lines),
                kind=kind,
                tags=tags,
                difficulty=difficulty,
            )
        )

    if strict:
        _require_study_note(meta, topics)

    title = (meta.get("title") or heading or filename_stem(filename) or DEFAULT_TITLE)[:MAX_TITLE]
    if not topics:
        # 주제 구분이 없는 평범한 마크다운: 제목만 떼고 전체를 주제 하나로
        content = _trim(preamble)
        if not content:
            raise AppError(EMPTY_MESSAGE)
        topics = [ParsedTopic(title=title, content=content)]
    project = meta.get("project", "")[:MAX_PROJECT] or None
    return ParsedNotebook(title=title, project=project, summary=summary, topics=topics)


def _require_study_note(meta: dict[str, str], topics: list[ParsedTopic]) -> None:
    """/study-notes 노트의 서명을 요구한다. 회의록·txt·json 같은 일반 파일을 거른다."""
    if not meta.get("title") or not meta.get("project"):
        raise AppError(NOT_STUDY_NOTE_MESSAGE)
    if not topics or not any(topic.kind or topic.tags for topic in topics):
        raise AppError(NOT_STUDY_NOTE_MESSAGE)


def _split_frontmatter(lines: list[str]) -> tuple[dict[str, str], list[str]]:
    """1행이 ---이고 닫는 ---까지 모두 key: value(또는 빈 줄)일 때만 frontmatter로 본다.

    본문이 가로줄(---)로 시작하는 평범한 문서를 frontmatter로 오인하지 않기 위한 조건이다.
    """
    if not lines or lines[0].strip() != "---":
        return {}, lines
    meta: dict[str, str] = {}
    for index in range(1, len(lines)):
        line = lines[index]
        if line.strip() == "---":
            return meta, lines[index + 1 :]
        if not line.strip():
            continue
        match = FRONTMATTER_LINE.match(line)
        if match is None:
            break
        meta[match.group(1).lower()] = _unquote(match.group(2))
    return {}, lines


def _fence(line: str, open_marker: str | None) -> tuple[bool, str | None]:
    """펜스를 여닫는 줄이면 (True, 새 상태)를 돌려준다.

    펜스 안에서는 여는 펜스와 같은 문자로 같거나 더 긴 길이의 줄만 닫는다.
    그래서 ```` 안의 ```는 본문이다.
    """
    match = FENCE_LINE.match(line)
    if match is None:
        return False, open_marker
    marker, rest = match.group(1), match.group(2)
    if open_marker is None:
        return True, marker
    if marker[0] == open_marker[0] and len(marker) >= len(open_marker) and not rest.strip():
        return True, None
    return False, open_marker


def _unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def _split_segments(lines: list[str]) -> list[tuple[str | None, list[str]]]:
    """펜스 밖의 ## 제목마다 새 구간을 연다. 첫 구간(None)은 제목 앞 머리말이다."""
    segments: list[tuple[str | None, list[str]]] = [(None, [])]
    fence: str | None = None
    for line in lines:
        toggled, fence = _fence(line, fence)
        if not toggled and fence is None:
            match = TOPIC_HEADING.match(line)
            if match is not None:
                segments.append((match.group(1).strip(), []))
                continue
        segments[-1][1].append(line)
    return segments


def _parse_preamble(lines: list[str]) -> tuple[str | None, str | None, list[str]]:
    """머리말에서 H1 제목과 바로 뒤의 인용(>) 요약을 읽는다. 돌려주는 본문에는 H1이 없다."""
    found = _find_heading(lines)
    if found is None:
        return None, None, list(lines)
    index, heading = found
    summary = _blockquote_after(lines, index + 1)
    return heading, summary, lines[:index] + lines[index + 1 :]


def _find_heading(lines: list[str]) -> tuple[int, str] | None:
    fence: str | None = None
    for index, line in enumerate(lines):
        toggled, fence = _fence(line, fence)
        if toggled or fence is not None:
            continue
        match = H1_LINE.match(line)
        if match is not None:
            return index, match.group(1).strip()
    return None


def _blockquote_after(lines: list[str], start: int) -> str | None:
    """빈 줄을 건너뛴 뒤 이어지는 `>` 줄들을 요약으로 모은다."""
    index = start
    while index < len(lines) and not lines[index].strip():
        index += 1
    quoted: list[str] = []
    while index < len(lines) and lines[index].lstrip().startswith(">"):
        quoted.append(lines[index].lstrip()[1:].strip())
        index += 1
    summary = "\n".join(part for part in quoted if part)
    return summary or None


def _extract_meta(lines: list[str]) -> tuple[list[str], str | None, list[str], int | None]:
    """주제 안의 첫 메타 줄(펜스 밖)에서 유형·태그·난이도를 읽고 그 줄을 뺀다."""
    fence: str | None = None
    for index, line in enumerate(lines):
        toggled, fence = _fence(line, fence)
        if toggled or fence is not None:
            continue
        if "`유형`" not in line and "`태그`" not in line:
            continue
        kind_match = KIND_FIELD.search(line)
        tags_match = TAGS_FIELD.search(line)
        stars = DIFFICULTY_FIELD.search(line)
        kind = kind_match.group(1).strip()[:MAX_KIND] if kind_match else ""
        tags = split_tags(tags_match.group(1)) if tags_match else []
        difficulty = min(len(stars.group(1)), MAX_DIFFICULTY) if stars else None
        return lines[:index] + lines[index + 1 :], kind or None, tags, difficulty
    return list(lines), None, [], None


def _trim(lines: list[str]) -> str:
    """앞뒤 빈 줄과 끝의 --- 구분선을 걷어낸다."""
    start, end = 0, len(lines)
    while start < end and not lines[start].strip():
        start += 1
    while end > start and lines[end - 1].strip() in {"", "---"}:
        end -= 1
    return "\n".join(lines[start:end])
