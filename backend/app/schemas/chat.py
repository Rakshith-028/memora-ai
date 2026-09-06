import uuid

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    conversation_id: uuid.UUID
    message: str = Field(min_length=1)


class ChatResponse(BaseModel):
    conversation_id: uuid.UUID
    user_message: str
    assistant_message: str
    assistant_message_id: uuid.UUID
