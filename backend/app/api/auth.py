from datetime import (
    datetime,
    timedelta,
    timezone,
)
from urllib.parse import quote

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import (
    select,
    update,
)
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
    get_db,
)
from app.core.config import settings
from app.core.rate_limit import (
    enforce_rate_limit,
)
from app.core.security import (
    create_access_token,
    generate_auth_token,
    hash_auth_token,
    hash_password,
    verify_password,
)
from app.models.auth_token import AuthToken
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    GoogleLoginRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.schemas.user import UserResponse
from app.services.email_service import (
    email_service,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


EMAIL_VERIFICATION_HOURS = 24
PASSWORD_RESET_MINUTES = 30

PURPOSE_EMAIL_VERIFICATION = (
    "email_verification"
)
PURPOSE_PASSWORD_RESET = (
    "password_reset"
)


def _now() -> datetime:
    return datetime.now(
        timezone.utc
    )


def _issue_auth_token(
    db: Session,
    user: User,
    purpose: str,
    expires_delta: timedelta,
) -> str:
    now = _now()

    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id
            == user.id,
            AuthToken.purpose
            == purpose,
            AuthToken.used_at.is_(
                None
            ),
        )
        .values(
            used_at=now
        )
    )

    raw_token = (
        generate_auth_token()
    )

    token = AuthToken(
        user_id=user.id,
        token_hash=hash_auth_token(
            raw_token
        ),
        purpose=purpose,
        expires_at=(
            now
            + expires_delta
        ),
    )

    db.add(token)

    return raw_token


def _get_valid_auth_token(
    db: Session,
    raw_token: str,
    purpose: str,
) -> AuthToken:
    token_hash = hash_auth_token(
        raw_token
    )

    token = db.scalar(
        select(AuthToken).where(
            AuthToken.token_hash
            == token_hash,
            AuthToken.purpose
            == purpose,
            AuthToken.used_at.is_(
                None
            ),
        )
    )

    if token is None:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Invalid or expired token"
            ),
        )

    if token.expires_at <= _now():
        token.used_at = _now()

        db.commit()

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Invalid or expired token"
            ),
        )

    return token


def _send_verification_email(
    user: User,
    raw_token: str,
) -> None:
    encoded_token = quote(
        raw_token,
        safe="",
    )

    frontend_url = (
        settings.frontend_url.rstrip(
            "/"
        )
    )

    verification_url = (
        f"{frontend_url}"
        "/verify-email"
        f"?token={encoded_token}"
    )

    body = (
        f"Hi "
        f"{user.display_name or 'there'},\n\n"
        "Verify your Memora AI email address "
        "using the link below:\n\n"
        f"{verification_url}\n\n"
        "This link expires in 24 hours.\n\n"
        "If you did not create this account, "
        "you can ignore this email."
    )

    email_service.send(
        to_email=user.email,
        subject=(
            "Verify your Memora AI email"
        ),
        body=body,
    )


def _send_password_reset_email(
    user: User,
    raw_token: str,
) -> None:
    encoded_token = quote(
        raw_token,
        safe="",
    )

    frontend_url = (
        settings.frontend_url.rstrip(
            "/"
        )
    )

    reset_url = (
        f"{frontend_url}"
        "/reset-password"
        f"?token={encoded_token}"
    )

    body = (
        f"Hi "
        f"{user.display_name or 'there'},\n\n"
        "A password reset was requested "
        "for your Memora AI account.\n\n"
        f"{reset_url}\n\n"
        "This link expires in 30 minutes.\n\n"
        "If you did not request this, "
        "you can ignore this email."
    )

    email_service.send(
        to_email=user.email,
        subject=(
            "Reset your Memora AI password"
        ),
        body=body,
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=(
        status.HTTP_201_CREATED
    ),
)
def register(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    email = (
        str(payload.email)
        .strip()
        .lower()
    )

    enforce_rate_limit(
        request=request,
        action="register",
        limit=5,
        window_seconds=900,
        identifier=email,
    )

    existing_user = db.scalar(
        select(User).where(
            User.email == email
        )
    )

    if existing_user:
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Email already registered"
            ),
        )

    display_name = (
        payload.display_name.strip()
        if payload.display_name
        else None
    )

    user = User(
        email=email,
        display_name=display_name,
        password_hash=hash_password(
            payload.password
        ),
        is_active=True,
        is_email_verified=False,
    )

    db.add(user)
    db.flush()

    raw_token = _issue_auth_token(
        db=db,
        user=user,
        purpose=(
            PURPOSE_EMAIL_VERIFICATION
        ),
        expires_delta=timedelta(
            hours=(
                EMAIL_VERIFICATION_HOURS
            )
        ),
    )

    db.commit()
    db.refresh(user)

    try:
        _send_verification_email(
            user=user,
            raw_token=raw_token,
        )
    except Exception as exc:
        print(
            "VERIFICATION EMAIL ERROR:",
            exc,
        )

    return user


