from sentence_transformers import SentenceTransformer


class EmbeddingService:
    def __init__(self):
        self.model = None

    def _get_model(self):
        if self.model is None:
            self.model = SentenceTransformer(
                "sentence-transformers/all-MiniLM-L6-v2"
            )
        return self.model

    def embed(self, text: str) -> list[float]:
        model = self._get_model()

        embedding = model.encode(
            text,
            normalize_embeddings=True,
        )

        return embedding.tolist()


embedding_service = EmbeddingService()