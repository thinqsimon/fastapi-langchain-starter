"""preferences 도메인 - 비즈니스 로직."""

import uuid

from sqlalchemy.orm import Session

from app.domain.preferences.repositories import PreferenceRepository
from app.domain.preferences.schemas import PreferencesRead

DEFAULT_CATCHPHRASE = "풀스택 화이팅 !!!  절실하게 공부합시다!!! 운영진 분들 강사님 감사합니다."
DEFAULT_DIARY_FOOTER = "감사 합니다."


class PreferenceService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.preferences = PreferenceRepository(db)

    def get(self, user_id: uuid.UUID) -> PreferencesRead:
        """저장한 적이 없으면 기본값을 돌려준다."""
        preference = self.preferences.get(user_id)
        if preference is None:
            return PreferencesRead(
                catchphrase=DEFAULT_CATCHPHRASE, diary_footer=DEFAULT_DIARY_FOOTER
            )
        return PreferencesRead(
            catchphrase=preference.catchphrase, diary_footer=preference.diary_footer
        )

    def update(self, user_id: uuid.UUID, catchphrase: str, diary_footer: str) -> PreferencesRead:
        # 앞뒤 공백은 정리하되, 비우는 것은 허용한다.
        preference = self.preferences.upsert(user_id, catchphrase.strip(), diary_footer.strip())
        self.db.commit()
        return PreferencesRead(
            catchphrase=preference.catchphrase, diary_footer=preference.diary_footer
        )

    def reset(self, user_id: uuid.UUID) -> PreferencesRead:
        """저장한 값을 지워 기본값으로 되돌린다(기본값이 바뀌면 그것을 따라간다)."""
        self.preferences.delete(user_id)
        self.db.commit()
        return self.get(user_id)

    def diary_footer_for(self, user_id: uuid.UUID) -> str | None:
        """일기에 붙일 푸터. 비어 있으면 None(붙이지 않음)."""
        footer = self.get(user_id).diary_footer
        return footer or None
