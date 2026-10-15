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
