"""coupon 도메인 - 모델 계층.

쿠폰 한 장 = 코드 하나 = 1회 사용. 상태(미사용/사용됨/만료/취소)는 컬럼으로 두지 않고
redeemed_at·revoked_at·expires_at에서 계산한다(두 값이 어긋날 일이 없게).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class Coupon(Base, TimestampMixin):
    __tablename__ = "coupons"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    # 하이픈 없는 대문자 12자. 화면에는 XXXX-XXXX-XXXX로 보여 준다.
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    # 적용할 요금제(pro/max)와 기간(7d/15d/1m/3m/6m/12m). 기간은 등록한 날부터 센다.
    plan: Mapped[str] = mapped_column(String(16), nullable=False)
    duration: Mapped[str] = mapped_column(String(8), nullable=False)
    # 이 시각까지 등록해야 한다. 지나면 미사용 쿠폰은 만료다.
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    memo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # 같은 발급 요청으로 만든 쿠폰 묶음(화면의 "모두 복사"용).
    batch_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    redeemed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 등록 결과 요금제가 언제까지 적용됐는지(기록용).
    plan_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
