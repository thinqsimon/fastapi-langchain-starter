"""요청 단위 공통 처리: request_id 발급과 접근 로그."""

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import request_id_var

REQUEST_ID_HEADER = "X-Request-ID"

logger = logging.getLogger("app.access")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """요청마다 request_id를 부여하고, 처리 결과를 한 줄로 남긴다.

    클라이언트가 `X-Request-ID`를 보내면 그 값을 쓰고, 없으면 새로 만든다.
    응답 헤더로 같은 값을 돌려줘 프론트엔드 오류 화면과 서버 로그를 연결할 수 있다.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex[:12]

        # 여기서 설정한 값은 이 요청을 처리하는 동안의 모든 로그에 붙는다.
        # 500 핸들러는 이 미들웨어 바깥에서 돌기 때문에 reset하지 않는다
        # (요청마다 새 컨텍스트가 만들어지므로 값이 섞이지 않는다).
        request_id_var.set(request_id)
        request.state.request_id = request_id

        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            # 응답 생성은 전역 예외 핸들러가 맡고, 여기서는 소요 시간만 남긴다.
            logger.info(
                "%s %s -> 500 (%.1fms)",
                request.method,
                request.url.path,
                (time.perf_counter() - started) * 1000,
            )
            raise

        logger.info(
            "%s %s -> %s (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            (time.perf_counter() - started) * 1000,
        )
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
