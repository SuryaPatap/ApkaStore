# app/schemas/checkout.py

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# CHECKOUT REQUEST
# ============================================================

class CheckoutRequest(BaseModel):
    """
    Request body for checking out an existing order.
    """

    order_id: int = Field(
        ...,
        gt=0,
        description="ID of the order being checked out.",
    )

    payment_method: str = Field(
        ...,
        description="CASH, UPI, CARD, or CREDIT.",
    )

    payment_reference: str | None = Field(
        default=None,
        max_length=150,
        description="UPI/card/payment transaction reference.",
    )


# ============================================================
# CHECKOUT RESPONSE
# ============================================================

class CheckoutResponse(BaseModel):
    """
    Response returned after checkout or when retrieving
    checkout status.
    """

    model_config = ConfigDict(
        from_attributes=True,
    )

    order_id: int

    customer_id: int

    shop_id: int

    total_amount: Decimal

    payment_method: str | None = None

    payment_status: str

    order_status: str

    message: str

    created_at: datetime | None = None