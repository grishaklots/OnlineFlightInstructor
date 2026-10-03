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

Task 1.1 adds a local application skeleton only. All six required frontend routes
are placeholders: `/login`, `/students`, `/students/:studentId`, `/landing-slots`,
`/admin`, and `/student/:token`. `/` redirects to `/students`.

No authentication, student-data operations, database, frontend/backend requests,
health endpoint, CORS, CI, or deployment is implemented yet. The API exposes only
FastAPI's generated documentation/OpenAPI routes. In particular, `/health` returns
404; it belongs to Task 1.2.

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

Use the URL printed by Vite (normally `http://localhost:5173`). Vite handles direct
navigation to placeholder routes locally. The app uses React Router and a TanStack
Query provider, but does not fetch API data yet.

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

Open `http://localhost:8000/docs` to inspect the empty API. The application factory
uses Pydantic Settings; `FLIGHT_INSTRUCTOR_APP_NAME` can override the API title.
There are no required environment variables or `.env` files.

Run checks from `apps\api`:

```powershell
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m mypy
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m build --no-isolation --outdir dist
```

`.\.venv\Scripts\python.exe -m ruff format .` formats Python files. The build command
produces a wheel and source distribution; there is no database build or migration
step. On other operating systems use `.venv/bin/python` instead.

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
