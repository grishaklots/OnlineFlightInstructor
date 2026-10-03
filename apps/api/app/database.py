from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import URL, Engine, create_engine, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def parse_database_url(value: str | URL) -> URL:
    url = make_url(value)
    if url.drivername not in {"postgresql", "postgresql+psycopg"}:
        raise ValueError(
            "DATABASE_URL must use postgresql:// or postgresql+psycopg://."
        )
    return url.set(drivername="postgresql+psycopg")


class Database:
    def __init__(self, url: str | URL) -> None:
        self.engine: Engine = create_engine(
            parse_database_url(url), pool_pre_ping=True, hide_parameters=True
        )
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)

    @contextmanager
    def session(self) -> Iterator[Session]:
        with self.session_factory() as session:
            yield session

    def dispose(self) -> None:
        self.engine.dispose()


@contextmanager
def transaction(session: Session) -> Iterator[Session]:
    with session.begin():
        yield session


def get_database(request: Request) -> Database:
    database = request.app.state.database
    if not isinstance(database, Database):
        raise RuntimeError("Configure DATABASE_URL before using database endpoints.")
    return database


def get_session(
    database: Annotated[Database, Depends(get_database)],
) -> Iterator[Session]:
    with database.session() as session:
        yield session
