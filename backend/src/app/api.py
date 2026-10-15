"""도메인 라우터 등록 지점. 새 도메인을 만들면 여기에 include_router를 추가한다."""

from fastapi import APIRouter

api_router = APIRouter(prefix="/api")

# 예) from app.domain.auth.routers import router as auth_router
#     api_router.include_router(auth_router)
