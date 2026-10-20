"""배움일기 규칙 단위 검증: 제목 형식, 순번 맞춤, '내일 할 것' 근거 확인, 초안 프롬프트."""

from datetime import date

import pytest

from app.core.exceptions import LLMError
from app.domain.diary.services import align_title_sequence, blank_to_none, format_title
from app.llm.chains.diary import DiaryDraft, draft_diary, keep_grounded_next_plan
from app.llm.prompts.diary_coach import DRAFT_SYSTEM_PROMPT

DAY = date(2026, 10, 20)
MESSAGES = ["오늘은 JWT를 배웠어요. 내일은 리프레시 토큰을 복습할게요.", "좋아요."]


def make_draft(next_plan: str, evidence: str) -> DiaryDraft:
    return DiaryDraft(
        keywords="JWT",
        learned="JWT를 배웠다.",
        learned_detail="### JWT",
        difficult="만료 처리",
        next_plan=next_plan,
        next_plan_evidence=evidence,
    )


def test_title_is_date_and_keywords() -> None:
    assert format_title(DAY, 1, "JWT, 토큰") == "2026-10-20 JWT, 토큰"
    assert format_title(DAY, 2, "JWT") == "2026-10-20(2) JWT"
    assert format_title(DAY, 3, "  ") == "2026-10-20(3)"


@pytest.mark.parametrize(
    ("title", "sequence", "expected"),
    [
        ("2026-10-20 JWT", 2, "2026-10-20(2) JWT"),
        ("2026-10-20(2) JWT", 3, "2026-10-20(3) JWT"),
        ("2026-10-20(3) JWT", 1, "2026-10-20 JWT"),
        ("2026-10-20", 2, "2026-10-20(2)"),
        # 사용자가 날짜를 지우거나 바꾼 제목은 건드리지 않는다.
        ("JWT 정리", 2, "JWT 정리"),
        ("2026-10-19 JWT", 2, "2026-10-19 JWT"),
        ("2026-10-201 JWT", 2, "2026-10-201 JWT"),
    ],
)
def test_title_sequence_is_aligned_on_save(title: str, sequence: int, expected: str) -> None:
    assert align_title_sequence(title, DAY, sequence) == expected


def test_blank_values_become_missing() -> None:
    assert blank_to_none(None) is None
    assert blank_to_none("   ") is None
    assert blank_to_none(" 복습 ") == "복습"


def test_next_plan_quoted_from_chat_is_kept() -> None:
    draft = make_draft("리프레시 토큰 복습", "내일은 리프레시 토큰을 복습할게요.")

    assert keep_grounded_next_plan(draft, MESSAGES).next_plan == "리프레시 토큰 복습"


@pytest.mark.parametrize(
    "evidence",
    [
        "“내일은 리프레시토큰을  복습할게요”",  # 띄어쓰기·따옴표가 달라도
        "교육생: 내일은 리프레시 토큰을 복습할게요.",  # 화자 표시를 붙여 인용해도
    ],
)
def test_quote_with_small_differences_still_counts(evidence: str) -> None:
    draft = make_draft("리프레시 토큰 복습", evidence)

    assert keep_grounded_next_plan(draft, MESSAGES).next_plan == "리프레시 토큰 복습"


@pytest.mark.parametrize(
    "evidence",
    [
        "내일은 React를 공부할게요",  # 대화에 없는 문장(지어낸 계획)
        "",  # 근거 없음
        "내일",  # 너무 짧아 어디에나 있는 말
        "교육생:",  # 화자 표시만 있는 것
        "복습할게요.좋아요.",  # 두 메시지에 걸친 것(한 메시지 안에서 그대로 찾을 수 있어야 한다)
    ],
)
def test_next_plan_without_real_evidence_is_dropped(evidence: str) -> None:
    result = keep_grounded_next_plan(make_draft("React 공부", evidence), MESSAGES)

    assert result.next_plan == ""
    assert result.next_plan_evidence == ""


def test_draft_prompt_states_the_rules() -> None:
    for rule in ("### 소제목", "길이 제한은 없습니다", "보충", "맥락", "빈 문자열", "지어내지"):
        assert rule in DRAFT_SYSTEM_PROMPT


async def test_fake_model_draft_has_no_made_up_next_plan() -> None:
    draft = await draft_diary([("user", "오늘 JWT를 배웠어요")])

    assert draft.next_plan == ""
    assert draft.learned_detail


async def test_model_failure_becomes_llm_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def broken_model() -> None:
        raise RuntimeError("모델 연결 실패")

    monkeypatch.setattr("app.llm.chains.diary.get_chat_model", broken_model)

    with pytest.raises(LLMError):
        await draft_diary([("user", "오늘 JWT를 배웠어요")])
