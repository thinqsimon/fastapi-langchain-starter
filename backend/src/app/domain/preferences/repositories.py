"""preferences 도메인 - 데이터 접근 계층."""

import uuid

from sqlalchemy.orm import Session

from app.domain.preferences.models import AnswerPreference, UserPreference


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


class AnswerPreferenceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: uuid.UUID) -> AnswerPreference | None:
        return self.db.get(AnswerPreference, user_id)

    def upsert(self, user_id: uuid.UUID, suggest_questions: bool) -> AnswerPreference:
        preference = self.get(user_id)
        if preference is None:
            preference = AnswerPreference(user_id=user_id, suggest_questions=suggest_questions)
            self.db.add(preference)
        else:
            preference.suggest_questions = suggest_questions
        self.db.flush()
        return preference
