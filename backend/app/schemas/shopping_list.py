from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# SHOPPING LIST ITEM - CREATE
# ============================================================

class ShoppingListItemCreate(BaseModel):
    """
    Customer can either:
    1. Select an existing product using product_id
    2. Enter a product name manually
    """

    product_id: Optional[int] = None

    product_name: Optional[str] = Field(
        default=None,
        max_length=150,
    )

    quantity: int = Field(
        default=1,
        gt=0,
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=500,
    )


# ============================================================
# SHOPPING LIST - CREATE
# ============================================================

class ShoppingListCreate(BaseModel):
    customer_id: int
    shop_id: int

    items: list[ShoppingListItemCreate] = Field(
        min_length=1,
    )

    customer_note: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    image_url: Optional[str] = Field(
        default=None,
        max_length=500,
    )


# ============================================================
# SHOPPING LIST ITEM - RESPONSE
# ============================================================

class ShoppingListItemResponse(BaseModel):
    product_id: Optional[int] = None
    product_name: str
    quantity: int
    unit_price: Decimal = Decimal("0.00")
    notes: Optional[str] = None

    model_config = ConfigDict(
        from_attributes=True,
    )


# ============================================================
# SHOPPING LIST - RESPONSE
# ============================================================

class ShoppingListResponse(BaseModel):
    cart_id: Optional[int] = None
    customer_id: int
    shop_id: int
    status: Optional[str] = "ACTIVE"

    customer_note: Optional[str] = None
    image_url: Optional[str] = None

    items: list[ShoppingListItemResponse]

    model_config = ConfigDict(
        from_attributes=True,
    )


# ============================================================
# SHOPKEEPER - ITEM STATUS UPDATE
# ============================================================

class ShoppingListItemStatusUpdate(BaseModel):
    status: str = Field(
        pattern=(
            "^(PENDING|AVAILABLE|"
            "UNAVAILABLE|SUBSTITUTION_PENDING|CONFIRMED)$"
        )
    )


# ============================================================
# SHOPKEEPER - LIST STATUS UPDATE
# ============================================================

class ShoppingListStatusUpdate(BaseModel):
    status: str = Field(
        pattern=(
            "^(PENDING|PROCESSING|"
            "READY|COMPLETED|CANCELLED)$"
        )
    )