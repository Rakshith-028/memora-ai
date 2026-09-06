import uuid

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Response,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
    get_db,
)
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.message_feedback import (
    MessageFeedback,
)
from app.models.user import User
from app.schemas.feedback import (
    FeedbackSummaryResponse,
    MessageFeedbackResponse,
    MessageFeedbackUpsert,
)


router = APIRouter(
    prefix="/feedback",
    tags=["Feedback"],
)


def _get_owned_assistant_message(
    db: Session,
    current_user: User,
    message_id: uuid.UUID,
) -> Message:
    message = db.scalar(
        select(
            Message
        )
        .join(
            Conversation,
            Conversation.id
            == Message.conversation_id,
        )
        .where(
            Message.id
            == message_id,
            Conversation.user_id
            == current_user.id,
        )
    )

    if message is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Message not found",
        )

    if message.role != "assistant":
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Feedback can only be submitted "
                "for assistant messages"
            ),
        )

    return message


@router.get(
    "/summary",
    response_model=FeedbackSummaryResponse,
)
def get_feedback_summary(
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        get_current_user
    ),
):
    rows = db.execute(
        select(
            MessageFeedback.rating,
            func.count(
                MessageFeedback.id
            ),
        )
        .where(
            MessageFeedback.user_id
            == current_user.id
        )
        .group_by(
            MessageFeedback.rating
        )
    ).all()

    counts = {
        rating: int(count)
        for rating, count
        in rows
    }

    positive = counts.get(
        "positive",
        0,
    )

    negative = counts.get(
        "negative",
        0,
    )

    total = (
        positive
        + negative
    )

    positive_rate = (
        round(
            positive / total,
            4,
        )
        if total
        else 0.0
    )

    return FeedbackSummaryResponse(
        total=total,
        positive=positive,
        negative=negative,
        positive_rate=positive_rate,
    )


@router.get(
    "/conversation/{conversation_id}",
    response_model=list[MessageFeedbackResponse],
)
def get_conversation_feedback(
    conversation_id: uuid.UUID,
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        get_current_user
    ),
):
    conversation = db.scalar(
        select(
            Conversation
        ).where(
            Conversation.id
            == conversation_id,
            Conversation.user_id
            == current_user.id,
        )
    )

    if conversation is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Conversation not found",
        )

    feedback = db.scalars(
        select(
            MessageFeedback
        )
        .join(
            Message,
            Message.id
            == MessageFeedback.message_id,
        )
        .where(
            MessageFeedback.user_id
            == current_user.id,
            Message.conversation_id
            == conversation_id,
        )
        .order_by(
            MessageFeedback.created_at.asc()
        )
    ).all()

    return list(
        feedback
    )


@router.get(
    "/{message_id}",
    response_model=MessageFeedbackResponse,
)
def get_message_feedback(
    message_id: uuid.UUID,
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        get_current_user
    ),
):
    _get_owned_assistant_message(
        db=db,
        current_user=current_user,
        message_id=message_id,
    )

    feedback = db.scalar(
        select(
            MessageFeedback
        ).where(
            MessageFeedback.user_id
            == current_user.id,
            MessageFeedback.message_id
            == message_id,
        )
    )

    if feedback is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Feedback not found",
        )

    return feedback


@router.put(
    "/{message_id}",
    response_model=MessageFeedbackResponse,
)
def upsert_message_feedback(
    message_id: uuid.UUID,
    payload: MessageFeedbackUpsert,
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        get_current_user
    ),
):
    _get_owned_assistant_message(
        db=db,
        current_user=current_user,
        message_id=message_id,
    )

    feedback = db.scalar(
        select(
            MessageFeedback
        ).where(
            MessageFeedback.user_id
            == current_user.id,
            MessageFeedback.message_id
            == message_id,
        )
    )

    reason = (
        payload.reason.strip()
        if payload.reason
        else None
    )

    comment = (
        payload.comment.strip()
        if payload.comment
        else None
    )

    if feedback is None:
        feedback = MessageFeedback(
            user_id=current_user.id,
            message_id=message_id,
            rating=payload.rating,
            reason=reason,
            comment=comment,
        )

        db.add(
            feedback
        )

    else:
        feedback.rating = (
            payload.rating
        )

        feedback.reason = reason
        feedback.comment = comment

    db.commit()
    db.refresh(
        feedback
    )

    return feedback


@router.delete(
    "/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_message_feedback(
    message_id: uuid.UUID,
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        get_current_user
    ),
):
    _get_owned_assistant_message(
        db=db,
        current_user=current_user,
        message_id=message_id,
    )

    feedback = db.scalar(
        select(
            MessageFeedback
        ).where(
            MessageFeedback.user_id
            == current_user.id,
            MessageFeedback.message_id
            == message_id,
        )
    )

    if feedback is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Feedback not found",
        )

    db.delete(
        feedback
    )

    db.commit()

    return Response(
        status_code=(
            status.HTTP_204_NO_CONTENT
        )
    )
