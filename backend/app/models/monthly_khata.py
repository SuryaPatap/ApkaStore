from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base


class MonthlyKhata(Base):
    __tablename__ = "monthly_khata"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    year: Mapped[int] = mapped_column(
        nullable=False
    )

    month: Mapped[int] = mapped_column(
        nullable=False
    )

    total_purchases: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False
    )

    total_payments: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False
    )

    outstanding_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    shop = relationship(
        "Shop",
        backref="monthly_khatas"
    )

    customer = relationship(
        "Customer",
        backref="monthly_khatas"
    )

    __table_args__ = (
        UniqueConstraint(
            "shop_id",
            "customer_id",
            "year",
            "month",
            name="uq_shop_customer_month"
        ),
    )