from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base


class CreditAccount(Base):
    __tablename__ = "credit_accounts"

    __table_args__ = (
        UniqueConstraint(
            "customer_id",
            "shop_id",
            name="uq_credit_account_customer_shop",
        ),
    )

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
    # CREDIT LIMIT
    # ============================================================

    credit_limit: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    # ============================================================
    # OUTSTANDING AMOUNT
    # ============================================================

    outstanding_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    # ============================================================
    # STATUS
    # ============================================================

    # PENDING
    # APPROVED
    # REJECTED
    # SUSPENDED

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING",
        index=True,
    )

    # ============================================================
    # ACTIVE STATUS
    # ============================================================

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
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
        backref="credit_accounts",
    )

    shop = relationship(
        "Shop",
        backref="credit_accounts",
    )

    transactions = relationship(
        "CreditTransaction",
        back_populates="credit_account",
        cascade="all, delete-orphan",
    )

    payments = relationship(
        "CreditPayment",
        back_populates="credit_account",
        cascade="all, delete-orphan",
    )