# Backend

FastAPI with Pydantic Settings, Uvicorn, SQLAlchemy 2, psycopg 3, Alembic,
Pytest, Ruff, and strict mypy checks.
`app.main:create_app` creates the application; `app.main:app` is the ASGI entry
point. Task 1.2 adds public `GET /health` and explicit local-development CORS.
Task 1.3 adds the PostgreSQL persistence foundation and a reversible, empty
migration baseline. There are no application tables, authentication, or product
endpoints yet. Health remains a process check and does not connect to a database.

From this directory, create `.venv`, install `requirements-dev.txt`, install the
editable package, and run Uvicorn using the commands in the repository README.

## Local configuration template

Task 2.1 provides `.env.example` with empty project/credential values and public
development defaults. Copy it to ignored `.env` without overwriting an existing
file, then populate it locally from the existing development Supabase project.
Do not paste actual values into chat, commit them, or place backend secrets in
the frontend. Keep database passwords URL-encoded in `DATABASE_URL`.

The template prepares the later tasks; it does not implement Supabase clients,
JWT verification, or database connectivity checks. Settings/Alembic still read
process environment variables, not `.env` automatically. Do not load the blank
template: an empty `DATABASE_URL` is not a usable connection URL.
`SUPABASE_*`, `ALLOWED_ORIGINS`, and `LOG_LEVEL` are not consumed yet. Current CORS
overrides still use `FLIGHT_INSTRUCTOR_CORS_ORIGINS`; the template does not change
that behavior. See the repository README for the owner configuration checklist.

## PostgreSQL configuration and migrations

Set `DATABASE_URL` in the terminal running the API or Alembic. This unprefixed
variable is optional for the current health-only application and required for
migrations or any use of the database dependency. It accepts `postgresql://` or
`postgresql+psycopg://`; both use psycopg 3. Other databases/drivers are rejected.
Use URL-encoded credentials and the PostgreSQL server's required TLS options.
Actual values must stay out of Git and chat. `.env` files are not loaded yet.

From `apps\api`, with a PostgreSQL database available, replace placeholders
locally and run:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://<user>:<url-encoded-password>@<host>:<port>/<database>"
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
```

To check rollback/reapplication on a disposable database:

```powershell
.\.venv\Scripts\python.exe -m alembic downgrade base
.\.venv\Scripts\python.exe -m alembic upgrade head
```

The baseline revision is `4f55231a11a9`. Upgrade creates Alembic's version table
and records the revision; it deliberately creates no application tables.
Downgrade returns the database to an unversioned state, leaving the empty version
table. Application schemas belong to later tasks. Never roll back a shared or
production database just to test this setup.

Alembic reads the environment directly, not a URL in `alembic.ini`, so encoded
passwords are not subject to INI interpolation and no credential is tracked.
`upgrade head --sql` generates offline SQL without connecting. Migrations run
explicitly through the CLI, never automatically during API startup.

## Session and transaction lifecycle

Use **synchronous SQLAlchemy 2 with psycopg 3**. This is the simpler fit for the
MVP's short database operations and transactional allocation; async persistence
does not currently justify separate engines, session APIs, and migration
adapters. Keep database-consuming routes/dependencies synchronous (`def`) so
FastAPI runs them in its thread pool rather than blocking the async event loop.

`app.database.Base` is the shared declarative base for later models.
The FastAPI lifespan creates one `Database`/pooled engine per application
instance only when configured, without opening a connection at startup, and
disposes it on shutdown. `get_session` yields a new session per request and always
closes it. Sessions are never global or shared between concurrent requests.
Connections are checked before reuse, and SQL parameter values are hidden in
SQLAlchemy logs/errors.

`Database.session()` provides the same cleanup for non-HTTP callers.
`transaction(session)` wraps `session.begin()`: it commits on success and rolls
back on exceptions, propagating the error. Begin the transaction before the first
query; nested or already-started transactions are not silently accepted.
Session cleanup rolls back any uncommitted work and does not auto-commit a
request. Services must explicitly define their transaction boundary. Committed
attributes are not expired automatically (`expire_on_commit=False`).

## PostgreSQL integration tests

The regular suite runs without a database and explicitly skips PostgreSQL tests
unless `TEST_DATABASE_URL` is set. To run them, use an **empty, disposable
PostgreSQL database**, not the application database or a real Supabase project:

```powershell
$env:TEST_DATABASE_URL = "postgresql+psycopg://<user>:<url-encoded-password>@<host>:<port>/<disposable-test-database>"
.\.venv\Scripts\python.exe -m pytest -m postgresql
```

The suite refuses a database containing existing tables. It applies/downgrades/
reapplies migrations, checks committed and rolled-back writes, verifies recovery
after a constraint violation, and confirms sessions return their connections on
success and exceptions. Test-created tables are removed. The URL is distinct
from `DATABASE_URL` to prevent accidentally testing against the application DB.

See the [repository README](../../readme.md) for all checks and local setup.
