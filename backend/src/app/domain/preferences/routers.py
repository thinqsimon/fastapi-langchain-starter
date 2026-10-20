"""preferences 도메인 - 라우터."""

from fastapi import APIRouter

from app.domain.auth.dependencies import CurrentUser, DbSession
from app.domain.preferences.schemas import PreferencesRead, PreferencesUpdate
from app.domain.preferences.services import PreferenceService

router = APIRouter(prefix="/me/preferences", tags=["preferences"])


@router.get("", response_model=PreferencesRead, summary="내 화면 설정")
def read_preferences(current_user: CurrentUser, db: DbSession) -> PreferencesRead:
    """저장한 적이 없으면 기본 캐치프레이즈와 푸터를 돌려줍니다."""
    return PreferenceService(db).get(current_user.id)


@router.put("", response_model=PreferencesRead, summary="내 화면 설정 저장")
def update_preferences(
    payload: PreferencesUpdate, current_user: CurrentUser, db: DbSession
) -> PreferencesRead:
    """빈 값으로 저장하면 그 문구가 보이지 않습니다(푸터는 일기에 붙지 않음)."""
    return PreferenceService(db).update(current_user.id, payload.catchphrase, payload.diary_footer)


@router.delete("", response_model=PreferencesRead, summary="내 화면 설정을 기본값으로")
def reset_preferences(current_user: CurrentUser, db: DbSession) -> PreferencesRead:
    """저장한 값을 지우고 기본 캐치프레이즈와 푸터를 돌려줍니다."""
    return PreferenceService(db).reset(current_user.id)
