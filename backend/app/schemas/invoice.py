from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class PurchaseInvoiceItemBase(BaseModel):
    product_id: Optional[int] = None
    product_name: str
    category: str = 'Groceries'
    unit: str = '1 unit'
    quantity: int = 1
    purchase_price: Decimal = Decimal('0.00')
    selling_price: Decimal = Decimal('0.00')
    total_cost: Decimal = Decimal('0.00')

class PurchaseInvoiceItemCreate(PurchaseInvoiceItemBase):
    pass

class PurchaseInvoiceItemResponse(PurchaseInvoiceItemBase):
    id: int
    invoice_id: int

    model_config = ConfigDict(from_attributes=True)


class PurchaseInvoiceBase(BaseModel):
    supplier_name: str
    supplier_phone: Optional[str] = None
    invoice_number: str
    invoice_date: Optional[datetime] = None
    total_amount: Decimal = Decimal('0.00')
    notes: Optional[str] = None

class PurchaseInvoiceCreate(PurchaseInvoiceBase):
    items: List[PurchaseInvoiceItemCreate]

class PurchaseInvoiceResponse(PurchaseInvoiceBase):
    id: int
    shop_id: int
    created_at: datetime
    items: List[PurchaseInvoiceItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
