# Backend skeleton

FastAPI with Pydantic Settings, Uvicorn, Pytest, Ruff, and strict mypy checks.
`app.main:create_app` creates the application; `app.main:app` is the ASGI entry
point. Task 1.2 adds public `GET /health` and explicit local-development CORS.
There are no database, authentication, or product endpoints yet.

From this directory, create `.venv`, install `requirements-dev.txt`, install the
editable package, and run Uvicorn using the commands in the repository README.

See the [repository README](../../readme.md) for all checks and local setup.
