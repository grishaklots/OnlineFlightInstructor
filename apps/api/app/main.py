from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.database import Database
from app.settings import Settings


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


def create_app() -> FastAPI:
    settings = Settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        database = (
            Database(settings.database_url.get_secret_value())
            if settings.database_url is not None
            else None
        )
        application.state.database = database
        try:
            yield
        finally:
            application.state.database = None
            if database is not None:
                database.dispose()

    application = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_credentials=False,
    )

    @application.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse()

    return application


app = create_app()
