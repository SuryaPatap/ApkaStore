from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base


class CreditLedger(Base):
    __tablename__ = "credit_ledger"

    # ============================================================
    # PRIMARY KEY
    # ============================================================

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    # ============================================================
    # CUSTOMER
    # ============================================================

    customer_id: Mapped[int] = mapped_column(
        ForeignKey(
            "customers.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # ============================================================
    # SHOP
    # ============================================================

    shop_id: Mapped[int] = mapped_column(
        ForeignKey(
            "shops.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # ============================================================
    # ORDER
    # ============================================================
    #
    # NULL for payments/adjustments that are not directly
    # connected to an order.
    #

    order_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "orders.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # ============================================================
    # TRANSACTION TYPE
    # ============================================================
    #
    # CREDIT_PURCHASE
    # PAYMENT
    # ADJUSTMENT
    #

    transaction_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )

    # ============================================================
    # AMOUNT
    # ============================================================

    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    # ============================================================
    # BALANCE AFTER TRANSACTION
    # ============================================================
    #
    # Example:
    #
    # Purchase ₹500  -> balance_after = ₹500
    # Purchase ₹300  -> balance_after = ₹800
    # Payment ₹400   -> balance_after = ₹400
    #

    balance_after: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    # ============================================================
    # STATUS
    # ============================================================

    status: Mapped[str] = mapped_column(
        String(30),
        default="POSTED",
        nullable=False,
        index=True,
    )

    # ============================================================
    # DESCRIPTION
    # ============================================================

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # ============================================================
    # PAYMENT REFERENCE
    # ============================================================
    #
    # Useful later for UPI/payment gateway transaction IDs.
    #

    payment_reference: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
        index=True,
    )

    # ============================================================
    # DUE DATE
    # ============================================================

    due_date: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    # ============================================================
    # TIMESTAMPS
    # ============================================================

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # ============================================================
    # RELATIONSHIPS
    # ============================================================

    customer = relationship(
        "Customer",
        backref="credit_ledger_entries",
    )

    shop = relationship(
        "Shop",
        backref="credit_ledger_entries",
    )

    order = relationship(
        "Order",
        backref="credit_ledger_entries",
    )