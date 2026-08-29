from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base

if TYPE_CHECKING:
    from .customer import Customer
    from .shop import Shop


class Address(Base):
    __tablename__ = "addresses"

    # ============================================================
    # PRIMARY KEY
    # ============================================================

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    # ============================================================
    # ADDRESS FIELDS
    # ============================================================

    house_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    flat_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    building_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    sector: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    street: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    locality: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    landmark: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    city: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    district: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    state: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    pincode: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        index=True,
    )

    country: Mapped[str] = mapped_column(
        String(100),
        default="India",
        nullable=False,
    )

    latitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    longitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    normalized_address: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
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
    # CUSTOMER RELATIONSHIP
    # ============================================================

    customers: Mapped[list["Customer"]] = relationship(
        "Customer",
        back_populates="address",
    )

    # ============================================================
    # SHOP RELATIONSHIP
    # ============================================================

    shops: Mapped[list["Shop"]] = relationship(
        "Shop",
        back_populates="address",
    )