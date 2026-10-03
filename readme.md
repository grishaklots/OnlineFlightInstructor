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
All six required frontend routes
are placeholders: `/login`, `/students`, `/students/:studentId`, `/landing-slots`,
`/admin`, and `/student/:token`. `/` redirects to `/students`.

No authentication, student-data operations, application tables, CI, or deployment
is implemented yet. `GET /health` returns `{"status":"ok"}` for the running API
process; it does not check a database or external service.

## Prerequisites

- Node.js 22.13+ (22.x) or 24+, with npm.
- Python 3.12+ with pip and venv.

Run the following PowerShell commands from the repository root. Dependencies and
build outputs are ignored by Git; `package-lock.json` and
`apps\api\requirements-dev.txt` pin dependencies.
No platform accounts or credentials are required for this task.

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

## Existing POC fixtures

Run the standalone verifier from the repository root:

```powershell
$env:TZ = "UTC"
node .\tests\verify-poc-fixtures.cjs
```

The verifier does not modify the POC or implement a new allocation engine.
