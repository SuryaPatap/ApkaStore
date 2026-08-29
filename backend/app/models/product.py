from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    String,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from ..base import Base


class Product(Base):
    __tablename__ = "products"

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
    # PRODUCT INFORMATION
    # ============================================================

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    category: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    unit: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    # ============================================================
    # PRICE
    # ============================================================

    price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
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
    # SHOP RELATIONSHIP
    # ============================================================

    shop = relationship(
        "Shop",
        backref="products",
    )

    # ============================================================
    # INVENTORY RELATIONSHIP
    # ============================================================

    inventory_items = relationship(
        "Inventory",
        back_populates="product",
        cascade="all, delete-orphan",
    )

    # ============================================================
    # ORDER ITEMS
    #
    # OrderItem currently uses:
    #
    #     product = relationship(
    #         "Product",
    #         backref="order_items",
    #     )
    #
    # Therefore this relationship does not need to be declared
    # here separately.
    # ============================================================