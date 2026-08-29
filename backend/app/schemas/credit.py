from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# CUSTOMER CREDIT REQUEST
# ============================================================

class CreditRequestCreate(BaseModel):
    shop_id: int = Field(gt=0)
    requested_limit: Decimal = Field(gt=Decimal("0.00"))
    notes: str | None = Field(default=None, max_length=500)


# ============================================================
# SHOPKEEPER CREDIT DECISION
# ============================================================

class CreditApprovalRequest(BaseModel):
    approved: bool
    approved_limit: Decimal | None = Field(default=None, gt=Decimal("0.00"))
    notes: str | None = Field(default=None, max_length=500)


# ============================================================
# CREDIT REQUEST RESPONSE
# ============================================================

class CreditRequestResponse(BaseModel):
    id: int
    customer_id: int
    customer_name: str | None = None
    customer_phone: str | None = None
    shop_id: int
    shop_name: str | None = None
    requested_limit: Decimal
    approved_limit: Decimal | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# CREDIT ACCOUNT RESPONSE
# ============================================================

class CreditAccountResponse(BaseModel):
    id: int
    customer_id: int
    customer_name: str | None = None
    customer_phone: str | None = None
    shop_id: int
    shop_name: str | None = None
    credit_limit: Decimal
    outstanding_amount: Decimal
    available_credit: Decimal
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# ITEMIZED CREDIT LEDGER ITEM
# ============================================================

class CreditLedgerItemResponse(BaseModel):
    product_name: str
    quantity: int | float
    unit_price: Decimal
    subtotal: Decimal
    unit: str | None = "unit"

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# CREDIT LEDGER ENTRY (WITH DATE, TIME, & ITEMS)
# ============================================================

class CreditLedgerResponse(BaseModel):
    id: int
    customer_id: int
    customer_name: str | None = None
    customer_phone: str | None = None
    shop_id: int
    shop_name: str | None = None
    order_id: int | None = None
    transaction_type: str  # CREDIT_PURCHASE, PAYMENT, ADJUSTMENT
    amount: Decimal
    balance_after: Decimal
    description: str | None = None
    payment_reference: str | None = None
    formatted_date: str | None = None
    formatted_time: str | None = None
    created_at: datetime
    items: list[CreditLedgerItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# MONTHLY PAYMENT
# ============================================================

class CreditPaymentCreate(BaseModel):
    amount: Decimal = Field(gt=Decimal("0.00"))
    payment_method: str = Field(min_length=1, max_length=50)
    reference_number: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=500)


# ============================================================
# PAYMENT RESPONSE
# ============================================================

class CreditPaymentResponse(BaseModel):
    id: int
    credit_account_id: int
    amount: Decimal
    payment_method: str
    payment_reference: str | None = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# CUSTOMER CREDIT SUMMARY
# ============================================================

class CustomerCreditSummary(BaseModel):
    customer_id: int
    shop_id: int
    credit_limit: Decimal
    outstanding_amount: Decimal
    available_credit: Decimal
    account_status: str

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# SHOPKEEPER CUSTOMER CREDIT SUMMARY
# ============================================================

class ShopkeeperCustomerCreditResponse(BaseModel):
    customer_id: int
    customer_name: str
    customer_phone: str
    customer_email: str | None = None
    credit_limit: Decimal
    outstanding_amount: Decimal
    available_credit: Decimal
    account_status: str
    last_transaction_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)