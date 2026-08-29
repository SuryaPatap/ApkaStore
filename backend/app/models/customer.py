from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base

if TYPE_CHECKING:
    from .user import User
    from .address import Address
    from .shop_customer import ShopCustomer


class Customer(Base):
    __tablename__ = "customers"

    # ============================================================
    # PRIMARY KEY
    # ============================================================

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    # ============================================================
    # USER
    # ============================================================

    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
        index=True,
    )

    # ============================================================
    # CUSTOMER NAME
    # ============================================================

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    # ============================================================
    # PHONE
    # ============================================================

    phone: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        unique=True,
        index=True,
    )

    # ============================================================
    # EMAIL
    # ============================================================

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        index=True,
    )

    # ============================================================
    # ADDRESS
    # ============================================================

    address_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "addresses.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
        # ============================================================
    # STATUS
    # ============================================================

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
        server_default="true",
        index=True,
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
    # USER RELATIONSHIP
    # ============================================================

    user: Mapped["User"] = relationship(
        "User",
        back_populates="customer_profile",
    )

    # ============================================================
    # ADDRESS RELATIONSHIP
    # ============================================================

    address: Mapped["Address | None"] = relationship(
        "Address",
        back_populates="customers",
    )

    # ============================================================
    # SHOP RELATIONSHIPS
    # ============================================================

    shop_links: Mapped[list["ShopCustomer"]] = relationship(
        "ShopCustomer",
        back_populates="customer",
        cascade="all, delete-orphan",
    )