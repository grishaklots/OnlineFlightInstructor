import os
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from pytest import MonkeyPatch
from sqlalchemy import Column, Integer, MetaData, Table, func, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import QueuePool

from app.database import Database, transaction

pytestmark = pytest.mark.postgresql


@pytest.fixture(scope="module")
def database() -> Iterator[Database]:
    url = os.environ.get("TEST_DATABASE_URL")
    if url is None:
        pytest.skip("Set TEST_DATABASE_URL to an empty disposable PostgreSQL database.")
    instance = Database(url)
    try:
        assert inspect(instance.engine).get_table_names() == [], (
            "TEST_DATABASE_URL must point to an empty disposable database."
        )
        yield instance
    finally:
        instance.dispose()


@pytest.fixture
def probe_table(database: Database) -> Iterator[Table]:
    table = Table(
        f"task13_probe_{uuid4().hex}",
        MetaData(),
        Column("id", Integer, primary_key=True),
    )
    table.create(database.engine)
    try:
        yield table
    finally:
        table.drop(database.engine)


def assert_connections_returned(database: Database) -> None:
    pool = database.engine.pool
    assert isinstance(pool, QueuePool)
    assert pool.checkedout() == 0


def test_migrations_upgrade_downgrade_and_reapply(
    database: Database, monkeypatch: MonkeyPatch
) -> None:
    monkeypatch.setenv(
        "DATABASE_URL", database.engine.url.render_as_string(hide_password=False)
    )
    config_path = Path(__file__).resolve().parents[1] / "alembic.ini"
    config = Config(str(config_path))
    head = ScriptDirectory.from_config(config).get_current_head()
    assert head is not None

    try:
        for _ in range(2):
            command.upgrade(config, "head")
            with database.engine.connect() as connection:
                assert (
                    MigrationContext.configure(connection).get_current_revision()
                    == head
                )
            assert inspect(database.engine).get_table_names() == ["alembic_version"]
            command.check(config)

            command.downgrade(config, "base")
            with database.engine.connect() as connection:
                assert (
                    MigrationContext.configure(connection).get_current_revision()
                    is None
                )
        assert_connections_returned(database)
    finally:
        Table("alembic_version", MetaData()).drop(database.engine, checkfirst=True)


def test_transaction_commits_and_returns_connection(
    database: Database, probe_table: Table
) -> None:
    with database.session() as session, transaction(session):
        session.execute(probe_table.insert().values(id=1))

    assert_connections_returned(database)
    with database.engine.connect() as connection:
        assert connection.execute(select(probe_table.c.id)).scalar_one() == 1


def test_transaction_rolls_back_on_application_exception(
    database: Database, probe_table: Table
) -> None:
    with pytest.raises(RuntimeError, match="Write failed"):
        with database.session() as session, transaction(session):
            session.execute(probe_table.insert().values(id=1))
            raise RuntimeError("Write failed")

    assert_connections_returned(database)
    with database.engine.connect() as connection:
        assert (
            connection.execute(
                select(func.count()).select_from(probe_table)
            ).scalar_one()
            == 0
        )


def test_database_error_rolls_back_and_session_can_be_reused(
    database: Database, probe_table: Table
) -> None:
    with database.session() as session:
        with pytest.raises(IntegrityError):
            with transaction(session):
                session.execute(probe_table.insert().values(id=1))
                session.execute(probe_table.insert().values(id=1))

        assert not session.in_transaction()
        with transaction(session):
            session.execute(probe_table.insert().values(id=2))

    assert_connections_returned(database)
    with database.engine.connect() as connection:
        assert connection.execute(select(probe_table.c.id)).scalars().all() == [2]


@pytest.mark.parametrize("fail", [False, True])
def test_uncommitted_session_is_rolled_back_on_close(
    database: Database, probe_table: Table, fail: bool
) -> None:
    def use_session() -> None:
        with database.session() as session:
            session.execute(probe_table.insert().values(id=1))
            if fail:
                raise RuntimeError("Scope failed")

    if fail:
        with pytest.raises(RuntimeError, match="Scope failed"):
            use_session()
    else:
        use_session()

    assert_connections_returned(database)
    with database.engine.connect() as connection:
        assert (
            connection.execute(
                select(func.count()).select_from(probe_table)
            ).scalar_one()
            == 0
        )
