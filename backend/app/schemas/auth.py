from pydantic import (
    BaseModel,
    EmailStr,
    Field,
)


class RegisterRequest(BaseModel):
    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    display_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=120,
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str = Field(
        min_length=50,
        max_length=4096,
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class VerifyEmailRequest(BaseModel):
    token: str = Field(
        min_length=20,
        max_length=512,
    )


class ResendVerificationRequest(
    BaseModel
):
    email: EmailStr


class ForgotPasswordRequest(
    BaseModel
):
    email: EmailStr


class ResetPasswordRequest(
    BaseModel
):
    token: str = Field(
        min_length=20,
        max_length=512,
    )

    new_password: str = Field(
        min_length=8,
        max_length=128,
    )


class MessageResponse(BaseModel):
    message: str
