"""도메인 라우터 등록 지점. 새 도메인을 만들면 여기에 include_router를 추가한다."""

from fastapi import APIRouter

from app.application import resolve_application
from app.core.config import AppProfile, settings
from app.domain.admin.routers import router as admin_router
from app.domain.auth.routers import router as auth_router
from app.domain.chat.routers import router as chat_router
from app.domain.coupon.routers import admin_router as coupon_admin_router
from app.domain.coupon.routers import router as coupon_router
from app.domain.usage.routers import router as usage_router


def build_api_router(
    rag_enabled: bool | None = None, app_profile: AppProfile | None = None
) -> APIRouter:
    """`/api` 아래 라우터를 구성한다.

    선택 기능은 **호출 시점에** 판단한다. import 시점에 정하면 설정을 바꿔도 반영되지 않아
    테스트나 기능 토글이 어려워진다.
    """
    router = APIRouter(prefix="/api")
    router.include_router(auth_router)
    router.include_router(chat_router)
    router.include_router(usage_router)
    router.include_router(admin_router)
    router.include_router(coupon_router)
    router.include_router(coupon_admin_router)

    application = resolve_application(app_profile or settings.APP_PROFILE)
    if application.diary_enabled:
        # 스타터킷 실행 시 일기 서비스와 전용 개인 설정을 불러오지 않는다.
        from app.domain.diary.routers import router as diary_router
        from app.domain.notebook.routers import router as notebook_router
        from app.domain.preferences.routers import router as preferences_router

        router.include_router(diary_router)
        router.include_router(preferences_router)
        router.include_router(notebook_router)

    enabled = settings.RAG_ENABLED if rag_enabled is None else rag_enabled
    if enabled:
        # 꺼져 있으면 API가 등록되지 않아 /docs에도 보이지 않는다.
        from app.domain.rag.routers import router as rag_router

        router.include_router(rag_router)

    return router
