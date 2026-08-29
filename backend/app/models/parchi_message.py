from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base

if TYPE_CHECKING:
    from .parchi import Parchi


class ParchiMessage(Base):
    """
    A single message inside a Parchi conversation thread.

    message_type values:
      TEXT            - plain chat message
      ORDER_REQUEST   - customer requested an order through Parchi
      ORDER_CONFIRMED - shopkeeper confirmed the Parchi order
      ORDER_DECLINED  - shopkeeper declined the Parchi order
      STATUS_UPDATE   - order status changed (system message)
    """

    __tablename__ = "parchi_messages"

    # ============================================================
    # PRIMARY KEY
    # ============================================================

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    # ============================================================
    # THREAD REFERENCE
    # ============================================================

    parchi_id: Mapped[int] = mapped_column(
        ForeignKey("parchi_threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ============================================================
    # SENDER
    # ============================================================

    sender_role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        # "CUSTOMER" | "SHOPKEEPER" | "SYSTEM"
    )

    # ============================================================
    # MESSAGE TYPE & CONTENT
    # ============================================================

    message_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="TEXT",
        # TEXT | ORDER_REQUEST | ORDER_CONFIRMED | ORDER_DECLINED | STATUS_UPDATE
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # ============================================================
    # LINKED ORDER (optional)
    # ============================================================

    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ============================================================
    # PRODUCT SNAPSHOT (JSON string for ORDER_REQUEST)
    # e.g. '[{"product_id": 5, "name": "Atta", "qty": 2, "price": 45.0}]'
    # ============================================================

    product_snapshot: Mapped[str | None] = mapped_column(
        Text,
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

    # ============================================================
    # RELATIONSHIPS
    # ============================================================

    parchi: Mapped["Parchi"] = relationship(
        "Parchi",
        back_populates="messages",
    )
