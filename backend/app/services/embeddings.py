from math import sqrt

import httpx

from app.core.ai_config import (
    ai_settings,
)


GEMINI_API_BASE = (
    "https://generativelanguage.googleapis.com"
    "/v1beta/models"
)


class EmbeddingService:
    def __init__(self):
        self.model = None

    def _get_local_model(self):
        if self.model is None:
            from sentence_transformers import (
                SentenceTransformer,
            )

            self.model = (
                SentenceTransformer(
                    "sentence-transformers/"
                    "all-MiniLM-L6-v2"
                )
            )

        return self.model

    def embed(
        self,
        text: str,
    ) -> list[float]:
        cleaned_text = text.strip()

        if not cleaned_text:
            raise ValueError(
                "Cannot embed empty text."
            )

        if (
            ai_settings.embedding_provider
            == "local"
        ):
            return self._embed_local(
                cleaned_text
            )

        if (
            ai_settings.embedding_provider
            == "gemini"
        ):
            return self._embed_gemini(
                cleaned_text
            )

        raise RuntimeError(
            "Unsupported embedding provider: "
            f"{ai_settings.embedding_provider}"
        )

    def _embed_local(
        self,
        text: str,
    ) -> list[float]:
        model = (
            self._get_local_model()
        )

        embedding = model.encode(
            text,
            normalize_embeddings=True,
        )

        values = (
            embedding.tolist()
        )

        self._validate_dimensions(
            values
        )

        return values

    def _embed_gemini(
        self,
        text: str,
    ) -> list[float]:
        api_key = (
            ai_settings.gemini_api_key
        )

        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is missing."
            )

        url = (
            f"{GEMINI_API_BASE}/"
            f"{ai_settings.gemini_embedding_model}"
            ":embedContent"
        )

        payload = {
            "content": {
                "parts": [
                    {
                        "text":
                            text
                    }
                ]
            },
            "output_dimensionality":
                ai_settings
                .embedding_dimensions,
        }

        with httpx.Client(
            timeout=60.0
        ) as client:
            response = client.post(
                url,
                headers={
                    "x-goog-api-key":
                        api_key,
                    "Content-Type":
                        "application/json",
                },
                json=payload,
            )

            response.raise_for_status()

            data = response.json()

        try:
            values = (
                data["embedding"][
                    "values"
                ]
            )
        except (
            KeyError,
            TypeError,
        ) as exc:
            raise RuntimeError(
                "Gemini returned an "
                "unexpected embedding "
                "response."
            ) from exc

        if not isinstance(
            values,
            list,
        ):
            raise RuntimeError(
                "Gemini returned invalid "
                "embedding values."
            )

        normalized = (
            self._normalize(
                [
                    float(value)
                    for value in values
                ]
            )
        )

        self._validate_dimensions(
            normalized
        )

        return normalized

    def _normalize(
        self,
        values: list[float],
    ) -> list[float]:
        norm = sqrt(
            sum(
                value * value
                for value in values
            )
        )

        if norm == 0:
            raise RuntimeError(
                "Embedding vector has "
                "zero magnitude."
            )

        return [
            value / norm
            for value in values
        ]

    def _validate_dimensions(
        self,
        values: list[float],
    ) -> None:
        expected = (
            ai_settings
            .embedding_dimensions
        )

        if len(values) != expected:
            raise RuntimeError(
                "Embedding dimension "
                f"mismatch: expected "
                f"{expected}, received "
                f"{len(values)}."
            )


embedding_service = EmbeddingService()