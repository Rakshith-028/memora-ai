"""add production auth fields

Revision ID: 7e3af4d144ed
Revises: 38e11e4ffdfa
Create Date: 2026-09-06 15:30:03.200170
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7e3af4d144ed"
down_revision: Union[str, Sequence[str], None] = (
    "38e11e4ffdfa"
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "auth_tokens",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "token_hash",
            sa.String(length=64),
            nullable=False,
        ),
        sa.Column(
            "purpose",
            sa.String(length=32),
            nullable=False,
        ),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "used_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_auth_tokens_expires_at"),
        "auth_tokens",
        ["expires_at"],
        unique=False,
    )

    op.create_index(
        op.f("ix_auth_tokens_purpose"),
        "auth_tokens",
        ["purpose"],
        unique=False,
    )

    op.create_index(
        op.f("ix_auth_tokens_token_hash"),
        "auth_tokens",
        ["token_hash"],
        unique=True,
    )

    op.create_index(
        op.f("ix_auth_tokens_user_id"),
        "auth_tokens",
        ["user_id"],
        unique=False,
    )

    op.add_column(
        "users",
        sa.Column(
            "is_email_verified",
            sa.Boolean(),
            nullable=True,
        ),
    )

    op.add_column(
        "users",
        sa.Column(
            "email_verified_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "users",
        sa.Column(
            "google_sub",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE users
        SET
            is_email_verified = TRUE,
            email_verified_at = NOW()
        """
    )

    op.alter_column(
        "users",
        "is_email_verified",
        existing_type=sa.Boolean(),
        nullable=False,
    )

    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.VARCHAR(length=255),
        nullable=True,
    )

    op.create_index(
        op.f("ix_users_google_sub"),
        "users",
        ["google_sub"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_users_google_sub"),
        table_name="users",
    )

    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.VARCHAR(length=255),
        nullable=False,
    )

    op.drop_column(
        "users",
        "google_sub",
    )

    op.drop_column(
        "users",
        "email_verified_at",
    )

    op.drop_column(
        "users",
        "is_email_verified",
    )

    op.drop_index(
        op.f("ix_auth_tokens_user_id"),
        table_name="auth_tokens",
    )

    op.drop_index(
        op.f("ix_auth_tokens_token_hash"),
        table_name="auth_tokens",
    )

    op.drop_index(
        op.f("ix_auth_tokens_purpose"),
        table_name="auth_tokens",
    )

    op.drop_index(
        op.f("ix_auth_tokens_expires_at"),
        table_name="auth_tokens",
    )

    op.drop_table(
        "auth_tokens"
    )