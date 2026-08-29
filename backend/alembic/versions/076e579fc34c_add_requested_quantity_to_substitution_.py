"""add requested quantity to substitution requests

Revision ID: 076e579fc34c
Revises: 9ed7b67af3fa
Create Date: 2026-08-23
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "076e579fc34c"
down_revision = "9ed7b67af3fa"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add column as nullable because existing rows already exist.
    op.add_column(
        "substitution_requests",
        sa.Column(
            "requested_quantity",
            sa.Integer(),
            nullable=True,
        ),
    )

    # 2. Populate existing records from the related order item.
    op.execute(
        """
        UPDATE substitution_requests AS sr
        SET requested_quantity = oi.quantity
        FROM order_items AS oi
        WHERE sr.order_item_id = oi.id
        """
    )

    # 3. Make it NOT NULL after all existing records have a value.
    op.alter_column(
        "substitution_requests",
        "requested_quantity",
        existing_type=sa.Integer(),
        nullable=False,
    )


def downgrade() -> None:
    op.drop_column(
        "substitution_requests",
        "requested_quantity",
    )