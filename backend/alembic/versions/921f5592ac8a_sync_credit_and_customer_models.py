"""sync credit and customer models

Revision ID: NEW_REVISION
Revises: 133a43de5cdd
Create Date: 2026-08-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "NEW_REVISION"
down_revision: Union[str, Sequence[str], None] = "133a43de5cdd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # ============================================================
    # REMOVE OLD CREDIT LEDGER
    # ============================================================

    op.drop_index(
        "ix_credit_ledger_customer_id",
        table_name="credit_ledger",
    )

    op.drop_index(
        "ix_credit_ledger_order_id",
        table_name="credit_ledger",
    )

    op.drop_index(
        "ix_credit_ledger_payment_reference",
        table_name="credit_ledger",
    )

    op.drop_index(
        "ix_credit_ledger_shop_id",
        table_name="credit_ledger",
    )

    op.drop_index(
        "ix_credit_ledger_status",
        table_name="credit_ledger",
    )

    op.drop_index(
        "ix_credit_ledger_transaction_type",
        table_name="credit_ledger",
    )

    op.drop_table("credit_ledger")


    # ============================================================
    # CREDIT ACCOUNTS
    # ============================================================

    op.add_column(
        "credit_accounts",
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default="PENDING",
        ),
    )

    op.create_index(
        "ix_credit_accounts_status",
        "credit_accounts",
        ["status"],
        unique=False,
    )

    op.create_unique_constraint(
        "uq_credit_account_customer_shop",
        "credit_accounts",
        ["customer_id", "shop_id"],
    )


    # ============================================================
    # CREDIT PAYMENTS
    # ============================================================

    # Preserve old data by renaming old columns
    # instead of dropping them.

    op.alter_column(
        "credit_payments",
        "reference_number",
        new_column_name="payment_reference",
        existing_type=sa.String(length=100),
        existing_nullable=True,
    )

    op.alter_column(
        "credit_payments",
        "note",
        new_column_name="description",
        existing_type=sa.String(length=255),
        existing_nullable=True,
    )

    op.alter_column(
        "credit_payments",
        "payment_reference",
        type_=sa.String(length=150),
        existing_type=sa.String(length=100),
        existing_nullable=True,
    )

    op.add_column(
        "credit_payments",
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default="COMPLETED",
        ),
    )

    op.add_column(
        "credit_payments",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=True,
        ),
    )

    # Existing rows need updated_at.
    op.execute(
        """
        UPDATE credit_payments
        SET updated_at = created_at
        WHERE updated_at IS NULL
        """
    )

    op.alter_column(
        "credit_payments",
        "updated_at",
        nullable=False,
    )

    op.create_index(
        "ix_credit_payments_payment_method",
        "credit_payments",
        ["payment_method"],
        unique=False,
    )

    op.create_index(
        "ix_credit_payments_payment_reference",
        "credit_payments",
        ["payment_reference"],
        unique=True,
    )

    op.create_index(
        "ix_credit_payments_status",
        "credit_payments",
        ["status"],
        unique=False,
    )


    # ============================================================
    # CREDIT TRANSACTIONS
    # ============================================================

    op.add_column(
        "credit_transactions",
        sa.Column(
            "balance_after",
            sa.Numeric(precision=12, scale=2),
            nullable=True,
        ),
    )

    # Existing transactions need a balance.
    # IMPORTANT:
    # This is only a safe structural fallback.
    # If historical balance_after values are important,
    # calculate them from the transaction history instead.

    op.execute(
        """
        UPDATE credit_transactions
        SET balance_after = 0
        WHERE balance_after IS NULL
        """
    )

    op.alter_column(
        "credit_transactions",
        "balance_after",
        nullable=False,
    )

    op.add_column(
        "credit_transactions",
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default="POSTED",
        ),
    )

    op.add_column(
        "credit_transactions",
        sa.Column(
            "reference",
            sa.String(length=150),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_credit_transactions_reference",
        "credit_transactions",
        ["reference"],
        unique=False,
    )

    op.create_index(
        "ix_credit_transactions_status",
        "credit_transactions",
        ["status"],
        unique=False,
    )

    op.create_index(
        "ix_credit_transactions_transaction_type",
        "credit_transactions",
        ["transaction_type"],
        unique=False,
    )


    # ============================================================
    # CUSTOMERS
    # ============================================================

    op.alter_column(
        "customers",
        "name",
        type_=sa.String(length=150),
        existing_type=sa.String(length=100),
        existing_nullable=False,
    )

    # Existing non-unique phone index
    op.drop_index(
        "ix_customers_phone",
        table_name="customers",
    )

    op.create_index(
        "ix_customers_phone",
        "customers",
        ["phone"],
        unique=True,
    )

    op.create_index(
        "ix_customers_email",
        "customers",
        ["email"],
        unique=True,
    )

    # Remove old indexes
    op.drop_index(
        "ix_customers_address_id",
        table_name="customers",
    )

    op.drop_index(
        "ix_customers_user_id",
        table_name="customers",
    )

    # Remove old foreign keys
    op.drop_constraint(
        "customers_user_id_fkey",
        "customers",
        type_="foreignkey",
    )

    op.drop_constraint(
        "customers_address_id_fkey",
        "customers",
        type_="foreignkey",
    )

    # Remove old columns
    op.drop_column(
        "customers",
        "is_active",
    )

    op.drop_column(
        "customers",
        "user_id",
    )

    op.drop_column(
        "customers",
        "address_id",
    )


    # ============================================================
    # MONTHLY SETTLEMENTS
    # ============================================================

    op.create_index(
        "ix_monthly_settlements_status",
        "monthly_settlements",
        ["status"],
        unique=False,
    )


def downgrade() -> None:

    # ============================================================
    # MONTHLY SETTLEMENTS
    # ============================================================

    op.drop_index(
        "ix_monthly_settlements_status",
        table_name="monthly_settlements",
    )


    # ============================================================
    # CUSTOMERS
    # ============================================================

    op.add_column(
        "customers",
        sa.Column(
            "address_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.add_column(
        "customers",
        sa.Column(
            "user_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.add_column(
        "customers",
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=True,
        ),
    )

    op.drop_index(
        "ix_customers_email",
        table_name="customers",
    )

    op.drop_index(
        "ix_customers_phone",
        table_name="customers",
    )

    op.create_index(
        "ix_customers_phone",
        "customers",
        ["phone"],
        unique=False,
    )

    op.alter_column(
        "customers",
        "name",
        type_=sa.String(length=100),
        existing_type=sa.String(length=150),
        existing_nullable=False,
    )


    # ============================================================
    # CREDIT TRANSACTIONS
    # ============================================================

    op.drop_index(
        "ix_credit_transactions_transaction_type",
        table_name="credit_transactions",
    )

    op.drop_index(
        "ix_credit_transactions_status",
        table_name="credit_transactions",
    )

    op.drop_index(
        "ix_credit_transactions_reference",
        table_name="credit_transactions",
    )

    op.drop_column(
        "credit_transactions",
        "reference",
    )

    op.drop_column(
        "credit_transactions",
        "status",
    )

    op.drop_column(
        "credit_transactions",
        "balance_after",
    )


    # ============================================================
    # CREDIT PAYMENTS
    # ============================================================

    op.drop_index(
        "ix_credit_payments_status",
        table_name="credit_payments",
    )

    op.drop_index(
        "ix_credit_payments_payment_reference",
        table_name="credit_payments",
    )

    op.drop_index(
        "ix_credit_payments_payment_method",
        table_name="credit_payments",
    )

    op.drop_column(
        "credit_payments",
        "updated_at",
    )

    op.drop_column(
        "credit_payments",
        "status",
    )

    op.alter_column(
        "credit_payments",
        "payment_reference",
        new_column_name="reference_number",
        existing_type=sa.String(length=150),
        existing_nullable=True,
    )

    op.alter_column(
        "credit_payments",
        "description",
        new_column_name="note",
        existing_type=sa.String(length=255),
        existing_nullable=True,
    )


    # ============================================================
    # CREDIT ACCOUNTS
    # ============================================================

    op.drop_constraint(
        "uq_credit_account_customer_shop",
        "credit_accounts",
        type_="unique",
    )

    op.drop_index(
        "ix_credit_accounts_status",
        table_name="credit_accounts",
    )

    op.drop_column(
        "credit_accounts",
        "status",
    )


    # ============================================================
    # CREDIT LEDGER
    # ============================================================

    # Only restore this if you actually need the old table.
    # The original migration that created it should be used
    # as the source for its exact schema.