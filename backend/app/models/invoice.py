from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..base import Base

class Invoice(Base):
    __tablename__ = 'invoices'

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    shop_id: Mapped[int] = mapped_column(
        ForeignKey('shops.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey('customers.id', ondelete='SET NULL'),
        nullable=True,
        index=True
    )

    invoice_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        index=True
    )

    customer_name: Mapped[str] = mapped_column(
        String(100),
        default='Walk-in Customer',
        nullable=False
    )

    customer_phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    subtotal_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False
    )

    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False
    )

    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False
    )

    payment_method: Mapped[str] = mapped_column(
        String(30),
        default='CASH',
        nullable=False
    )

    payment_status: Mapped[str] = mapped_column(
        String(30),
        default='PAID',
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
        backref='invoices'
    )

    customer = relationship(
        'Customer',
        backref='invoices'
    )

    items = relationship(
        'InvoiceItem',
        back_populates='invoice',
        cascade='all, delete-orphan'
    )


class InvoiceItem(Base):
    __tablename__ = 'invoice_items'

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    invoice_id: Mapped[int] = mapped_column(
        ForeignKey('invoices.id', ondelete='CASCADE'),
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

    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    total_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    invoice = relationship(
        'Invoice',
        back_populates='items'
    )

    product = relationship(
        'Product'
    )
