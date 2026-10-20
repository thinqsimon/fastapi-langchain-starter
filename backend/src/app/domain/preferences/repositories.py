"""preferences 도메인 - 데이터 접근 계층."""

import uuid

from sqlalchemy.orm import Session

from app.domain.preferences.models import UserPreference


class PreferenceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: uuid.UUID) -> UserPreference | None:
        return self.db.get(UserPreference, user_id)

    def upsert(self, user_id: uuid.UUID, catchphrase: str, diary_footer: str) -> UserPreference:
        preference = self.get(user_id)
        if preference is None:
            preference = UserPreference(
                user_id=user_id, catchphrase=catchphrase, diary_footer=diary_footer
            )
            self.db.add(preference)
        else:
            preference.catchphrase = catchphrase
            preference.diary_footer = diary_footer
        self.db.flush()
        return preference

    def delete(self, user_id: uuid.UUID) -> None:
        preference = self.get(user_id)
        if preference is not None:
            self.db.delete(preference)
            self.db.flush()
