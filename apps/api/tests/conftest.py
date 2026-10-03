import pytest
from pytest import MonkeyPatch


def pytest_configure(config: pytest.Config) -> None:
    monkeypatch = MonkeyPatch()
    monkeypatch.setattr("app.settings.ENV_FILE", None)
    for name in [
        "DATABASE_URL",
        "SUPABASE_URL",
        "SUPABASE_JWT_ISSUER",
        "SUPABASE_JWKS_URL",
        "SUPABASE_JWT_AUDIENCE",
        "ALLOWED_ORIGINS",
        "FLIGHT_INSTRUCTOR_CORS_ORIGINS",
        "LOG_LEVEL",
        "FLIGHT_INSTRUCTOR_APP_NAME",
    ]:
        monkeypatch.delenv(name, raising=False)
    config.add_cleanup(monkeypatch.undo)
