# Backend

FastAPI with Pydantic Settings, Uvicorn, SQLAlchemy 2, psycopg 3, Alembic,
Pytest, Ruff, and strict mypy checks.
`app.main:create_app` creates the application; `app.main:app` is the ASGI entry
point. Task 1.2 adds public `GET /health` and explicit local-development CORS.
Task 1.3 adds the PostgreSQL persistence foundation and a reversible, empty
migration baseline. Task 2.3 verifies Supabase access JWTs for `GET /api/me`.
There are no application tables or product endpoints yet. Health remains a
process check and does not connect to a database.

From this directory, create `.venv`, install `requirements-dev.txt`, install the
editable package, and run Uvicorn using the commands in the repository README.

## Local configuration template

Task 2.1 provides `.env.example` with empty project/credential values and public
development defaults. Copy it to ignored `.env` without overwriting an existing
file, then populate it locally from the existing development Supabase project.
Do not paste actual values into chat, commit them, or place backend secrets in
the frontend. Keep database passwords URL-encoded in `DATABASE_URL`.

The API loads `apps\api\.env` on restart, with process environment variables taking
precedence. Remove unused blank optional settings rather than loading the blank
template. `ALLOWED_ORIGINS` sets the explicit CORS origins; the old
`FLIGHT_INSTRUCTOR_CORS_ORIGINS` alias remains supported. `LOG_LEVEL` is reserved
for later configuration work. Alembic still reads process environment only.
See the repository README for the owner configuration checklist.

## JWT verification

Send the signed-in user's access token as `Authorization: Bearer <access-token>`
to `GET /api/me`. Missing/invalid tokens return 401 with `WWW-Authenticate: Bearer`.
Success returns only `{"id":"<validated-sub-uuid>"}`. Query parameters, identity
headers, and user metadata cannot override the identity. This is an authentication
probe, not instructor-profile lookup, account-state checking, or product-data
authorization; those need the later schema/ownership tasks.

Set `SUPABASE_URL` to the trusted project URL. Issuer and JWKS URLs derive from
that configuration, never from token claims or headers. Optional
`SUPABASE_JWT_ISSUER` / `SUPABASE_JWKS_URL` override them; omit unset overrides.
Remote Auth URLs require HTTPS (HTTP is allowed on loopback for local development).
`SUPABASE_JWT_AUDIENCE` defaults to `authenticated`.

PyJWT with cryptography validates ES256/RS256 signatures, required issuer,
audience, expiration, and UUID subject; `nbf`/`iat` are checked when present.
Only Auth user tokens with `role=authenticated` are accepted. HS256, unsigned
tokens, API keys, and non-user roles are rejected. Legacy HS256 projects must
migrate to a supported asymmetric signing key; there is no shared-secret or
privileged-key fallback. No Supabase privileged API key is needed here.

Trusted JWKS fetches have a five-second timeout, a five-minute cache, and a
30-second unknown-key refresh cooldown. Rotation can take up to the cooldown
to discover a newly published key; retired keys leave the cache after expiry.
JWKS/configuration failures return sanitized 503 errors and log only a static
diagnostic, not tokens, keys, endpoint responses, or connection values.
The public `/health` remains independent of JWT verification.

## PostgreSQL configuration and migrations

Set `DATABASE_URL` in the terminal running the API or Alembic. This unprefixed
variable is optional for the current application and required for
migrations or any use of the database dependency. It accepts `postgresql://` or
`postgresql+psycopg://`; both use psycopg 3. Other databases/drivers are rejected.
Use URL-encoded credentials and the PostgreSQL server's required TLS options.
Actual values must stay out of Git and chat. The API loads `.env`; Alembic does not yet.

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
