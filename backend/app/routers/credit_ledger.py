from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.credit_ledger import CreditLedger
from ..models.customer import Customer
from ..models.order import Order
from ..models.shop import Shop
from ..schemas.credit_ledger import (
    CreditBalanceResponse,
    CreditLedgerCreate,
    CreditLedgerResponse,
)


router = APIRouter(
    prefix="/api/v1/credit-ledger",
    tags=["Credit Ledger"],
)


# ============================================================
# VALID TRANSACTION TYPES
# ============================================================

VALID_TRANSACTION_TYPES = {
    "CREDIT_PURCHASE",
    "PAYMENT",
    "ADJUSTMENT",
}


# ============================================================
# CREATE CREDIT LEDGER ENTRY
# ============================================================

@router.post(
    "",
    response_model=CreditLedgerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_credit_ledger_entry(
    payload: CreditLedgerCreate,
    db: Session = Depends(get_db),
):
    """
    Create a credit ledger transaction.

    CREDIT_PURCHASE:
        Increases customer outstanding balance.

    PAYMENT:
        Decreases customer outstanding balance.

    ADJUSTMENT:
        Manual balance adjustment.
    """

    # --------------------------------------------------------
    # Validate transaction type
    # --------------------------------------------------------

    if payload.transaction_type not in VALID_TRANSACTION_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid transaction type. "
                "Allowed values: "
                "CREDIT_PURCHASE, PAYMENT, ADJUSTMENT."
            ),
        )

    # --------------------------------------------------------
    # Validate amount
    # --------------------------------------------------------

    if payload.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be greater than zero.",
        )

    # --------------------------------------------------------
    # Validate customer
    # --------------------------------------------------------

    customer = (
        db.query(Customer)
        .filter(
            Customer.id == payload.customer_id,
            Customer.is_active == True,
        )
        .first()
    )

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    # --------------------------------------------------------
    # Validate shop
    # --------------------------------------------------------

    shop = (
        db.query(Shop)
        .filter(
            Shop.id == payload.shop_id,
            Shop.is_active == True,
        )
        .first()
    )

    if shop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found.",
        )

    # --------------------------------------------------------
    # Validate order if supplied
    # --------------------------------------------------------

    if payload.order_id is not None:

        order = (
            db.query(Order)
            .filter(
                Order.id == payload.order_id,
                Order.customer_id == payload.customer_id,
                Order.shop_id == payload.shop_id,
            )
            .first()
        )

        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found for this customer and shop.",
            )

    # --------------------------------------------------------
    # Get previous balance
    # --------------------------------------------------------

    last_entry = (
        db.query(CreditLedger)
        .filter(
            CreditLedger.customer_id == payload.customer_id,
            CreditLedger.shop_id == payload.shop_id,
            CreditLedger.status == "POSTED",
        )
        .order_by(
            CreditLedger.id.desc()
        )
        .first()
    )

    previous_balance = (
        last_entry.balance_after
        if last_entry is not None
        else Decimal("0.00")
    )

    # --------------------------------------------------------
    # Calculate new balance
    # --------------------------------------------------------

    if payload.transaction_type == "CREDIT_PURCHASE":

        new_balance = (
            previous_balance + payload.amount
        )

    elif payload.transaction_type == "PAYMENT":

        new_balance = (
            previous_balance - payload.amount
        )

        if new_balance < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Payment exceeds outstanding balance. "
                    f"Outstanding balance: ₹{previous_balance}."
                ),
            )

    else:
        # ADJUSTMENT
        new_balance = (
            previous_balance + payload.amount
        )

    # --------------------------------------------------------
    # Create ledger entry
    # --------------------------------------------------------

    ledger_entry = CreditLedger(
        customer_id=payload.customer_id,
        shop_id=payload.shop_id,
        order_id=payload.order_id,
        transaction_type=payload.transaction_type,
        amount=payload.amount,
        balance_after=new_balance,
        status="POSTED",
        description=payload.description,
        payment_reference=payload.payment_reference,
        due_date=payload.due_date,
    )

    db.add(ledger_entry)

    db.commit()
    db.refresh(ledger_entry)

    return ledger_entry


# ============================================================
# CUSTOMER LEDGER
# ============================================================

@router.get(
    "/customer/{customer_id}",
    response_model=list[CreditLedgerResponse],
)
def get_customer_credit_ledger(
    customer_id: int,
    shop_id: int,
    db: Session = Depends(get_db),
):
    """
    Get complete credit history of a customer for a shop.
    """

    customer = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id,
            Customer.is_active == True,
        )
        .first()
    )

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    entries = (
        db.query(CreditLedger)
        .filter(
            CreditLedger.customer_id == customer_id,
            CreditLedger.shop_id == shop_id,
        )
        .order_by(
            CreditLedger.created_at.asc()
        )
        .all()
    )

    return entries


# ============================================================
# SHOP LEDGER
# ============================================================

@router.get(
    "/shop/{shop_id}",
    response_model=list[CreditLedgerResponse],
)
def get_shop_credit_ledger(
    shop_id: int,
    db: Session = Depends(get_db),
):
    """
    Get all credit transactions belonging to a shop.
    """

    shop = (
        db.query(Shop)
        .filter(
            Shop.id == shop_id,
            Shop.is_active == True,
        )
        .first()
    )

    if shop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found.",
        )

    entries = (
        db.query(CreditLedger)
        .filter(
            CreditLedger.shop_id == shop_id,
        )
        .order_by(
            CreditLedger.created_at.desc()
        )
        .all()
    )

    return entries


# ============================================================
# CUSTOMER BALANCE
# ============================================================

@router.get(
    "/customer/{customer_id}/balance",
    response_model=CreditBalanceResponse,
)
def get_customer_credit_balance(
    customer_id: int,
    shop_id: int,
    db: Session = Depends(get_db),
):
    """
    Get customer's current outstanding balance for a shop.
    """

    customer = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id,
            Customer.is_active == True,
        )
        .first()
    )

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    entries = (
        db.query(CreditLedger)
        .filter(
            CreditLedger.customer_id == customer_id,
            CreditLedger.shop_id == shop_id,
            CreditLedger.status == "POSTED",
        )
        .order_by(
            CreditLedger.id.asc()
        )
        .all()
    )

    total_credit = Decimal("0.00")
    total_paid = Decimal("0.00")

    for entry in entries:

        if entry.transaction_type == "CREDIT_PURCHASE":
            total_credit += entry.amount

        elif entry.transaction_type == "PAYMENT":
            total_paid += entry.amount

    outstanding_balance = (
        total_credit - total_paid
    )

    if outstanding_balance < 0:
        outstanding_balance = Decimal("0.00")

    last_transaction_at = (
        entries[-1].created_at
        if entries
        else None
    )

    return {
        "customer_id": customer_id,
        "shop_id": shop_id,
        "total_credit": total_credit,
        "total_paid": total_paid,
        "outstanding_balance": outstanding_balance,
        "last_transaction_at": last_transaction_at,
    }