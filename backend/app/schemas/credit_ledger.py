from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# CREATE CREDIT LEDGER ENTRY
# ============================================================

class CreditLedgerCreate(BaseModel):
    customer_id: int

    shop_id: int

    order_id: int | None = None

    transaction_type: str = Field(
        ...,
        max_length=30,
    )

    amount: Decimal = Field(
        ...,
        gt=0,
    )

    description: str | None = None

    payment_reference: str | None = Field(
        default=None,
        max_length=150,
    )

    due_date: datetime | None = None


# ============================================================
# CREDIT LEDGER RESPONSE
# ============================================================

class CreditLedgerResponse(BaseModel):
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

    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


# ============================================================
# CUSTOMER CREDIT BALANCE
# ============================================================

class CreditBalanceResponse(BaseModel):
    customer_id: int

    shop_id: int

    total_credit: Decimal

    total_paid: Decimal

    outstanding_balance: Decimal

    last_transaction_at: datetime | None = None