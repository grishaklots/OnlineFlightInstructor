from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.auth import IdentityResponse, JwtVerifier, authenticated_identity
from app.database import Database
from app.settings import Settings, load_settings


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings if settings is not None else load_settings()

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
    application.state.jwt_verifier = JwtVerifier(settings)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["Authorization"],
        allow_credentials=False,
    )

    @application.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse()

    @application.get("/api/me", response_model=IdentityResponse)
    def me(
        identity: Annotated[IdentityResponse, Depends(authenticated_identity)],
    ) -> IdentityResponse:
        return identity

    return application


app = create_app()
