"""쿠폰 기간 계산. 요금제 적용 기간(7일~12개월)과 쿠폰 등록 기한(7~90일)."""

import calendar
from datetime import UTC, datetime, timedelta
from typing import Literal

CouponDuration = Literal["7d", "15d", "1m", "3m", "6m", "12m"]
DURATIONS: tuple[CouponDuration, ...] = ("7d", "15d", "1m", "3m", "6m", "12m")
DURATION_LABELS: dict[str, str] = {
    "7d": "7일",
    "15d": "15일",
    "1m": "1개월",
    "3m": "3개월",
    "6m": "6개월",
    "12m": "12개월",
}

# 발급 뒤 며칠 안에 등록해야 하는지. 기본 30일.
ValidDays = Literal[7, 14, 30, 90]
DEFAULT_VALID_DAYS: ValidDays = 30


def utcnow() -> datetime:
    """테스트가 시간을 바꿀 수 있게 한 곳에서 꺼낸다."""
    return datetime.now(UTC)


def add_duration(start: datetime, duration: str) -> datetime:
    """start에 쿠폰 기간을 더한다. 개월은 달력 기준이라 1/31 + 1개월 = 2/28(윤년 2/29)."""
    if duration.endswith("d"):
        return start + timedelta(days=int(duration[:-1]))
    months = int(duration[:-1])
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return start.replace(year=year, month=month, day=day)
