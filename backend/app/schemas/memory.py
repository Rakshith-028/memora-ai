import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MemoryCreate(BaseModel):
    content: str = Field(min_length=1)
    memory_type: str = Field(
        default="semantic",
        pattern="^(semantic|episodic|preference|goal|procedural)$",
    )
    importance_score: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
    )
    confidence_score: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
    )


class MemoryResponse(BaseModel):
    id: uuid.UUID
    memory_type: str
    content: str
    importance_score: float
    confidence_score: float
    access_count: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)