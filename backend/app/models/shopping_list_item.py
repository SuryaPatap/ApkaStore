from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base

if TYPE_CHECKING:
    from .customer import Customer
    from .shop import Shop
    from .product import Product


class ShoppingList(Base):
    __tablename__ = "shopping_lists"

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
    # STATUS
    # ============================================================

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING",
        index=True,
    )

    # ============================================================
    # CUSTOMER NOTE
    # ============================================================

    customer_note: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # ============================================================
    # IMAGE
    # ============================================================

    image_url: Mapped[str | None] = mapped_column(
        String(500),
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
    # CUSTOMER RELATIONSHIP
    # ============================================================

    customer: Mapped["Customer"] = relationship(
        "Customer",
        backref="shopping_lists",
    )

    # ============================================================
    # SHOP RELATIONSHIP
    # ============================================================

    shop: Mapped["Shop"] = relationship(
        "Shop",
        backref="shopping_lists",
    )

    # ============================================================
    # ITEMS
    # ============================================================

    items: Mapped[list["ShoppingListItem"]] = relationship(
        "ShoppingListItem",
        back_populates="shopping_list",
        cascade="all, delete-orphan",
    )


class ShoppingListItem(Base):
    __tablename__ = "shopping_list_items"

    # ============================================================
    # PRIMARY KEY
    # ============================================================

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    # ============================================================
    # SHOPPING LIST
    # ============================================================

    shopping_list_id: Mapped[int] = mapped_column(
        ForeignKey(
            "shopping_lists.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # ============================================================
    # PRODUCT
    # ============================================================

    product_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "products.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )

    # ============================================================
    # PRODUCT NAME
    # ============================================================

    product_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    # ============================================================
    # QUANTITY
    # ============================================================

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    # ============================================================
    # STATUS
    # ============================================================

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING",
        index=True,
    )

    # ============================================================
    # NOTES
    # ============================================================

    notes: Mapped[str | None] = mapped_column(
        String(500),
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

    shopping_list: Mapped["ShoppingList"] = relationship(
        "ShoppingList",
        back_populates="items",
    )

    product: Mapped["Product | None"] = relationship(
        "Product",
        backref="shopping_list_items",
    )