"""BE-01 공통 예외 처리·로깅 검증.

에러 응답 형식이 어떤 경로로든 {"error": {"code", "message"}}로 같은지 확인한다.
"""

import logging

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import ConflictError, NotFoundError, UnauthorizedError
from app.core.middleware import REQUEST_ID_HEADER
from app.main import create_app


@pytest.fixture
def error_client() -> TestClient:
    """일부러 예외를 던지는 임시 라우트를 붙인 클라이언트."""
    app = create_app()

    @app.get("/_test/not-found")
    def raise_not_found() -> None:
        raise NotFoundError("대화를 찾을 수 없습니다.")

    @app.get("/_test/conflict")
    def raise_conflict() -> None:
        raise ConflictError("이미 가입된 이메일입니다.")

    @app.get("/_test/unauthorized")
    def raise_unauthorized() -> None:
        raise UnauthorizedError()

    @app.get("/_test/boom")
    def raise_unexpected() -> None:
        raise ValueError("secret-internal-detail")

    @app.get("/_test/items")
    def read_item(limit: int) -> dict[str, int]:
        return {"limit": limit}

    # 미처리 예외도 응답으로 받아 보기 위해 서버 예외를 다시 던지지 않는다.
    return TestClient(app, raise_server_exceptions=False)


@pytest.mark.parametrize(
    ("path", "status_code", "code", "message"),
    [
        ("/_test/not-found", 404, "NOT_FOUND", "대화를 찾을 수 없습니다."),
        ("/_test/conflict", 409, "CONFLICT", "이미 가입된 이메일입니다."),
        # message를 생략하면 code가 기본 메시지가 된다.
        ("/_test/unauthorized", 401, "UNAUTHORIZED", "UNAUTHORIZED"),
    ],
)
def test_app_error_returns_common_envelope(
    error_client: TestClient, path: str, status_code: int, code: str, message: str
) -> None:
    res = error_client.get(path)

    assert res.status_code == status_code
    assert res.json() == {"error": {"code": code, "message": message}}


def test_unhandled_exception_returns_500_and_hides_internals(
    error_client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.ERROR, logger="app.core.exceptions"):
        res = error_client.get("/_test/boom")

    assert res.status_code == 500
    assert res.json() == {
        "error": {"code": "INTERNAL_ERROR", "message": "서버 내부 오류가 발생했습니다."}
    }
    # 내부 메시지는 응답에 새어 나가지 않는다.
    assert "secret-internal-detail" not in res.text

    # 대신 서버 로그에는 스택 추적이 남는다.
    record = next(r for r in caplog.records if r.message.startswith("unhandled_error"))
    assert record.levelno == logging.ERROR
    assert record.exc_info is not None
    assert "secret-internal-detail" in caplog.text
    assert "ValueError" in caplog.text


def test_validation_error_reports_field(error_client: TestClient) -> None:
    res = error_client.get("/_test/items")  # 필수 쿼리 파라미터 limit 누락

    assert res.status_code == 422
    body = res.json()["error"]
    assert body["code"] == "VALIDATION_ERROR"
    assert [detail["field"] for detail in body["details"]] == ["limit"]
    assert body["details"][0]["message"]


def test_unknown_path_uses_same_envelope(error_client: TestClient) -> None:
    res = error_client.get("/_test/does-not-exist")

    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_request_id_is_returned_and_echoed(error_client: TestClient) -> None:
    generated = error_client.get("/health")
    assert generated.headers[REQUEST_ID_HEADER]

    echoed = error_client.get("/health", headers={REQUEST_ID_HEADER: "trace-me-123"})
    assert echoed.headers[REQUEST_ID_HEADER] == "trace-me-123"


def test_logs_carry_request_id(error_client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="app.access"):
        error_client.get("/health", headers={REQUEST_ID_HEADER: "trace-me-123"})

    record = next(r for r in caplog.records if r.name == "app.access")
    assert record.request_id == "trace-me-123"
    assert "/health -> 200" in record.getMessage()
