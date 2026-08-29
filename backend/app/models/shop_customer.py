from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base


class ShopCustomer(Base):
    __tablename__ = "shop_customers"

    # ============================================================
    # PRIMARY KEY
    # ============================================================

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
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
    # STATUS
    # ============================================================

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # ============================================================
    # DATES
    # ============================================================

    joined_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

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

    shop = relationship(
        "Shop",
        back_populates="customer_links",
    )

    customer = relationship(
        "Customer",
        back_populates="shop_links",
    )

    # ============================================================
    # CONSTRAINTS
    # ============================================================

    __table_args__ = (
        UniqueConstraint(
            "shop_id",
            "customer_id",
            name="uq_shop_customer",
        ),
    )