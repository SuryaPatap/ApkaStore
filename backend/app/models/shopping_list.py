from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base

if TYPE_CHECKING:
    from .customer import Customer
    from .shop import Shop
    from .shopping_list_item import ShoppingListItem


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
        default="PENDING",
        nullable=False,
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
    #
    # OCR is intentionally NOT used.
    # The image is stored as supporting information for
    # the shopkeeper.
    # ============================================================

    image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # ============================================================
    # ACTIVE
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

    customer: Mapped["Customer"] = relationship(
        "Customer",
        backref="shopping_lists",
    )

    shop: Mapped["Shop"] = relationship(
        "Shop",
        backref="shopping_lists",
    )

    items: Mapped[list["ShoppingListItem"]] = relationship(
        "ShoppingListItem",
        back_populates="shopping_list",
        cascade="all, delete-orphan",
    )