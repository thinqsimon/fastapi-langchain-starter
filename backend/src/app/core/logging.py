"""로깅 설정. 모든 모듈은 `logging.getLogger(__name__)`만 사용한다.

요청마다 발급한 request_id를 모든 로그 줄에 붙여, 하나의 요청에서 나온 로그를 모아 볼 수 있게 한다.
request_id는 `RequestContextMiddleware`가 설정한다.
"""

import logging
import sys
from contextvars import ContextVar

from app.core.config import settings

# 요청 단위 식별자. 요청 밖(기동 로그 등)에서는 "-"
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

LOG_FORMAT = "%(asctime)s %(levelname)-7s [%(name)s] [%(request_id)s] %(message)s"

# 이 핸들러만 교체 대상으로 삼는다(pytest caplog 등 외부 핸들러는 건드리지 않는다).
_HANDLER_NAME = "app-stdout"


class RequestIdFilter(logging.Filter):
    """모든 로그 레코드에 request_id 속성을 채워 넣는다."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def setup_logging() -> None:
    """루트 로거에 표준 출력 핸들러를 붙인다. 여러 번 호출해도 핸들러가 중복되지 않는다."""
    root = logging.getLogger()
    root.setLevel(settings.LOG_LEVEL)

    for existing in list(root.handlers):
        if getattr(existing, "name", None) == _HANDLER_NAME:
            root.removeHandler(existing)

    handler = logging.StreamHandler(sys.stdout)
    handler.name = _HANDLER_NAME
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    handler.addFilter(RequestIdFilter())
    root.addHandler(handler)

    # uvicorn이 자체 핸들러로 같은 줄을 한 번 더 찍지 않도록 루트로 위임시킨다.
    for name in ("uvicorn", "uvicorn.error"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = []
        uvicorn_logger.propagate = True

    # 접근 로그는 RequestContextMiddleware가 남긴다.
    # uvicorn 쪽을 끄지 않으면 같은 요청이 두 줄로 찍힌다.
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.handlers = []
    access_logger.propagate = False
