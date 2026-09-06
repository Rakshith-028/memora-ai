import uuid

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.document_search import (
    document_search_service,
)


class DocumentSearchTool:
    name = "document_search"

    description = (
        "Searches the authenticated user's "
        "indexed documents using hybrid retrieval."
    )

    def execute(
        self,
        db: Session,
        user: User,
        query: str,
        limit: int = 5,
        document_id: str | None = None,
    ) -> dict:
        query = query.strip()

        if not query:
            raise ValueError(
                "Search query is required."
            )

        limit = max(
            1,
            min(
                int(limit),
                10,
            ),
        )

        parsed_document_id = None

        if document_id:
            try:
                parsed_document_id = (
                    uuid.UUID(
                        document_id
                    )
                )

            except ValueError:
                raise ValueError(
                    "Invalid document ID."
                )

        matches = (
            document_search_service.search(
                db=db,
                user=user,
                query=query,
                limit=limit,
                document_id=(
                    parsed_document_id
                ),
            )
        )

        return {
            "query": query,
            "matches": matches,
            "match_count": len(
                matches
            ),
        }


document_search_tool = (
    DocumentSearchTool()
)