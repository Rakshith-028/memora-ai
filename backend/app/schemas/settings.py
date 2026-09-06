import uuid
from datetime import datetime

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
)


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(
        default=None,
        max_length=120,
    )


class ChangePasswordRequest(BaseModel):
    current_password: str | None = None

    new_password: str = Field(
        min_length=8,
        max_length=128,
    )


class SettingsAccountResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    display_name: str | None

    is_active: bool
    is_email_verified: bool

    has_password: bool
    google_connected: bool

    created_at: datetime


class SettingsMessageResponse(BaseModel):
    message: str