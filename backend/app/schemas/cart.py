from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


# ============================================================
# ADD ITEM
# ============================================================

class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


# ============================================================
# UPDATE ITEM
# ============================================================

class CartItemUpdate(BaseModel):
    quantity: int


# ============================================================
# ITEM RESPONSE
# ============================================================

class CartItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal


# ============================================================
# CART RESPONSE
# ============================================================

class CartResponse(BaseModel):
    id: int
    customer_id: int
    shop_id: int
    is_active: bool
    total_amount: Decimal
    items: list[CartItemResponse]
    created_at: datetime
    updated_at: datetime