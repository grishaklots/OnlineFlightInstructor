# Flight Instructor

A planned application for managing flight-training students, sessions, flight logs,
and landing-slot allocation. The local-only reference tool is
[landing-slots.html](landing-slots.html).

Product and implementation references:

- [Product brief](docs/product-brief.md)
- [Execution plan](docs/execution-plan.md)
- [Architecture decisions](docs/architecture.md)
- [POC analysis](docs/poc-analysis.md)
- [Allocation characterization fixtures](tests/fixtures/README.md)

## Repository structure

```text
apps/
  web/       React + TypeScript + Vite
  api/       Python + FastAPI
docs/        Requirements, architecture, and execution plan
tests/       Existing POC characterization fixtures/verifier
e2e/         Reserved for later end-to-end tests
supabase/    Reserved for later Supabase configuration
```

Task 1.1 adds the application skeleton; Task 1.2 connects React to FastAPI locally
with an unauthenticated health check; Task 1.3 adds SQLAlchemy, psycopg, scoped
sessions, explicit transactions, and an empty Alembic baseline.
Task 1.4 adds GitHub Actions CI for both applications.
Task 2.1 adds safe frontend/backend environment templates.
Task 2.2 implements frontend Supabase email/password authentication.
`/login` is functional; `/students`, `/students/:studentId`, `/landing-slots`,
`/admin`, and `/student/:token` remain product placeholders.
`/` redirects to `/students`; signed-out instructors are redirected to `/login`.
The student portal stays public.

No backend JWT validation, student-data operations, application tables, or
deployment is implemented yet. `GET /health` returns `{"status":"ok"}` for the running API
process; it does not check a database or external service.

## Prerequisites

- Node.js 22.13+ (22.x) or 24+, with npm.
- Python 3.12+ with pip and venv.

Run the following PowerShell commands from the repository root. Dependencies and
build outputs are ignored by Git; `package-lock.json` and
`apps\api\requirements-dev.txt` pin dependencies.
The health check and CI need no platform accounts or credentials. The Task 2.1
configuration checklist and Task 2.2 instructor login use the existing
development Supabase project.

## Frontend

Install and start the Vite development server:

```powershell
Set-Location .\apps\web
npm ci
npm run dev
```

Open `http://localhost:5173`. Vite handles direct navigation to placeholder routes
locally. Its port is fixed: if 5173 is occupied, startup fails rather than silently
switching to an origin not allowed by the API.

The instructor navigation includes an **API connection** panel. It starts with
Checking, then shows Online when the browser receives a valid response from
`http://localhost:8000/health`. If the API is stopped or the request fails, it shows
Unavailable with an error. Start the backend in a second terminal and click
**Check API** to retry.