@router.post(
    "/verify-email",
    response_model=MessageResponse,
)
def verify_email(
    payload: VerifyEmailRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(
        request=request,
        action="verify-email",
        limit=10,
        window_seconds=900,
        identifier=payload.token,
    )

    token = _get_valid_auth_token(
        db=db,
        raw_token=payload.token,
        purpose=(
            PURPOSE_EMAIL_VERIFICATION
        ),
    )

    user = db.get(
        User,
        token.user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Invalid or expired token"
            ),
        )

    now = _now()

    user.is_email_verified = True
    user.email_verified_at = now
    token.used_at = now

    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id
            == user.id,
            AuthToken.purpose
            == PURPOSE_EMAIL_VERIFICATION,
            AuthToken.used_at.is_(
                None
            ),
        )
        .values(
            used_at=now
        )
    )

    db.commit()

    return MessageResponse(
        message=(
            "Email verified successfully."
        )
    )


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
)
def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    email = (
        str(payload.email)
        .strip()
        .lower()
    )

    enforce_rate_limit(
        request=request,
        action="resend-verification",
        limit=3,
        window_seconds=3600,
        identifier=email,
    )

    user = db.scalar(
        select(User).where(
            User.email == email
        )
    )

    if (
        user is not None
        and user.is_active
        and not user.is_email_verified
    ):
        raw_token = _issue_auth_token(
            db=db,
            user=user,
            purpose=(
                PURPOSE_EMAIL_VERIFICATION
            ),
            expires_delta=timedelta(
                hours=(
                    EMAIL_VERIFICATION_HOURS
                )
            ),
        )

        db.commit()

        try:
            _send_verification_email(
                user=user,
                raw_token=raw_token,
            )
        except Exception as exc:
            print(
                "VERIFICATION EMAIL ERROR:",
                exc,
            )

    return MessageResponse(
        message=(
            "If the account exists and "
            "requires verification, a new "
            "verification email has been sent."
        )
    )


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    email = (
        str(payload.email)
        .strip()
        .lower()
    )

    enforce_rate_limit(
        request=request,
        action="login",
        limit=10,
        window_seconds=600,
        identifier=email,
    )

    user = db.scalar(
        select(User).where(
            User.email == email
        )
    )

    if (
        user is None
        or not verify_password(
            payload.password,
            user.password_hash,
        )
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Invalid email or password"
            ),
        )

    if not user.is_active:
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail="Account is inactive",
        )

    if not user.is_email_verified:
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "Email verification required"
            ),
        )

    token = create_access_token(
        subject=str(user.id)
    )

    return TokenResponse(
        access_token=token,
    )


