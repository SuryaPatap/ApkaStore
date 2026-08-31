from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..base import Base

class PurchaseInvoice(Base):
    __tablename__ = 'purchase_invoices'

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    shop_id: Mapped[int] = mapped_column(
        ForeignKey('shops.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    supplier_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    supplier_phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    invoice_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True
    )

    invoice_date: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    shop = relationship(
        'Shop',
        backref='purchase_invoices'
    )

    items = relationship(
        'PurchaseInvoiceItem',
        back_populates='invoice',
        cascade='all, delete-orphan'
    )


class PurchaseInvoiceItem(Base):
    __tablename__ = 'purchase_invoice_items'

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    invoice_id: Mapped[int] = mapped_column(
        ForeignKey('purchase_invoices.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    product_id: Mapped[int | None] = mapped_column(
        ForeignKey('products.id', ondelete='SET NULL'),
        nullable=True
    )

    product_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    category: Mapped[str] = mapped_column(
        String(100),
        default='Groceries',
        nullable=False
    )

    unit: Mapped[str] = mapped_column(
        String(50),
        default='1 unit',
        nullable=False
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False
    )

    purchase_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False
    )

    selling_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False
    )

    total_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False
    )

    invoice = relationship(
        'PurchaseInvoice',
        back_populates='items'
    )

    product = relationship(
        'Product'
    )
