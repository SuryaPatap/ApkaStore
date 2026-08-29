from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# CREATE CREDIT ACCOUNT
# ============================================================

class CreditAccountCreate(BaseModel):
    customer_id: int = Field(
        gt=0,
    )

    shop_id: int = Field(
        gt=0,
    )

    credit_limit: Decimal = Field(
        gt=0,
        decimal_places=2,
        max_digits=12,
    )


# ============================================================
# UPDATE CREDIT ACCOUNT
# ============================================================

class CreditAccountUpdate(BaseModel):
    credit_limit: Decimal | None = Field(
        default=None,
        gt=0,
        decimal_places=2,
        max_digits=12,
    )

    status: str | None = Field(
        default=None,
    )

    is_active: bool | None = None


# ============================================================
# CREDIT ACCOUNT RESPONSE
# ============================================================

class CreditAccountResponse(BaseModel):
    id: int

    customer_id: int

    shop_id: int

    credit_limit: Decimal

    outstanding_amount: Decimal

    status: str

    is_active: bool

    created_at: datetime

    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


# ============================================================
# CREDIT ACCOUNT BALANCE RESPONSE
# ============================================================

class CreditAccountBalanceResponse(BaseModel):
    customer_id: int

    shop_id: int

    credit_limit: Decimal

    outstanding_amount: Decimal

    available_credit: Decimal

    status: str