from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.settings import Settings


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


def create_app() -> FastAPI:
    settings = Settings()
    application = FastAPI(title=settings.app_name, version="0.1.0")
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
