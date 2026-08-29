from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, ConfigDict


# ============================================================
# CREATE PAYMENT
# ============================================================

class PaymentCreate(BaseModel):
    """
    Record a customer payment against their credit account.
    """

    customer_id: int = Field(
        gt=0,
        description="Customer making the payment.",
    )

    shop_id: int = Field(
        gt=0,
        description="Shop receiving the payment.",
    )

    amount: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=2,
        description="Payment amount.",
    )

    payment_reference: str | None = Field(
        default=None,
        max_length=150,
        description="UPI, cash receipt, bank reference, etc.",
    )

    description: str | None = Field(
        default=None,
        max_length=500,
    )


# ============================================================
# PAYMENT RESPONSE
# ============================================================

class PaymentResponse(BaseModel):
    """
    Response after recording a payment.
    """

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int
    customer_id: int
    shop_id: int
    order_id: int | None
    transaction_type: str
    amount: Decimal
    balance_after: Decimal
    status: str
    description: str | None
    payment_reference: str | None
    due_date: datetime | None
    created_at: datetime


# ============================================================
# PAYMENT HISTORY RESPONSE
# ============================================================

class PaymentHistoryResponse(BaseModel):
    """
    Customer payment history summary.
    """

    customer_id: int
    shop_id: int

    total_credit: Decimal
    total_paid: Decimal

    outstanding_balance: Decimal

    last_payment_amount: Decimal | None
    last_payment_at: datetime | None