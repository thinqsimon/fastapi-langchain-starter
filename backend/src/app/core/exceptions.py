"""공통 예외와 전역 핸들러.

서비스 계층은 `HTTPException` 대신 `AppError` 하위 클래스를 던진다.
클라이언트가 받는 에러 응답은 어떤 경우에도 형식이 같다::

    {"error": {"code": "NOT_FOUND", "message": "...", "details": [...]}}

`details`는 값이 있을 때만 포함된다(주로 입력값 검증 실패).
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    """서비스 계층에서 쓰는 예외의 부모. 하위 클래스는 status_code와 code만 바꾼다."""

    status_code = 400
    code = "BAD_REQUEST"

    def __init__(self, message: str = "", details: Any = None) -> None:
        super().__init__(message)
        self.message = message or self.code
        self.details = details


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"


class LLMError(AppError):
    status_code = 502
    code = "LLM_ERROR"


class ServiceUnavailableError(AppError):
    status_code = 503
    code = "SERVICE_UNAVAILABLE"


# FastAPI/Starlette가 직접 올리는 HTTP 에러를 우리 코드 체계로 옮긴다.
_HTTP_STATUS_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "TOO_MANY_REQUESTS",
    503: "SERVICE_UNAVAILABLE",
}


def error_body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    """모든 에러 응답이 공유하는 본문을 만든다."""
    body: dict[str, Any] = {"code": code, "message": message}
    if details:
        body["details"] = details
    return {"error": body}


def register_exception_handlers(app: FastAPI) -> None:
    """앱에 전역 예외 핸들러를 등록한다. `create_app()`에서 한 번 호출한다."""

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        # 예상된 실패이므로 스택 추적 없이 경고로만 남긴다.
        logger.warning(
            "app_error code=%s status=%s path=%s message=%s",
            exc.code,
            exc.status_code,
            request.url.path,
            exc.message,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # loc의 첫 항목은 위치(body/query/path)라 필드명만 남긴다.
        details = [
            {
                "field": ".".join(str(part) for part in err["loc"][1:]) or str(err["loc"][0]),
                "message": err["msg"],
            }
            for err in exc.errors()
        ]
        logger.warning("validation_error path=%s details=%s", request.url.path, details)
        return JSONResponse(
            status_code=422,
            content=error_body("VALIDATION_ERROR", "요청 값이 올바르지 않습니다.", details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _HTTP_STATUS_CODES.get(exc.status_code, "HTTP_ERROR")
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(code, str(exc.detail)),
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        # 예상하지 못한 오류만 스택 추적을 남긴다. 내부 메시지는 클라이언트에 노출하지 않는다.
        logger.exception("unhandled_error path=%s", request.url.path)
        return JSONResponse(
            status_code=500,
            content=error_body("INTERNAL_ERROR", "서버 내부 오류가 발생했습니다."),
        )
