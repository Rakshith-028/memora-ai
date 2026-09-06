import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.user import User
from app.services.embeddings import embedding_service


STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
    "uploaded",
    "pdf",
    "document",
    "file",
    "search",
    "find",
    "look",
    "check",
}


TOKEN_NORMALIZATION = {
    "aims": "aim",
    "objectives": "objective",
    "experiments": "experiment",
    "theories": "theory",
    "results": "result",
    "procedures": "procedure",
    "algorithms": "algorithm",
    "programs": "program",
    "codes": "code",
}


SECTION_ALIASES = {
    "aim": (
        "aim",
    ),
    "objective": (
        "objective",
        "objectives",
    ),
    "theory": (
        "theory",
    ),
    "procedure": (
        "procedure",
    ),
    "algorithm": (
        "algorithm",
    ),
    "code": (
        "code",
        "program",
    ),
    "output": (
        "output",
    ),
    "result": (
        "result",
    ),
}


class DocumentSearchService:
    def _tokenize(
        self,
        text: str,
    ) -> list[str]:
        tokens = re.findall(
            r"[a-zA-Z0-9]+",
            text.lower(),
        )

        normalized_tokens = []

        for token in tokens:
            if (
                token in STOP_WORDS
                or len(token) <= 1
            ):
                continue

            normalized_tokens.append(
                TOKEN_NORMALIZATION.get(
                    token,
                    token,
                )
            )

        return normalized_tokens

    def _lexical_score(
        self,
        query: str,
        content: str,
    ) -> float:
        query_tokens = self._tokenize(
            query
        )

        if not query_tokens:
            return 0.0

        content_tokens = set(
            self._tokenize(
                content
            )
        )

        unique_query_tokens = set(
            query_tokens
        )

        matched_tokens = (
            unique_query_tokens
            & content_tokens
        )

        token_overlap = (
            len(matched_tokens)
            / len(unique_query_tokens)
        )

        return min(
            1.0,
            token_overlap,
        )

    def _requested_experiment_number(
        self,
        query: str,
    ) -> str | None:
        match = re.search(
            r"\bexperiment\s*(?:no\.?\s*)?(\d+)\b",
            query.lower(),
        )

        if match is None:
            return None

        return match.group(1)

    def _requested_section(
        self,
        query: str,
    ) -> str | None:
        query_tokens = set(
            self._tokenize(
                query
            )
        )

        for canonical_name, aliases in (
            SECTION_ALIASES.items()
        ):
            normalized_aliases = {
                TOKEN_NORMALIZATION.get(
                    alias,
                    alias,
                )
                for alias
                in aliases
            }

            if (
                query_tokens
                & normalized_aliases
            ):
                return canonical_name

        return None

    def _experiment_positions(
        self,
        content: str,
    ) -> list[tuple[str, int]]:
        return [
            (
                match.group(1),
                match.start(),
            )
            for match
            in re.finditer(
                (
                    r"\bexperiment\s*"
                    r"(?:no\.?\s*)?(\d+)\b"
                ),
                content.lower(),
            )
        ]

    def _section_positions(
        self,
        content: str,
        section: str,
    ) -> list[int]:
        aliases = SECTION_ALIASES.get(
            section,
            (
                section,
            ),
        )

        alias_pattern = "|".join(
            re.escape(
                alias
            )
            for alias
            in aliases
        )

        pattern = (
            rf"\b(?:{alias_pattern})\b"
            rf"\s*:?"
        )

        return [
            match.start()
            for match
            in re.finditer(
                pattern,
                content.lower(),
            )
        ]

    def _structural_features(
        self,
        query: str,
        content: str,
    ) -> tuple[
        float,
        float,
        bool,
    ]:
        requested_experiment = (
            self._requested_experiment_number(
                query
            )
        )

        requested_section = (
            self._requested_section(
                query
            )
        )

        experiment_positions = (
            self._experiment_positions(
                content
            )
        )

        section_positions = (
            self._section_positions(
                content=content,
                section=requested_section,
            )
            if requested_section
            else []
        )

        structural_score = 0.0
        penalty = 0.0
        exact_structure_match = False

        target_experiment_positions = []

        if requested_experiment is not None:
            target_experiment_positions = [
                position
                for number, position
                in experiment_positions
                if number
                == requested_experiment
            ]

            if target_experiment_positions:
                structural_score += 0.45

            elif experiment_positions:
                penalty += 0.30

        if requested_section is not None:
            if section_positions:
                structural_score += 0.25

            else:
                penalty += 0.10

        if (
            requested_experiment is not None
            and requested_section is not None
            and target_experiment_positions
            and section_positions
        ):
            best_distance = None

            for experiment_position in (
                target_experiment_positions
            ):
                for section_position in (
                    section_positions
                ):
                    distance = (
                        section_position
                        - experiment_position
                    )

                    if (
                        distance < 0
                        or distance > 900
                    ):
                        continue

                    if (
                        best_distance is None
                        or distance
                        < best_distance
                    ):
                        best_distance = distance

            if best_distance is not None:
                exact_structure_match = True

                if best_distance <= 300:
                    structural_score += 0.30

                elif best_distance <= 600:
                    structural_score += 0.22

                else:
                    structural_score += 0.12

        elif (
            requested_experiment is not None
            and requested_section is None
            and target_experiment_positions
        ):
            exact_structure_match = True
            structural_score += 0.20

        elif (
            requested_experiment is None
            and requested_section is not None
            and section_positions
        ):
            exact_structure_match = True
            structural_score += 0.35

        if (
            requested_experiment is not None
            and target_experiment_positions
            and experiment_positions
        ):
            first_experiment_number = (
                experiment_positions[0][0]
            )

            if (
                first_experiment_number
                != requested_experiment
            ):
                first_target_position = min(
                    target_experiment_positions
                )

                first_experiment_position = (
                    experiment_positions[0][1]
                )

                if (
                    first_target_position
                    - first_experiment_position
                    > 500
                ):
                    penalty += 0.12

        return (
            min(
                1.0,
                structural_score,
            ),
            min(
                0.5,
                penalty,
            ),
            exact_structure_match,
        )

    def _is_structured_query(
        self,
        query: str,
    ) -> bool:
        return (
            self._requested_experiment_number(
                query
            )
            is not None
            or self._requested_section(
                query
            )
            is not None
        )

    def _prune_matches(
        self,
        query: str,
        matches: list[dict],
        limit: int,
    ) -> list[dict]:
        if not matches:
            return []

        if not self._is_structured_query(
            query
        ):
            return matches[
                :limit
            ]

        exact_matches = [
            match
            for match
            in matches
            if match[
                "exact_structure_match"
            ]
        ]

        candidate_matches = (
            exact_matches
            if exact_matches
            else matches
        )

        best_score = (
            candidate_matches[0][
                "retrieval_score"
            ]
        )

        score_floor = max(
            0.0,
            best_score - 0.10,
        )

        pruned = [
            match
            for match
            in candidate_matches
            if match[
                "retrieval_score"
            ]
            >= score_floor
        ]

        return pruned[
            :limit
        ]

    def search(
        self,
        db: Session,
        user: User,
        query: str,
        limit: int = 5,
        document_id: uuid.UUID | None = None,
    ) -> list[dict]:
        query_embedding = (
            embedding_service.embed(
                query
            )
        )

        distance = (
            DocumentChunk.embedding
            .cosine_distance(
                query_embedding
            )
        )

        candidate_limit = max(
            limit * 10,
            50,
        )

        statement = (
            select(
                DocumentChunk,
                Document,
                distance.label(
                    "distance"
                ),
            )
            .join(
                Document,
                Document.id
                == DocumentChunk.document_id,
            )
            .where(
                Document.user_id
                == user.id,
                Document.status
                == "ready",
            )
        )

        if document_id is not None:
            statement = (
                statement.where(
                    Document.id
                    == document_id
                )
            )

        statement = (
            statement
            .order_by(
                distance
            )
            .limit(
                candidate_limit
            )
        )

        results = db.execute(
            statement
        ).all()

        matches = []

        for (
            chunk,
            document,
            chunk_distance,
        ) in results:
            semantic_similarity = max(
                0.0,
                min(
                    1.0,
                    1.0
                    - float(
                        chunk_distance
                    ),
                ),
            )

            lexical_score = (
                self._lexical_score(
                    query=query,
                    content=chunk.content,
                )
            )

            (
                structural_score,
                section_penalty,
                exact_structure_match,
            ) = self._structural_features(
                query=query,
                content=chunk.content,
            )

            retrieval_score = (
                0.45
                * semantic_similarity
                + 0.30
                * lexical_score
                + 0.25
                * structural_score
                - section_penalty
            )

            retrieval_score = max(
                0.0,
                min(
                    1.0,
                    retrieval_score,
                ),
            )

            matches.append(
                {
                    "document_id": str(
                        document.id
                    ),
                    "filename": (
                        document.filename
                    ),
                    "chunk_id": str(
                        chunk.id
                    ),
                    "chunk_index": (
                        chunk.chunk_index
                    ),
                    "page_number": (
                        chunk.page_number
                    ),
                    "content": (
                        chunk.content
                    ),
                    "semantic_similarity": round(
                        semantic_similarity,
                        4,
                    ),
                    "lexical_score": round(
                        lexical_score,
                        4,
                    ),
                    "structural_score": round(
                        structural_score,
                        4,
                    ),
                    "section_penalty": round(
                        section_penalty,
                        4,
                    ),
                    "exact_structure_match": (
                        exact_structure_match
                    ),
                    "retrieval_score": round(
                        retrieval_score,
                        4,
                    ),
                    "similarity": round(
                        retrieval_score,
                        4,
                    ),
                }
            )

        matches.sort(
            key=lambda item: (
                item[
                    "exact_structure_match"
                ],
                item[
                    "retrieval_score"
                ],
                item[
                    "structural_score"
                ],
                item[
                    "lexical_score"
                ],
                item[
                    "semantic_similarity"
                ],
            ),
            reverse=True,
        )

        return self._prune_matches(
            query=query,
            matches=matches,
            limit=limit,
        )


document_search_service = (
    DocumentSearchService()
)
