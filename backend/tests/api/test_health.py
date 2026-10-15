from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_root_describes_the_service(client: TestClient) -> None:
    """배포 환경이 포트 확인용으로 `/`를 호출한다. 404가 아니어야 한다."""
    res = client.get("/")

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["docs"] == "/docs"


def test_readiness_reports_database_ok(api_client: TestClient) -> None:
    """DB까지 확인하는 점검. 무료 플랜에서 DB를 깨우는 용도로도 쓴다."""
    res = api_client.get("/health/ready")

    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "ok"}


def test_readiness_fails_when_database_is_down(api_client: TestClient) -> None:
    """DB가 끊기면 200이 아니라 503이어야 한다(살아 있는 척하면 안 된다)."""
    from sqlalchemy.exc import OperationalError

    from app.core.database import get_db
    from app.main import create_app

    def broken_session():
        class Broken:
            def execute(self, *_args: object, **_kwargs: object) -> None:
                raise OperationalError("select 1", {}, Exception("connection refused"))

        yield Broken()

    app = create_app()
    app.dependency_overrides[get_db] = broken_session

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.get("/health/ready")

    assert res.status_code == 503
    assert res.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
