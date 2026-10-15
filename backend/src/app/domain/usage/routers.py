"""usage 도메인 - 라우터."""

from fastapi import APIRouter

from app.domain.auth.dependencies import CurrentUser, DbSession
from app.domain.usage.schemas import UsageSummary
from app.domain.usage.services import UsageService

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("/me", response_model=UsageSummary)
def read_my_usage(current_user: CurrentUser, db: DbSession) -> UsageSummary:
    """내 LLM 토큰 사용량과 추정 비용."""
    return UsageService(db).summary_for_user(current_user.id)
