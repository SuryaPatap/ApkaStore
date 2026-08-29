from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# CREATE CREDIT PAYMENT
# ============================================================

class CreditPaymentCreate(BaseModel):
    credit_account_id: int = Field(
        gt=0,
    )

    amount: Decimal = Field(
        gt=0,
        decimal_places=2,
        max_digits=12,
    )

    payment_method: str = Field(
        min_length=2,
        max_length=30,
    )

    payment_reference: str | None = Field(
        default=None,
        max_length=150,
    )

    description: str | None = Field(
        default=None,
        max_length=2000,
    )


# ============================================================
# CREDIT PAYMENT RESPONSE
# ============================================================

class CreditPaymentResponse(BaseModel):
    id: int

    credit_account_id: int

    amount: Decimal

    payment_method: str

    payment_reference: str | None

    status: str

    description: str | None

    created_at: datetime

    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


# ============================================================
# CREDIT PAYMENT SUMMARY
# ============================================================

class CreditPaymentSummaryResponse(BaseModel):
    credit_account_id: int

    total_paid: Decimal

    payment_count: int