@router.post(
    "/google",
    response_model=TokenResponse,
)
def google_login(
    payload: GoogleLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(
        request=request,
        action="google-login",
        limit=20,
        window_seconds=600,
    )

    if not settings.google_client_id:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "Google authentication is not configured"
            ),
        )

    try:
        claims = (
            google_id_token.verify_oauth2_token(
                payload.credential,
                google_requests.Request(),
                settings.google_client_id,
            )
        )
    except Exception:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Invalid Google credential"
            ),
        )

    google_sub = claims.get(
        "sub"
    )
    raw_email = claims.get(
        "email"
    )
    email_verified = bool(
        claims.get(
            "email_verified"
        )
    )

    if (
        not isinstance(
            google_sub,
            str,
        )
        or not google_sub
        or not isinstance(
            raw_email,
            str,
        )
        or not raw_email
        or not email_verified
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Google account email is not verified"
            ),
        )

    email = (
        raw_email
        .strip()
        .lower()
    )

    user = db.scalar(
        select(User).where(
            User.google_sub
            == google_sub
        )
    )

    if user is None:
        user = db.scalar(
            select(User).where(
                User.email == email
            )
        )

        if user is None:
            raw_name = claims.get(
                "name"
            )

            display_name = (
                raw_name.strip()[:120]
                if isinstance(
                    raw_name,
                    str,
                )
                and raw_name.strip()
                else None
            )

            user = User(
                email=email,
                display_name=display_name,
                password_hash=None,
                is_active=True,
                is_email_verified=True,
                email_verified_at=_now(),
                google_sub=google_sub,
            )

            db.add(user)
            db.commit()
            db.refresh(user)

        else:
            if (
                user.google_sub is not None
                and user.google_sub
                != google_sub
            ):
                raise HTTPException(
                    status_code=(
                        status.HTTP_409_CONFLICT
                    ),
                    detail=(
                        "This email is linked to another Google account"
                    ),
                )

            user.google_sub = google_sub

            if not user.is_email_verified:
                user.is_email_verified = True
                user.email_verified_at = (
                    _now()
                )

            db.commit()
            db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "Account is inactive"
            ),
        )

    token = create_access_token(
        subject=str(user.id)
    )

    return TokenResponse(
        access_token=token,
    )


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    email = (
        str(payload.email)
        .strip()
        .lower()
    )

    enforce_rate_limit(
        request=request,
        action="forgot-password",
        limit=5,
        window_seconds=3600,
        identifier=email,
    )

    user = db.scalar(
        select(User).where(
            User.email == email
        )
    )

    if (
        user is not None
        and user.is_active
        and user.password_hash
        is not None
    ):
        raw_token = _issue_auth_token(
            db=db,
            user=user,
            purpose=(
                PURPOSE_PASSWORD_RESET
            ),
            expires_delta=timedelta(
                minutes=(
                    PASSWORD_RESET_MINUTES
                )
            ),
        )

        db.commit()

        try:
            _send_password_reset_email(
                user=user,
                raw_token=raw_token,
            )
        except Exception as exc:
            print(
                "PASSWORD RESET EMAIL ERROR:",
                exc,
            )

    return MessageResponse(
        message=(
            "If an account exists for that "
            "email, a password reset link "
            "has been sent."
        )
    )


@router.post(
    "/reset-password",
    response_model=MessageResponse,
)
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(
        request=request,
        action="reset-password",
        limit=5,
        window_seconds=900,
        identifier=payload.token,
    )

    token = _get_valid_auth_token(
        db=db,
        raw_token=payload.token,
        purpose=(
            PURPOSE_PASSWORD_RESET
        ),
    )

    user = db.get(
        User,
        token.user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Invalid or expired token"
            ),
        )

    now = _now()

    user.password_hash = (
        hash_password(
            payload.new_password
        )
    )

    if not user.is_email_verified:
        user.is_email_verified = True
        user.email_verified_at = now

    token.used_at = now

    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id
            == user.id,
            AuthToken.purpose
            == PURPOSE_PASSWORD_RESET,
            AuthToken.used_at.is_(
                None
            ),
        )
        .values(
            used_at=now
        )
    )

    db.commit()

    return MessageResponse(
        message=(
            "Password reset successfully."
        )
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_me(
    current_user: User = Depends(
        get_current_user
    ),
):
    return current_user
