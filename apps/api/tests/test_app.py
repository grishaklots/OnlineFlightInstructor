from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from app.main import app, create_app


def test_application_starts_and_exposes_openapi() -> None:
    with TestClient(app) as client:
        response = client.get("/openapi.json")

    assert response.status_code == 200
    assert response.json()["info"]["title"] == "Flight Instructor API"
    assert response.json()["paths"] == {}


def test_settings_are_used_by_application_factory(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("FLIGHT_INSTRUCTOR_APP_NAME", "Test API")

    application = create_app()

    assert application.title == "Test API"
    assert application is not app


def test_health_and_product_endpoints_are_not_implemented() -> None:
    with TestClient(app) as client:
        assert client.get("/health").status_code == 404
        assert client.get("/api/students").status_code == 404
