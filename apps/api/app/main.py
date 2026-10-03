from fastapi import FastAPI

from app.settings import Settings


def create_app() -> FastAPI:
    settings = Settings()
    return FastAPI(title=settings.app_name, version="0.1.0")


app = create_app()
