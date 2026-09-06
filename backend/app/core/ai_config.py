from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class AISettings(BaseSettings):
    llm_provider: Literal[
        "ollama",
        "gemini",
    ] = "ollama"

    embedding_provider: Literal[
        "local",
        "gemini",
    ] = "local"

    ollama_url: str = (
        "http://localhost:11434/api/chat"
    )

    ollama_model: str = (
        "llama3.2:3b"
    )

    gemini_api_key: str | None = None

    gemini_model: str = (
        "gemini-2.5-flash"
    )

    gemini_embedding_model: str = (
        "gemini-embedding-2"
    )

    embedding_dimensions: int = 384

    @model_validator(
        mode="after"
    )
    def validate_ai_configuration(
        self,
    ):
        if self.embedding_dimensions <= 0:
            raise ValueError(
                "EMBEDDING_DIMENSIONS "
                "must be greater than zero."
            )

        using_gemini = (
            self.llm_provider
            == "gemini"
            or self.embedding_provider
            == "gemini"
        )

        if (
            using_gemini
            and not (
                self.gemini_api_key
                and self.gemini_api_key.strip()
            )
        ):
            raise ValueError(
                "GEMINI_API_KEY is required "
                "when a Gemini AI provider "
                "is enabled."
            )

        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_ai_settings() -> AISettings:
    return AISettings()


ai_settings = get_ai_settings()