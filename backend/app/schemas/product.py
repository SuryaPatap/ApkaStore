from decimal import Decimal

from pydantic import BaseModel, Field


# ============================================================
# CREATE PRODUCT
# ============================================================

class ProductCreate(BaseModel):

    name: str = Field(
        ...,
        min_length=1,
        max_length=150,
    )

    category: str | None = Field(
        default=None,
        max_length=100,
    )

    unit: str = Field(
        ...,
        min_length=1,
        max_length=30,
    )

    price: Decimal = Field(
        ...,
        gt=0,
    )

    stock_quantity: int = Field(
        default=0,
        ge=0,
    )


# ============================================================
# UPDATE PRODUCT
# ============================================================

class ProductUpdate(BaseModel):

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
    )

    category: str | None = Field(
        default=None,
        max_length=100,
    )

    unit: str | None = Field(
        default=None,
        min_length=1,
        max_length=30,
    )

    price: Decimal | None = Field(
        default=None,
        gt=0,
    )

    is_active: bool | None = None


# ============================================================
# STOCK UPDATE
# ============================================================

class InventoryUpdate(BaseModel):

    stock_quantity: int = Field(
        ...,
        ge=0,
    )


# ============================================================
# RESPONSE
# ============================================================

class ProductResponse(BaseModel):

    id: int
    shop_id: int
    name: str
    category: str | None
    unit: str
    price: Decimal
    stock_quantity: int
    is_active: bool

    class Config:
        from_attributes = True