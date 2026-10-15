"""usage 도메인 - 라우터."""

from fastapi import APIRouter

from app.domain.auth.dependencies import CurrentUser, DbSession
from app.domain.usage.schemas import UsageSummary
from app.domain.usage.services import UsageService

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get(
    "/me",
    response_model=UsageSummary,
    summary="내 토큰 사용량과 추정 비용",
    description="비용은 추정치입니다. 단가는 `.env`의 `LLM_PRICE_*`로 바꿀 수 있습니다.",
)
def read_my_usage(current_user: CurrentUser, db: DbSession) -> UsageSummary:
    """내 LLM 토큰 사용량과 추정 비용."""
    return UsageService(db).summary_for_user(current_user.id)
