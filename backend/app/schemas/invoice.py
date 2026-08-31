from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class InvoiceItemBase(BaseModel):
    product_id: Optional[int] = None
    product_name: str
    unit: str = '1 unit'
    quantity: int = 1
    unit_price: Decimal
    total_price: Decimal

class InvoiceItemCreate(InvoiceItemBase):
    pass

class InvoiceItemResponse(InvoiceItemBase):
    id: int
    invoice_id: int

    model_config = ConfigDict(from_attributes=True)


class InvoiceBase(BaseModel):
    customer_id: Optional[int] = None
    customer_name: str = 'Walk-in Customer'
    customer_phone: Optional[str] = None
    subtotal_amount: Decimal
    discount_amount: Decimal = Decimal('0.00')
    tax_amount: Decimal = Decimal('0.00')
    total_amount: Decimal
    payment_method: str = 'CASH'
    payment_status: str = 'PAID'
    notes: Optional[str] = None

class InvoiceCreate(InvoiceBase):
    items: List[InvoiceItemCreate]

class InvoiceResponse(InvoiceBase):
    id: int
    shop_id: int
    invoice_number: str
    created_at: datetime
    items: List[InvoiceItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
