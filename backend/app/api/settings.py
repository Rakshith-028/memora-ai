from datetime import (
    datetime,
    timezone,
)

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
    get_db,
)
from app.core.security import (
    hash_password,
    verify_password,
)
from app.models.auth_token import AuthToken
from app.models.user import User
from app.schemas.settings import (
    ChangePasswordRequest,
    ProfileUpdateRequest,
    SettingsAccountResponse,
    SettingsMessageResponse,
)


router = APIRouter(
    prefix="/settings",
    tags=["Settings"],
)


def _account_response(
    user: User,
) -> SettingsAccountResponse:
    return SettingsAccountResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        is_active=user.is_active,
        is_email_verified=(
            user.is_email_verified
        ),
        has_password=(
            user.password_hash
            is not None
        ),
        google_connected=(
            user.google_sub
            is not None
        ),
        created_at=user.created_at,
    )


@router.get(
    "/account",
    response_model=SettingsAccountResponse,
)
def get_account_settings(
    current_user: User = Depends(
        get_current_user
    ),
):
    return _account_response(
        current_user
    )


@router.patch(
    "/account",
    response_model=SettingsAccountResponse,
)
def update_account_settings(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    fields = payload.model_fields_set

    if "display_name" in fields:
        if payload.display_name is None:
            current_user.display_name = None
        else:
            cleaned_name = (
                payload.display_name.strip()
            )

            current_user.display_name = (
                cleaned_name
                if cleaned_name
                else None
            )

    db.commit()
    db.refresh(current_user)

    return _account_response(
        current_user
    )


@router.post(
    "/password",
    response_model=SettingsMessageResponse,
)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    if (
        current_user.password_hash
        is not None
    ):
        if (
            not payload.current_password
            or not verify_password(
                payload.current_password,
                current_user.password_hash,
            )
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    "Current password is incorrect"
                ),
            )

    current_user.password_hash = (
        hash_password(
            payload.new_password
        )
    )

    now = datetime.now(
        timezone.utc
    )

    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id
            == current_user.id,
            AuthToken.purpose
            == "password_reset",
            AuthToken.used_at.is_(None),
        )
        .values(
            used_at=now
        )
    )

    db.commit()

    return SettingsMessageResponse(
        message=(
            "Password updated successfully."
        )
    )