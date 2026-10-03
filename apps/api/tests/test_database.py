from io import StringIO
from pathlib import Path
from typing import Annotated
from unittest.mock import Mock

import pytest
from alembic import command
from alembic.config import Config
from fastapi import Depends
from fastapi.testclient import TestClient
from pytest import MonkeyPatch
from sqlalchemy import URL
from sqlalchemy.orm import Session

from app.database import Database, get_session, parse_database_url
from app.main import create_app
from app.settings import Settings


@pytest.mark.parametrize("scheme", ["postgresql", "postgresql+psycopg"])
def test_postgresql_url_uses_psycopg_and_preserves_options(scheme: str) -> None:
    original = URL.create(
        scheme,
        username="test",
        password="test-only%:@/password",
        host="localhost",
        port=5432,
        database="test",
        query={"sslmode": "require"},
    )
    normalized = parse_database_url(original)

    assert normalized == original.set(drivername="postgresql+psycopg")
    assert parse_database_url(original.render_as_string(hide_password=False)) == (
        normalized
    )


@pytest.mark.parametrize(
    "url",
    ["sqlite://", "mysql://localhost/test", "postgresql+asyncpg://localhost/test"],
)
def test_other_databases_and_drivers_are_rejected(url: str) -> None:
    with pytest.raises(ValueError, match="DATABASE_URL must use postgresql"):
        Database(url)


def test_database_url_is_optional_and_redacted(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert Settings().database_url is None
    url = "postgresql://localhost/test"
    monkeypatch.setenv("DATABASE_URL", url)
    settings = Settings()

    assert settings.database_url is not None
    assert settings.database_url.get_secret_value() == url
    assert url not in repr(settings)


@pytest.mark.parametrize("fail", [False, True])
def test_session_scope_always_closes(monkeypatch: MonkeyPatch, fail: bool) -> None:
    database = Database("postgresql://localhost/unused")
    session = Session()
    close = Mock(wraps=session.close)
    monkeypatch.setattr(session, "close", close)
    monkeypatch.setattr(database, "session_factory", Mock(return_value=session))

    def use_session() -> None:
        with database.session() as scoped:
            assert scoped is session
            if fail:
                raise RuntimeError("Scope failed")

    try:
        if fail:
            with pytest.raises(RuntimeError, match="Scope failed"):
                use_session()
        else:
            use_session()
        close.assert_called_once_with()
    finally:
        database.dispose()


@pytest.mark.parametrize("fail", [False, True])
def test_request_session_closes_and_shutdown_disposes_engine(
    monkeypatch: MonkeyPatch, fail: bool
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost:1/unused")
    application = create_app()

    @application.get("/test-session")
    def session_endpoint(
        session: Annotated[Session, Depends(get_session)],
    ) -> dict[str, bool]:
        assert isinstance(session, Session)
        if fail:
            raise RuntimeError("Request failed")
        return {"ok": True}

    with TestClient(application) as client:
        database = application.state.database
        assert isinstance(database, Database)
        session = Session()
        close = Mock(wraps=session.close)
        dispose = Mock(wraps=database.dispose)
        monkeypatch.setattr(session, "close", close)
        monkeypatch.setattr(database, "session_factory", Mock(return_value=session))
        monkeypatch.setattr(database, "dispose", dispose)

        if fail:
            with pytest.raises(RuntimeError, match="Request failed"):
                client.get("/test-session")
        else:
            assert client.get("/test-session").json() == {"ok": True}
        close.assert_called_once_with()
        dispose.assert_not_called()

    dispose.assert_called_once_with()
    assert application.state.database is None


def test_health_does_not_connect_to_configured_database(
    monkeypatch: MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost:1/unused")
    with TestClient(create_app()) as client:
        assert client.get("/health").json() == {"status": "ok"}


def test_database_dependency_requires_configuration(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    application = create_app()

    @application.get("/test-session")
    def session_endpoint(
        session: Annotated[Session, Depends(get_session)],
    ) -> dict[str, bool]:
        return {"ok": True}

    with TestClient(application) as client:
        with pytest.raises(RuntimeError, match="Configure DATABASE_URL"):
            client.get("/test-session")


def test_migrations_require_database_configuration(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))

    with pytest.raises(RuntimeError, match="Set DATABASE_URL"):
        command.upgrade(config, "head", sql=True)


def test_offline_migrations_accept_encoded_urls_without_exposing_them(
    monkeypatch: MonkeyPatch,
) -> None:
    url = URL.create(
        "postgresql",
        username="test",
        password="test-only%:@/password",
        host="localhost",
        port=1,
        database="unused",
    ).render_as_string(hide_password=False)
    monkeypatch.setenv("DATABASE_URL", url)
    output = StringIO()
    config = Config(
        str(Path(__file__).resolve().parents[1] / "alembic.ini"),
        output_buffer=output,
    )

    command.upgrade(config, "head", sql=True)

    assert "CREATE TABLE alembic_version" in output.getvalue()
    assert "INSERT INTO alembic_version" in output.getvalue()
    assert url not in output.getvalue()
    assert "test-only" not in output.getvalue()
