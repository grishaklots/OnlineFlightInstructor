from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, HttpUrl, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="FLIGHT_INSTRUCTOR_", extra="ignore", populate_by_name=True
    )

    app_name: str = "Flight Instructor API"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO", validation_alias="LOG_LEVEL"
    )
    database_url: SecretStr | None = Field(
        default=None, validation_alias="DATABASE_URL"
    )
    cors_origins: list[str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"],
        validation_alias=AliasChoices(
            "ALLOWED_ORIGINS", "FLIGHT_INSTRUCTOR_CORS_ORIGINS"
        ),
    )
    supabase_url: HttpUrl | None = Field(default=None, validation_alias="SUPABASE_URL")
    supabase_jwt_issuer: HttpUrl | None = Field(
        default=None, validation_alias="SUPABASE_JWT_ISSUER"
    )
    supabase_jwks_url: HttpUrl | None = Field(
        default=None, validation_alias="SUPABASE_JWKS_URL"
    )
    supabase_jwt_audience: str = Field(
        default="authenticated", min_length=1, validation_alias="SUPABASE_JWT_AUDIENCE"
    )

    @field_validator("supabase_url", "supabase_jwt_issuer", "supabase_jwks_url")
    @classmethod
    def secure_auth_url(cls, value: HttpUrl | None) -> HttpUrl | None:
        if (
            value is not None
            and value.scheme != "https"
            and value.host not in {"localhost", "127.0.0.1", "::1", "[::1]"}
        ):
            raise ValueError("Supabase Auth URLs require HTTPS except on localhost")
        return value


ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


def load_settings() -> Settings:
    return Settings(_env_file=ENV_FILE)
