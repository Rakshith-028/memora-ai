from datetime import datetime, timezone
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.memory import Memory
from app.models.user import User
from app.schemas.memory import MemoryCreate
from app.services.embeddings import embedding_service
from app.services.memory_resolver import memory_resolver


class MemoryService:
    GENERIC_MEMORY_PHRASES = {
        "programming languages",
        "preferred programming language",
        "favorite programming language",
        "preferences",
        "user preference",
        "coding",
        "technology",
        "technologies",
        "projects",
        "goals",
        "skills",
    }

    AUTO_MEMORY_REJECTED_PHRASES = {
        "not explicitly stated",
        "not stated",
        "not provided",
        "not specified",
        "cannot be determined",
        "can't be determined",
        "the user asked",
        "the user asks",
        "the user is asking",
        "the user requested",
        "the user wants to know",
        "the user wants an explanation",
    }

    AUTO_MEMORY_GENERIC_FACT_PATTERNS = (
        " is a way to ",
        " is a method of ",
        " is a method for ",
        " is a technique ",
        " is a type of ",
        " is used to ",
        " refers to ",
        " means ",
        " allows you to ",
    )

    def is_valid_memory_content(
        self,
        content: str,
    ) -> bool:
        cleaned = content.strip()

        if len(cleaned) < 12:
            return False

        normalized = cleaned.lower().strip(" .!?")

        if normalized in self.GENERIC_MEMORY_PHRASES:
            return False

        if len(normalized.split()) < 3:
            return False

        if cleaned.endswith("?"):
            return False

        return True

    def is_valid_automatic_memory_content(
        self,
        content: str,
    ) -> bool:
        if not self.is_valid_memory_content(
            content
        ):
            return False

        normalized = (
            content
            .strip()
            .lower()
        )

        if not (
            normalized.startswith(
                "the user "
            )
            or normalized.startswith(
                "the user's "
            )
        ):
            return False

        if any(
            phrase in normalized
            for phrase
            in self.AUTO_MEMORY_REJECTED_PHRASES
        ):
            return False

        if any(
            pattern in normalized
            for pattern
            in self.AUTO_MEMORY_GENERIC_FACT_PATTERNS
        ):
            return False

        return True

    MEMORY_QUERY_STOPWORDS = {
        "a",
        "an",
        "the",
        "i",
        "me",
        "my",
        "mine",
        "you",
        "your",
        "user",
        "am",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "do",
        "does",
        "did",
        "what",
        "which",
        "who",
        "where",
        "when",
        "why",
        "how",
        "about",
        "tell",
        "please",
        "currently",
        "current",
        "now",
        "right",
    }

    MEMORY_TOKEN_ALIASES = {
        "learning": "learn",
        "learned": "learn",
        "learns": "learn",
        "studying": "study",
        "studied": "study",
        "studies": "study",
        "prefers": "prefer",
        "preferred": "prefer",
        "preference": "prefer",
        "preferences": "prefer",
        "favourite": "favorite",
        "building": "build",
        "built": "build",
        "builds": "build",
        "working": "work",
        "works": "work",
        "projects": "project",
        "languages": "language",
        "technologies": "technology",
        "editors": "editor",
        "goals": "goal",
        "habits": "habit",
        "skills": "skill",
    }

    def _memory_query_tokens(
        self,
        text: str,
    ) -> set[str]:
        raw_tokens = re.findall(
            r"[a-zA-Z0-9+#.]+",
            text.lower(),
        )

        normalized_tokens = set()

        for token in raw_tokens:
            if token in self.MEMORY_QUERY_STOPWORDS:
                continue

            normalized_token = (
                self.MEMORY_TOKEN_ALIASES.get(
                    token,
                    token,
                )
            )

            if (
                len(normalized_token) <= 1
                and normalized_token
                not in {
                    "c",
                    "r",
                }
            ):
                continue

            normalized_tokens.add(
                normalized_token
            )

        return normalized_tokens

    def _memory_lexical_score(
        self,
        query: str,
        memory_content: str,
    ) -> float:
        query_tokens = (
            self._memory_query_tokens(
                query
            )
        )

        memory_tokens = (
            self._memory_query_tokens(
                memory_content
            )
        )

        if (
            not query_tokens
            or not memory_tokens
        ):
            return 0.0

        shared_tokens = (
            query_tokens
            & memory_tokens
        )

        if not shared_tokens:
            return 0.0

        denominator = min(
            len(query_tokens),
            len(memory_tokens),
        )

        if denominator <= 0:
            return 0.0

        return min(
            1.0,
            len(shared_tokens)
            / denominator,
        )

    def create_memory(
        self,
        db: Session,
        user: User,
        payload: MemoryCreate,
    ) -> Memory:
        embedding = embedding_service.embed(
            payload.content
        )

        memory = Memory(
            user_id=user.id,
            memory_type=payload.memory_type,
            content=payload.content,
            embedding=embedding,
            importance_score=payload.importance_score,
            confidence_score=payload.confidence_score,
        )

        db.add(memory)
        db.commit()
        db.refresh(memory)

        return memory

    def retrieve_relevant_memories(
        self,
        db: Session,
        user: User,
        query: str,
        limit: int = 5,
        similarity_threshold: float = 0.45,
        lexical_threshold: float = 0.60,
    ) -> list[Memory]:
        query_embedding = embedding_service.embed(
            query
        )

        candidate_limit = max(
            limit * 10,
            50,
        )

        candidates = db.execute(
            select(
                Memory,
                Memory.embedding.cosine_distance(
                    query_embedding
                ).label("distance"),
            )
            .where(
                Memory.user_id == user.id,
                Memory.is_active.is_(True),
                Memory.embedding.is_not(None),
            )
            .order_by(
                Memory.embedding.cosine_distance(
                    query_embedding
                )
            )
            .limit(candidate_limit)
        ).all()

        scored_memories = []

        now = datetime.now(timezone.utc)

        for memory, distance in candidates:
            similarity = (
                1.0 - float(distance)
            )

            lexical_score = (
                self._memory_lexical_score(
                    query=query,
                    memory_content=(
                        memory.content
                    ),
                )
            )

            semantic_match = (
                similarity
                >= similarity_threshold
            )

            lexical_match = (
                lexical_score
                >= lexical_threshold
            )

            if not (
                semantic_match
                or lexical_match
            ):
                continue

            importance = (
                memory.importance_score
                or 0.5
            )

            confidence = (
                memory.confidence_score
                or 0.5
            )

            if memory.last_accessed_at:
                last_accessed = (
                    memory.last_accessed_at
                )

                if last_accessed.tzinfo is None:
                    last_accessed = (
                        last_accessed.replace(
                            tzinfo=timezone.utc
                        )
                    )

                age_days = max(
                    0,
                    (
                        now
                        - last_accessed
                    ).days,
                )

                recency_score = max(
                    0.0,
                    1.0
                    - age_days / 30,
                )

            else:
                recency_score = 0.5

            access_score = min(
                1.0,
                (
                    memory.access_count
                    or 0
                ) / 10,
            )

            final_score = (
                max(
                    0.0,
                    similarity,
                ) * 0.55
                + lexical_score * 0.15
                + importance * 0.12
                + confidence * 0.08
                + recency_score * 0.06
                + access_score * 0.04
            )

            scored_memories.append(
                (
                    memory,
                    final_score,
                    similarity,
                    lexical_score,
                )
            )

        scored_memories.sort(
            key=lambda item: item[1],
            reverse=True,
        )

        selected = (
            scored_memories[:limit]
        )

        for (
            memory,
            _,
            _,
            _,
        ) in selected:
            memory.access_count = (
                memory.access_count
                or 0
            ) + 1

            memory.last_accessed_at = (
                now
            )

        if selected:
            db.commit()

        print(
            "MEMORY RETRIEVAL SCORES:"
        )

        for (
            memory,
            score,
            similarity,
            lexical_score,
        ) in selected:
            print(
                f"{memory.content} | "
                f"similarity="
                f"{similarity:.3f} | "
                f"lexical="
                f"{lexical_score:.3f} | "
                f"final_score="
                f"{score:.3f}"
            )

        return [
            memory
            for (
                memory,
                _,
                _,
                _,
            )
            in selected
        ]

    def find_similar_memories(
        self,
        db: Session,
        user: User,
        embedding: list[float],
        limit: int = 5,
    ):
        return db.execute(
            select(
                Memory,
                Memory.embedding.cosine_distance(
                    embedding
                ).label("distance"),
            )
            .where(
                Memory.user_id == user.id,
                Memory.is_active.is_(True),
                Memory.embedding.is_not(None),
            )
            .order_by(
                Memory.embedding.cosine_distance(
                    embedding
                )
            )
            .limit(limit)
        ).all()

    def find_similar_memory(
        self,
        db: Session,
        user: User,
        embedding: list[float],
    ) -> tuple[Memory | None, float]:
        results = self.find_similar_memories(
            db=db,
            user=user,
            embedding=embedding,
            limit=1,
        )

        if not results:
            return None, 0.0

        memory, distance = results[0]

        similarity = (
            1.0 - float(distance)
        )

        return memory, similarity

    def merge_memory(
        self,
        db: Session,
        existing_memory: Memory,
        new_content: str,
        importance: float,
        confidence: float,
    ) -> Memory:
        if len(new_content) > len(
            existing_memory.content
        ):
            existing_memory.content = (
                new_content
            )

            existing_memory.embedding = (
                embedding_service.embed(
                    new_content
                )
            )

        existing_memory.importance_score = max(
            existing_memory.importance_score
            or 0.0,
            importance,
        )

        existing_memory.confidence_score = max(
            existing_memory.confidence_score
            or 0.0,
            confidence,
        )

        existing_memory.updated_at = (
            datetime.now(timezone.utc)
        )

        db.commit()
        db.refresh(existing_memory)

        return existing_memory

    async def create_automatic_memory(
        self,
        db: Session,
        user: User,
        candidate: dict,
        source_message_id=None,
    ) -> Memory | None:
        content = candidate.get("content")

        if not content:
            return None

        content = content.strip()

        if not self.is_valid_automatic_memory_content(
            content
        ):
            print(
                "REJECTED LOW-QUALITY OR "
                "UNGROUNDED AUTO MEMORY:",
                content,
            )
            return None

        allowed_types = {
            "semantic",
            "episodic",
            "preference",
            "goal",
            "procedural",
        }

        memory_type = candidate.get(
            "memory_type",
            "semantic",
        )

        if memory_type not in allowed_types:
            memory_type = "semantic"

        try:
            importance = float(
                candidate.get(
                    "importance_score",
                    0.5,
                )
            )
        except (TypeError, ValueError):
            importance = 0.5

        try:
            confidence = float(
                candidate.get(
                    "confidence_score",
                    0.7,
                )
            )
        except (TypeError, ValueError):
            confidence = 0.7

        importance = max(
            0.0,
            min(1.0, importance),
        )

        confidence = max(
            0.0,
            min(1.0, confidence),
        )

        embedding = embedding_service.embed(
            content
        )

        similar_memories = (
            self.find_similar_memories(
                db=db,
                user=user,
                embedding=embedding,
                limit=5,
            )
        )

        contradiction_matches = []
        duplicate_matches = []

        print(
            "\nMEMORY CANDIDATE:",
            content,
        )

        for existing_memory, distance in (
            similar_memories
        ):
            similarity = (
                1.0 - float(distance)
            )

            print(
                "CANDIDATE CHECK:",
                existing_memory.content,
                "| similarity=",
                f"{similarity:.3f}",
            )

            if similarity < 0.45:
                continue

            try:
                resolution = (
                    await memory_resolver.compare(
                        existing_memory=(
                            existing_memory.content
                        ),
                        new_memory=content,
                    )
                )

                relationship = resolution.get(
                    "relationship",
                    "unrelated",
                )

                try:
                    resolver_confidence = float(
                        resolution.get(
                            "confidence",
                            0.0,
                        )
                    )
                except (TypeError, ValueError):
                    resolver_confidence = 0.0

                print(
                    "MEMORY RESOLUTION:",
                    existing_memory.content,
                    "<->",
                    content,
                    "| relationship=",
                    relationship,
                    "| similarity=",
                    f"{similarity:.3f}",
                    "| confidence=",
                    f"{resolver_confidence:.3f}",
                )

                if (
                    relationship
                    == "contradiction"
                    and resolver_confidence >= 0.75
                ):
                    contradiction_matches.append(
                        (
                            existing_memory,
                            resolver_confidence,
                            similarity,
                        )
                    )

                elif (
                    relationship == "duplicate"
                    and resolver_confidence >= 0.75
                ):
                    duplicate_matches.append(
                        (
                            existing_memory,
                            resolver_confidence,
                            similarity,
                        )
                    )

            except Exception as exc:
                print(
                    "Memory resolver failed:",
                    exc,
                )

        contradiction_matches.sort(
            key=lambda item: (
                item[1],
                item[2],
            ),
            reverse=True,
        )

        duplicate_matches.sort(
            key=lambda item: (
                item[1],
                item[2],
            ),
            reverse=True,
        )

        for (
            contradictory_memory,
            _,
            _,
        ) in contradiction_matches:
            contradictory_memory.is_active = (
                False
            )

            print(
                "DEACTIVATING CONTRADICTED MEMORY:",
                contradictory_memory.content,
            )

        if duplicate_matches:
            (
                duplicate_memory,
                _,
                _,
            ) = duplicate_matches[0]

            print(
                "MERGING DUPLICATE MEMORY:",
                content,
                "->",
                duplicate_memory.content,
            )

            merged_memory = self.merge_memory(
                db=db,
                existing_memory=duplicate_memory,
                new_content=content,
                importance=importance,
                confidence=confidence,
            )

            for (
                contradictory_memory,
                _,
                _,
            ) in contradiction_matches:
                print(
                    "SUPERSEDED MEMORY:",
                    contradictory_memory.content,
                    "->",
                    merged_memory.content,
                )

            return merged_memory

        new_memory = Memory(
            user_id=user.id,
            source_message_id=source_message_id,
            memory_type=memory_type,
            content=content,
            embedding=embedding,
            importance_score=importance,
            confidence_score=confidence,
        )

        db.add(new_memory)
        db.commit()
        db.refresh(new_memory)

        if contradiction_matches:
            for (
                contradictory_memory,
                _,
                _,
            ) in contradiction_matches:
                print(
                    "SUPERSEDED MEMORY:",
                    contradictory_memory.content,
                    "->",
                    new_memory.content,
                )

        else:
            print(
                "CREATED NEW MEMORY:",
                new_memory.content,
            )

        return new_memory

    def cleanup_memories(
        self,
        db: Session,
        user: User,
    ) -> dict:
        memories = db.scalars(
            select(Memory)
            .where(
                Memory.user_id == user.id,
                Memory.is_active.is_(True),
            )
            .order_by(
                Memory.created_at.asc()
            )
        ).all()

        deactivated = 0
        merged = 0

        for memory in memories:
            if not memory.is_active:
                continue

            if not self.is_valid_memory_content(
                memory.content
            ):
                memory.is_active = False
                deactivated += 1
                continue

            if (
                memory.source_message_id is not None
                and not self.is_valid_automatic_memory_content(
                    memory.content
                )
            ):
                print(
                    "CLEANUP DEACTIVATING "
                    "UNGROUNDED AUTO MEMORY:",
                    memory.content,
                )
                memory.is_active = False
                deactivated += 1
                continue

            if memory.embedding is None:
                continue

            similar_memories = (
                self.find_similar_memories(
                    db=db,
                    user=user,
                    embedding=list(
                        memory.embedding
                    ),
                    limit=5,
                )
            )

            for other, distance in (
                similar_memories
            ):
                if other.id == memory.id:
                    continue

                if not other.is_active:
                    continue

                similarity = (
                    1.0 - float(distance)
                )

                if similarity < 0.90:
                    continue

                if (
                    len(other.content)
                    > len(memory.content)
                ):
                    memory.is_active = False

                    other.importance_score = max(
                        other.importance_score
                        or 0.0,
                        memory.importance_score
                        or 0.0,
                    )

                    other.confidence_score = max(
                        other.confidence_score
                        or 0.0,
                        memory.confidence_score
                        or 0.0,
                    )

                else:
                    other.is_active = False

                    memory.importance_score = max(
                        memory.importance_score
                        or 0.0,
                        other.importance_score
                        or 0.0,
                    )

                    memory.confidence_score = max(
                        memory.confidence_score
                        or 0.0,
                        other.confidence_score
                        or 0.0,
                    )

                merged += 1
                break

        db.commit()

        return {
            "deactivated": deactivated,
            "merged": merged,
        }


memory_service = MemoryService()