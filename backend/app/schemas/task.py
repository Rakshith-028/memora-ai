import uuid
from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


TaskStatus = Literal[
    "pending",
    "in_progress",
    "completed",
]

TaskPriority = Literal[
    "low",
    "medium",
    "high",
]


class TaskCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    status: TaskStatus = "pending"

    priority: TaskPriority = "medium"

    due_at: datetime | None = None

    source_conversation_id: (
        uuid.UUID | None
    ) = None


class TaskUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    status: TaskStatus | None = None

    priority: TaskPriority | None = None

    due_at: datetime | None = None

    source_conversation_id: (
        uuid.UUID | None
    ) = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: uuid.UUID
    user_id: uuid.UUID

    source_conversation_id: (
        uuid.UUID | None
    )

    title: str
    description: str | None

    status: TaskStatus
    priority: TaskPriority

    due_at: datetime | None

    created_at: datetime
    updated_at: datetime