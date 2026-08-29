from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# ORDER ITEM CREATE
# ============================================================

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class OrderItemPriceUpdate(BaseModel):
    item_id: int
    unit_price: Decimal
    quantity: int | None = None


class OrderPricingUpdateRequest(BaseModel):
    items: list[OrderItemPriceUpdate]
    notes: str | None = None


# ============================================================
# CREATE ORDER
# ============================================================

class OrderCreate(BaseModel):
    shop_id: int = Field(gt=0)
    payment_method: str = "COD"
    notes: str | None = None

    items: list[OrderItemCreate] = Field(
        min_length=1
    )


# ============================================================
# ORDER ITEM RESPONSE
# ============================================================

class OrderItemResponse(BaseModel):
    id: int
    order_id: int
    product_id: int | None = None
    product_name: str | None = None
    quantity: int = 1
    unit_price: Decimal = Decimal("0.00")
    status: str = "PENDING"

    model_config = ConfigDict(
        from_attributes=True
    )


# ============================================================
# ORDER RESPONSE
# ============================================================

class OrderResponse(BaseModel):
    id: int
    customer_id: int
    shop_id: int
    status: str
    total_amount: Decimal
    payment_method: str | None = "COD"
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemResponse] = []

    model_config = ConfigDict(
        from_attributes=True
    )


# ============================================================
# CUSTOMER ORDER LIST
# ============================================================

class CustomerOrderSummary(BaseModel):
    id: int
    shop_id: int
    shop_name: str | None = None
    status: str
    total_amount: Decimal
    payment_method: str | None = "COD"
    notes: str | None = None
    is_parchi: bool = False
    order_source: str = "STORE"
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemResponse] = []

    model_config = ConfigDict(
        from_attributes=True
    )


# ============================================================
# SHOPKEEPER ORDER ITEM RESPONSE
# ============================================================

class ShopkeeperOrderItemResponse(BaseModel):
    id: int
    product_id: int | None = None

    product_name: str = "Grocery Item"

    quantity: int = 1
    unit_price: Decimal = Decimal("0.00")

    available_quantity: int = 0

    status: str = "PENDING"

    suggested_product_id: int | None = None
    suggested_product_name: str | None = None
    suggested_product_price: Decimal | None = None

    model_config = ConfigDict(
        from_attributes=True
    )


# ============================================================
# SHOPKEEPER ORDER RESPONSE
# ============================================================

class ShopkeeperOrderResponse(BaseModel):
    id: int

    customer_id: int
    customer_name: str
    customer_phone: str
    customer_address: str | None = None

    shop_id: int

    status: str
    total_amount: Decimal
    payment_method: str | None = "COD"
    notes: str | None = None
    is_parchi: bool = False
    order_source: str = "STORE"

    created_at: datetime

    items: list[ShopkeeperOrderItemResponse]

    model_config = ConfigDict(
        from_attributes=True
    )


# ============================================================
# CUSTOMER SUBSTITUTION DECISION
# ============================================================

class SubstitutionDecision(BaseModel):
    accept: bool


# ============================================================
# SUBSTITUTION RESPONSE
# ============================================================

class SubstitutionResponseModel(BaseModel):
    id: int

    order_id: int
    order_item_id: int

    original_product_id: int
    original_product_name: str

    requested_quantity: int

    suggested_product_id: int
    suggested_product_name: str
    suggested_product_price: Decimal

    status: str

    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


# ============================================================
# SUBSTITUTION DECISION RESPONSE
# ============================================================

class SubstitutionDecisionResponse(BaseModel):
    message: str

    substitution_id: int
    substitution_status: str

    order_id: int
    order_status: str

    order_total: Decimal


# ============================================================
# SHOPKEEPER ORDER STATUS UPDATE
# ============================================================

class OrderStatusUpdate(BaseModel):
    status: str = Field(
        min_length=1,
        max_length=30
    )


# ============================================================
# ORDER STATUS UPDATE RESPONSE
# ============================================================

class OrderStatusUpdateResponse(BaseModel):
    message: str

    order_id: int

    old_status: str
    new_status: str