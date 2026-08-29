from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base

if TYPE_CHECKING:
    from .user import User
    from .address import Address
    from .shop_customer import ShopCustomer


class Shop(Base):
    __tablename__ = "shops"

    # ============================================================
    # PRIMARY KEY
    # ============================================================

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    # ============================================================
    # OWNER
    # ============================================================

    owner_user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # ============================================================
    # SHOP INFORMATION
    # ============================================================

    shop_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    shop_phone: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    address_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "addresses.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    shop_category: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    gst_number: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        unique=True,
    )

    upi_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
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
    # OWNER RELATIONSHIP
    # ============================================================

    owner: Mapped["User"] = relationship(
        "User",
        back_populates="shops",
    )

    # ============================================================
    # ADDRESS RELATIONSHIP
    # ============================================================

    address: Mapped["Address | None"] = relationship(
        "Address",
        back_populates="shops",
    )

    # ============================================================
    # CUSTOMER LINKS
    # ============================================================

    customer_links: Mapped[list["ShopCustomer"]] = relationship(
        "ShopCustomer",
        back_populates="shop",
        cascade="all, delete-orphan",
    )