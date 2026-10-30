"""COUPON-01: 쿠폰 기간 계산과 코드 정규화."""

from datetime import UTC, datetime

from app.domain.coupon.periods import add_duration
from app.domain.coupon.services import CODE_ALPHABET, format_code, generate_code, normalize_code


def test_day_durations_add_days() -> None:
    start = datetime(2026, 10, 31, 8, 0, tzinfo=UTC)
    assert add_duration(start, "7d") == datetime(2026, 11, 7, 8, 0, tzinfo=UTC)
    assert add_duration(start, "15d") == datetime(2026, 11, 15, 8, 0, tzinfo=UTC)


def test_month_durations_follow_the_calendar_and_clamp_the_day() -> None:
    start = datetime(2026, 10, 31, 8, 0, tzinfo=UTC)
    assert add_duration(start, "1m") == datetime(2026, 11, 30, 8, 0, tzinfo=UTC)
    assert add_duration(start, "3m") == datetime(2027, 1, 31, 8, 0, tzinfo=UTC)
    assert add_duration(start, "6m") == datetime(2027, 4, 30, 8, 0, tzinfo=UTC)
    assert add_duration(start, "12m") == datetime(2027, 10, 31, 8, 0, tzinfo=UTC)
    # 1/31 + 1개월 = 2/28, 윤년이면 2/29
    assert add_duration(datetime(2027, 1, 31, tzinfo=UTC), "1m") == datetime(
        2027, 2, 28, tzinfo=UTC
    )
    assert add_duration(datetime(2028, 1, 31, tzinfo=UTC), "1m") == datetime(
        2028, 2, 29, tzinfo=UTC
    )


def test_codes_avoid_confusing_letters_and_normalize_user_input() -> None:
    code = generate_code()
    assert len(code) == 12 and set(code) <= set(CODE_ALPHABET)
    assert not set("01OI") & set(CODE_ALPHABET)
    assert format_code("ABCDEFGHJKLM") == "ABCD-EFGH-JKLM"
    assert normalize_code(" abcd-efgh jklm ") == "ABCDEFGHJKLM"
