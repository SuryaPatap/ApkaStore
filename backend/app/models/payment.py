from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base


class Payment(Base):
    __tablename__ = "payments"

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

    monthly_khata_id: Mapped[int | None] = mapped_column(
        ForeignKey("monthly_khata.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    payment_date: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )

    payment_method: Mapped[str] = mapped_column(
        String(30),
        nullable=False
    )

    reference_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    notes: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    shop = relationship(
        "Shop",
        backref="payments"
    )

    customer = relationship(
        "Customer",
        backref="payments"
    )

    monthly_khata = relationship(
        "MonthlyKhata",
        backref="payments"
    )