from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FLIGHT_INSTRUCTOR_")

    app_name: str = "Flight Instructor API"
    database_url: SecretStr | None = Field(
        default=None, validation_alias="DATABASE_URL"
    )
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
