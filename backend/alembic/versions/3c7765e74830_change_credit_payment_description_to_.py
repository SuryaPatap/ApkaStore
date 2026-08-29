"""change credit payment description to text

Revision ID: YOUR_NEW_REVISION
Revises: NEW_REVISION
Create Date: 2026-08-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "YOUR_NEW_REVISION"
down_revision: Union[str, Sequence[str], None] = "NEW_REVISION"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "credit_payments",
        "description",
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "credit_payments",
        "description",
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=True,
    )