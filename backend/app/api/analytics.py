from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
    get_db,
)
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.memory import Memory
from app.models.message import Message
from app.models.message_feedback import MessageFeedback
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsOverviewResponse,
)


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)


@router.get(
    "/overview",
    response_model=AnalyticsOverviewResponse,
)
def get_analytics_overview(
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        get_current_user
    ),
):
    total_conversations = (
        db.scalar(
            select(
                func.count(
                    Conversation.id
                )
            ).where(
                Conversation.user_id
                == current_user.id
            )
        )
        or 0
    )

    total_messages = (
        db.scalar(
            select(
                func.count(
                    Message.id
                )
            )
            .join(
                Conversation,
                Conversation.id
                == Message.conversation_id,
            )
            .where(
                Conversation.user_id
                == current_user.id
            )
        )
        or 0
    )

    active_memories = (
        db.scalar(
            select(
                func.count(
                    Memory.id
                )
            ).where(
                Memory.user_id
                == current_user.id,
                Memory.is_active.is_(True),
            )
        )
        or 0
    )

    total_documents = (
        db.scalar(
            select(
                func.count(
                    Document.id
                )
            ).where(
                Document.user_id
                == current_user.id
            )
        )
        or 0
    )

    feedback_total = (
        db.scalar(
            select(
                func.count(
                    MessageFeedback.id
                )
            ).where(
                MessageFeedback.user_id
                == current_user.id
            )
        )
        or 0
    )

    positive_feedback = (
        db.scalar(
            select(
                func.count(
                    MessageFeedback.id
                )
            ).where(
                MessageFeedback.user_id
                == current_user.id,
                MessageFeedback.rating
                == "positive",
            )
        )
        or 0
    )

    negative_feedback = (
        db.scalar(
            select(
                func.count(
                    MessageFeedback.id
                )
            ).where(
                MessageFeedback.user_id
                == current_user.id,
                MessageFeedback.rating
                == "negative",
            )
        )
        or 0
    )

    positive_feedback_rate = (
        positive_feedback
        / feedback_total
        if feedback_total
        else 0.0
    )

    return AnalyticsOverviewResponse(
        total_conversations=(
            total_conversations
        ),
        total_messages=(
            total_messages
        ),
        active_memories=(
            active_memories
        ),
        total_documents=(
            total_documents
        ),
        feedback_total=(
            feedback_total
        ),
        positive_feedback=(
            positive_feedback
        ),
        negative_feedback=(
            negative_feedback
        ),
        positive_feedback_rate=round(
            positive_feedback_rate,
            4,
        ),
    )