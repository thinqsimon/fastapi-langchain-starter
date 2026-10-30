"""admin 도메인 - 데이터 접근 계층."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.admin.models import LlmProviderSetting


class LlmProviderSettingRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_all(self) -> list[LlmProviderSetting]:
        rows = self.db.execute(
            select(LlmProviderSetting).order_by(LlmProviderSetting.priority)
        ).scalars()
        return list(rows)

    def get(self, provider: str) -> LlmProviderSetting | None:
        return self.db.execute(
            select(LlmProviderSetting).where(LlmProviderSetting.provider == provider)
        ).scalar_one_or_none()

    def create(self, provider: str, model: str, priority: int) -> LlmProviderSetting:
        # 처음 만들 때는 키가 없으니 꺼둔 채로 둔다. 관리자가 키를 넣으면 그때 켤 수 있다.
        row = LlmProviderSetting(provider=provider, model=model, priority=priority, enabled=False)
        self.db.add(row)
        self.db.flush()
        return row

    def clear_forced_except(self, provider: str) -> None:
        """강제 사용은 한 번에 하나만 가능하므로, 새로 켤 공급자를 뺀 나머지를 모두 끈다."""
        rows = self.db.execute(
            select(LlmProviderSetting).where(
                LlmProviderSetting.forced.is_(True),
                LlmProviderSetting.provider != provider,
            )
        ).scalars()
        for row in rows:
            row.forced = False
        self.db.flush()
