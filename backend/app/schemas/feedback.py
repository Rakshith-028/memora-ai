import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


FeedbackRating = Literal[
    "positive",
    "negative",
]


class MessageFeedbackUpsert(BaseModel):
    rating: FeedbackRating

    reason: str | None = Field(
        default=None,
        max_length=64,
    )

    comment: str | None = Field(
        default=None,
        max_length=1000,
    )


class MessageFeedbackResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: uuid.UUID
    user_id: uuid.UUID
    message_id: uuid.UUID
    rating: FeedbackRating
    reason: str | None
    comment: str | None
    created_at: datetime
    updated_at: datetime


class FeedbackSummaryResponse(BaseModel):
    total: int
    positive: int
    negative: int
    positive_rate: float
