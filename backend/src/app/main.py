"""FastAPI 앱 진입점. 실행: `uv run fastapi dev src/app/main.py`"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging
from app.core.middleware import REQUEST_ID_HEADER, RequestContextMiddleware


def create_app() -> FastAPI:
    setup_logging()
    app = FastAPI(title=settings.APP_NAME, version="0.1.0")

    # 미들웨어는 등록 역순으로 실행된다. request_id를 CORS보다 먼저 잡도록 뒤에 등록한다.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[REQUEST_ID_HEADER],
    )
    app.add_middleware(RequestContextMiddleware)

    register_exception_handlers(app)

    @app.get("/", tags=["system"])
    def root() -> dict[str, str]:
        """루트에 무엇이 있는지 알려 준다.

        배포 환경(Render 등)이 포트 확인용으로 `/`를 호출하는데, 라우트가 없으면
        404가 쌓이고 "No open ports detected" 경고가 난다.
        """
        return {
            "service": settings.APP_NAME,
            "status": "ok",
            "docs": "/docs",
            "health": "/health",
        }

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(api_router)
    return app


app = create_app()
