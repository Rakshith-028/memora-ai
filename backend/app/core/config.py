
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class Settings(BaseSettings):
    app_name: str = "Memora AI"
    app_env: str = "development"
    debug: bool = True

    database_url: str
    redis_url: str
    secret_key: str

    frontend_url: str = (
        "http://localhost:3000"
    )

    cors_origins: str | None = None

    trusted_hosts: str = (
        "localhost,"
        "127.0.0.1,"
        "testserver"
    )

    google_client_id: str | None = None

    smtp_host: str | None = None
    smtp_port: int = 587

    smtp_username: str | None = None
    smtp_password: str | None = None

    smtp_from_email: str | None = None

    smtp_use_tls: bool = True

    @property
    def is_production(
        self,
    ) -> bool:
        return (
            self.app_env
            .strip()
            .lower()
            == "production"
        )

    @property
    def allowed_cors_origins(
        self,
    ) -> list[str]:
        raw_origins = (
            self.cors_origins
            or self.frontend_url
        )

        return [
            origin.strip().rstrip("/")
            for origin
            in raw_origins.split(",")
            if origin.strip()
        ]

    @property
    def allowed_hosts(
        self,
    ) -> list[str]:
        return [
            host.strip()
            for host
            in self.trusted_hosts.split(",")
            if host.strip()
        ]

    @model_validator(
        mode="after"
    )
    def validate_environment(
        self,
    ):
        if self.is_production:
            if self.debug:
                raise ValueError(
                    "DEBUG must be false "
                    "in production."
                )

            if len(
                self.secret_key.strip()
            ) < 32:
                raise ValueError(
                    "SECRET_KEY must contain "
                    "at least 32 characters "
                    "in production."
                )

            if not (
                self.frontend_url
                .strip()
                .lower()
                .startswith(
                    "https://"
                )
            ):
                raise ValueError(
                    "FRONTEND_URL must use "
                    "HTTPS in production."
                )

            for origin in (
                self.allowed_cors_origins
            ):
                if not (
                    origin.lower()
                    .startswith(
                        "https://"
                    )
                ):
                    raise ValueError(
                        "All CORS origins must "
                        "use HTTPS in production."
                    )

            if (
                not self.allowed_hosts
                or "*"
                in self.allowed_hosts
            ):
                raise ValueError(
                    "TRUSTED_HOSTS must contain "
                    "explicit hosts in production."
                )

        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()