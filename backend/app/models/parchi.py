from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base

if TYPE_CHECKING:
    from .parchi_message import ParchiMessage


class Parchi(Base):
    """
    A Parchi is a conversation thread between ONE customer and ONE shop.
    There is at most one Parchi per (customer_id, shop_id) pair.
    """

    __tablename__ = "parchi_threads"

    # ============================================================
    # PRIMARY KEY
    # ============================================================

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    # ============================================================
    # FOREIGN KEYS
    # ============================================================

    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"),
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
    # TIMESTAMPS
    # ============================================================

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    # ============================================================
    # RELATIONSHIPS
    # ============================================================

    messages: Mapped[list["ParchiMessage"]] = relationship(
        "ParchiMessage",
        back_populates="parchi",
        cascade="all, delete-orphan",
        order_by="ParchiMessage.created_at",
    )

    # ============================================================
    # UNIQUE CONSTRAINT
    # ============================================================

    __table_args__ = (
        UniqueConstraint(
            "customer_id",
            "shop_id",
            name="uq_parchi_customer_shop",
        ),
    )
