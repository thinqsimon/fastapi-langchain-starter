"""FastAPI 앱 진입점. 실행: `uv run fastapi dev src/app/main.py`"""

import logging
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api import build_api_router
from app.application import resolve_application
from app.core.config import AppProfile, settings
from app.core.database import get_db
from app.core.exceptions import ServiceUnavailableError, register_exception_handlers
from app.core.logging import setup_logging
from app.core.middleware import REQUEST_ID_HEADER, RequestContextMiddleware

# Swagger(/docs)에서 엔드포인트를 묶어 보여줄 설명.
OPENAPI_TAGS = [
    {
        "name": "auth",
        "description": "회원가입·로그인·토큰 재발급. 리프레시 토큰은 한 번 쓰면 폐기됩니다.",
    },
    {"name": "chat", "description": "대화와 메시지. 응답은 SSE로 토큰 단위 전송합니다."},
    {
        "name": "diary",
        "description": "샘플 서비스(배움일기 코치) 전용 API. 새 서비스를 만들 때 참고하세요.",
    },
    {
        "name": "notebook",
        "description": (
            "샘플 서비스 전용. /study-notes로 만든 학습장(마크다운)을 올려 주제별로 관리합니다."
        ),
    },
    {"name": "usage", "description": "내 LLM 토큰 사용량과 추정 비용."},
    {"name": "preferences", "description": "개인 화면 설정(캐치프레이즈, 일기 푸터)."},
    {"name": "system", "description": "상태 확인용."},
]

API_DESCRIPTION = """
FastAPI · PostgreSQL · Next.js · LangChain 기반 **챗봇형 AI 서비스 스타터킷**의 API입니다.

### 인증 방법
1. `POST /api/auth/signup`으로 가입합니다.
2. `POST /api/auth/login`으로 `access_token`을 받습니다.
3. 우측 상단 **Authorize** 버튼에 토큰을 넣으면 보호된 API를 호출할 수 있습니다.
4. 토큰이 만료되면 `POST /api/auth/refresh`로 새로 받습니다(기존 리프레시 토큰은 폐기됩니다).

### 에러 형식
모든 실패 응답은 형식이 같습니다.

```json
{"error": {"code": "NOT_FOUND", "message": "대화를 찾을 수 없습니다."}}
```

응답 헤더의 `X-Request-ID`와 같은 값이 서버 로그에 찍히므로, 문제를 신고할 때 함께 알려주세요.
"""


logger = logging.getLogger(__name__)


def create_app(rag_enabled: bool | None = None, app_profile: AppProfile | None = None) -> FastAPI:
    setup_logging()
    application = resolve_application(app_profile or settings.APP_PROFILE)
    app_name = settings.APP_NAME or application.name
    app = FastAPI(
        title=app_name,
        version="0.1.0",
        description=API_DESCRIPTION,
        openapi_tags=[
            tag
            for tag in OPENAPI_TAGS
            if application.diary_enabled or tag["name"] not in {"diary", "preferences", "notebook"}
        ],
        swagger_ui_parameters={"docExpansion": "none", "persistAuthorization": True},
    )
    app.state.application_profile = application.profile
    app.state.chat_system_prompt = application.system_prompt

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
            "service": app_name,
            "status": "ok",
            "docs": "/docs",
            "health": "/health",
        }

    @app.get(
        "/health",
        tags=["system"],
        summary="서버가 살아 있는지",
        description="DB를 건드리지 않습니다. 배포 플랫폼의 health check용입니다.",
    )
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get(
        "/health/ready",
        tags=["system"],
        summary="요청을 처리할 준비가 됐는지(DB 포함)",
        description=(
            "DB까지 확인합니다. DB가 끊기면 503을 돌려줍니다.\n\n"
            "무료 플랜에서 주기적으로 깨우는 용도로도 씁니다. `/health`만 호출하면 "
            "서버는 깨어 있어도 **DB는 유휴로 판단되어 일시정지될 수 있습니다**."
        ),
        responses={503: {"description": "DB에 연결할 수 없음"}},
    )
    def readiness(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
        try:
            db.execute(text("select 1"))
        except SQLAlchemyError:
            logger.exception("readiness_check_failed")
            raise ServiceUnavailableError("데이터베이스에 연결할 수 없습니다.") from None

        return {"status": "ok", "database": "ok"}

    app.include_router(build_api_router(rag_enabled, application.profile))
    return app


app = create_app()
