import pytest
from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from app.database import Database
from app.main import create_app


@pytest.fixture(autouse=True)
def healthy_database(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost:1/unused")
    monkeypatch.setattr(Database, "check_connection", lambda _self: None)


def test_application_starts_and_exposes_openapi() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/openapi.json")

    assert response.status_code == 200
    assert response.json()["info"]["title"] == "Flight Instructor API"
    assert set(response.json()["paths"]) == {"/health", "/api/me"}


def test_settings_are_used_by_application_factory(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("FLIGHT_INSTRUCTOR_APP_NAME", "Test API")

    application = create_app()

    assert application.title == "Test API"
    assert application is not create_app()


def test_health_is_public_and_returns_database_status() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}
    assert response.headers["content-type"] == "application/json"


def test_product_endpoints_are_not_implemented() -> None:
    with TestClient(create_app()) as client:
        assert client.get("/api/students").status_code == 404


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173"])
def test_local_frontend_can_read_health(origin: str) -> None:
    with TestClient(create_app()) as client:
        response = client.get("/health", headers={"Origin": origin})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert "origin" in response.headers["vary"].lower()
    assert "access-control-allow-credentials" not in response.headers


def test_unknown_origin_is_not_granted_cors_access() -> None:
    with TestClient(create_app()) as client:
        response = client.get(
            "/health", headers={"Origin": "https://untrusted.example"}
        )

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_health_get_preflight_succeeds() -> None:
    with TestClient(create_app()) as client:
        response = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-methods"] == "GET"


def test_cors_rejects_unknown_origin_and_non_get_preflights() -> None:
    with TestClient(create_app()) as client:
        for origin, method in [
            ("https://untrusted.example", "GET"),
            ("http://localhost:5173", "POST"),
        ]:
            response = client.options(
                "/health",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": method,
                },
            )
            assert response.status_code == 400


def test_cors_origins_can_be_configured(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("FLIGHT_INSTRUCTOR_CORS_ORIGINS", '["http://localhost:5187"]')
    with TestClient(create_app()) as client:
        custom = client.get("/health", headers={"Origin": "http://localhost:5187"})
        default = client.get("/health", headers={"Origin": "http://localhost:5173"})

    assert custom.headers["access-control-allow-origin"] == "http://localhost:5187"
    assert "access-control-allow-origin" not in default.headers