For instructor login, fill the public Supabase values in `apps\web\.env.local`
using the checklist below, restart Vite, and open `/login`. Sign in with the
development account you created in Supabase; reload to verify session restoration
and use **Logout** to sign out. The SDK handles automatic token refresh.
See the [frontend README](apps/web/README.md#instructor-authentication) for details.
Rotate the test password previously committed in the execution plan; it is no
longer included in the current plan but remains in Git history.

Run checks from `apps\web`:

```powershell
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

`npm run format` formats frontend files. `npm run test:watch` runs Vitest
interactively. Tests use React Testing Library with jsdom. The production build
is written to `dist`; `npm run preview` serves it locally.

## Backend

In a separate terminal, install and start Uvicorn:

```powershell
Set-Location .\apps\api
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pip install --no-deps --no-build-isolation -e .
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://localhost:8000/health` to see the public JSON response, or
`http://localhost:8000/docs` to inspect the endpoint. The application factory
uses Pydantic Settings; `FLIGHT_INSTRUCTOR_APP_NAME` can override the API title.
There are no required environment variables or `.env` files for health.
`DATABASE_URL` optionally configures the PostgreSQL engine and is required to run
migrations; no database connection is opened by the health check.

Development CORS allows only `http://localhost:5173` and `http://127.0.0.1:5173`,
GET requests, and no credentialed browser requests. The frontend calls the API
directly across origins, not through a Vite proxy. CORS is a browser access rule,
not authentication.

For an alternate local API port, set `VITE_API_BASE_URL` in the frontend terminal
before starting Vite (for example, `$env:VITE_API_BASE_URL = "http://localhost:8017"`).
Restart Vite after changing it. For an alternate frontend origin, set
`FLIGHT_INSTRUCTOR_CORS_ORIGINS` in the API terminal to a JSON array of explicit
origins, then restart the API. Do not use wildcard origins. Visiting `/students`
and seeing **API status: online** verifies the React-to-FastAPI browser call.

For PostgreSQL configuration, the sync-session/transaction design, migration
apply/rollback commands, and disposable-database integration tests, see the
[backend README](apps/api/README.md). Database configuration is not needed to
continue using the frontend/API health check.

Run checks from `apps\api`:

```powershell
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m mypy
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m build --no-isolation --outdir dist
```

`.\.venv\Scripts\python.exe -m ruff format .` formats Python files. The build command
produces a wheel and source distribution; it does not apply database migrations.
Without `TEST_DATABASE_URL`, PostgreSQL integration tests are explicitly skipped.
On other operating systems use `.venv/bin/python` instead.

`pyproject.toml` declares runtime dependencies and the `dev` dependency group.
When changing those declarations, use pip 25.1+ to install the groups and regenerate
the pinned file in a clean virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pip install -e . --group dev
.\.venv\Scripts\python.exe -m pip freeze --exclude-editable | Set-Content requirements-dev.txt
```

Do not add machine-specific package-feed URLs or credentials to the pinned file.

## Supabase configuration checklist (Task 2.1)

The owner must collect values from the **existing development project** and keep
them only in ignored local files or platform secret stores. Do not send
credentials in chat, commit populated environment files, or use production
services for development.

From the repository root, create local copies only if they do not already exist:

```powershell
if (-not (Test-Path .\apps\web\.env.local)) {
    Copy-Item .\apps\web\.env.example .\apps\web\.env.local
}
if (-not (Test-Path .\apps\api\.env)) {
    Copy-Item .\apps\api\.env.example .\apps\api\.env
}
```

Populate these files locally using the project's **Connect** dialog and API key
settings:

| Values | Where they belong / how to obtain them |
| --- | --- |
| `VITE_API_BASE_URL` | Frontend `.env.local`; keep `http://localhost:8000` for the local API. |
| `VITE_SUPABASE_URL`, `SUPABASE_URL` | Frontend/backend respectively; use the same project's public URL. |
| `VITE_SUPABASE_ANON_KEY` | Frontend only; public `anon` or publishable key, not a privileged key or user access token. Task 2.2 also supports `VITE_SUPABASE_PUBLISHABLE_KEY` from the current Supabase React dialog; it takes precedence when both are nonempty. |
| `DATABASE_URL` | Backend only; copy the PostgreSQL URL from Connect, replace its password locally, URL-encode reserved password characters, and preserve required TLS options. Use a direct connection when reachable; session pooling can serve IPv4-only local networks. Do not select transaction pooling for the current migration setup. |
| `SUPABASE_JWT_ISSUER` | Backend; the project's Auth issuer, typically `<project-url>/auth/v1`. |
| `SUPABASE_JWKS_URL` | Backend; the project's signing-key endpoint, typically `<project-url>/auth/v1/.well-known/jwks.json`. This is a URL, not a signing secret. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend only; the project's privileged `service_role` or secret API key, under the execution plan's variable name. Never copy it into a `VITE_` variable. |
| `ALLOWED_ORIGINS`, `LOG_LEVEL` | Backend; the template supplies explicit local origins as a JSON array and `INFO`. |

Refer to Supabase's [API key guidance](https://supabase.com/docs/guides/api/api-keys)
and [PostgreSQL connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).
Supabase is transitioning legacy keys to publishable/secret keys; preserve the
template variable names, and never substitute a privileged backend key for the
frontend public key. Key rotation or signing-key migration is not part of this
task.

Vite automatically loads the frontend `.env.local` on restart; Task 2.2 consumes
its public Supabase configuration. The backend
template is a configuration inventory: automatic dotenv loading, consumption of
the new Supabase/origin/logging settings, backend Auth integration, and DB connectivity
checks are not implemented here. The current API still reads `DATABASE_URL` from
its process environment and uses `FLIGHT_INSTRUCTOR_CORS_ORIGINS` for overrides.
Do not load the incomplete backend template; its database URL is deliberately
empty. The existing health-only setup continues to work without these files.

Both local files (and `.env.*` variants) are ignored by Git; only `.env.example`
templates are intended to be tracked. Completion of the owner portion requires
populating the ignored files or a platform secret store locally. It does not
require creating users, changing Auth settings, or contacting the database yet.

## Continuous integration

[CI](.github/workflows/ci.yml) runs on pushes to `main`, pull requests, and manual
dispatch from GitHub Actions. Two independent Ubuntu jobs use Python 3.13 and
Node.js 24:

- **Backend checks:** install the pinned dependencies and editable package, then
  run Ruff formatting/lint checks, strict mypy, and all Pytest tests.
- **Frontend checks:** install with `npm ci`, then run Prettier, ESLint,
  TypeScript, Vitest, and the Vite production build.

The backend job provisions a fresh PostgreSQL 17 service and sets
`TEST_DATABASE_URL`, so migration and transaction tests run rather than being
skipped. Its public test-only credentials are for that disposable CI database,
not an application database. No Supabase project, repository secrets, or running
application servers are required.

The workflow has read-only repository permissions, pins actions to release
commit SHAs, caches package downloads, and cancels superseded runs on the same
ref. It does not deploy anything. Hosted checks become available after the
workflow is committed and pushed; results appear in the repository's Actions tab.

## Existing POC fixtures

Run the standalone verifier from the repository root:

```powershell
$env:TZ = "UTC"
node .\tests\verify-poc-fixtures.cjs
```

The verifier does not modify the POC or implement a new allocation engine.
