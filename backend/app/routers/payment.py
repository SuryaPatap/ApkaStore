from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.credit_ledger import CreditLedger
from ..models.customer import Customer
from ..models.shop import Shop
from ..schemas.payment import (
    PaymentCreate,
    PaymentHistoryResponse,
    PaymentResponse,
)


router = APIRouter(
    prefix="/api/v1/payments",
    tags=["Payments"],
)


# ============================================================
# RECORD CUSTOMER PAYMENT
# ============================================================

@router.post(
    "",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
):
    """
    Record a payment made by a customer.

    Flow:

        Customer owes ₹1000
                ↓
        Customer pays ₹400
                ↓
        Ledger balance becomes ₹600
    """

    # --------------------------------------------------------
    # Validate amount
    # --------------------------------------------------------

    if payload.amount <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount must be greater than zero.",
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
    # Get latest posted ledger entry
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

    # --------------------------------------------------------
    # Calculate current outstanding balance
    # --------------------------------------------------------

    if last_entry is None:
        outstanding_balance = Decimal("0.00")
    else:
        outstanding_balance = last_entry.balance_after

    # --------------------------------------------------------
    # Prevent overpayment
    # --------------------------------------------------------

    if payload.amount > outstanding_balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Payment exceeds outstanding balance. "
                f"Outstanding balance: ₹{outstanding_balance}."
            ),
        )

    # --------------------------------------------------------
    # Calculate new balance
    # --------------------------------------------------------

    new_balance = (
        outstanding_balance - payload.amount
    )

    if new_balance < Decimal("0.00"):
        new_balance = Decimal("0.00")

    # --------------------------------------------------------
    # Create payment ledger entry
    # --------------------------------------------------------

    payment = CreditLedger(
        customer_id=payload.customer_id,
        shop_id=payload.shop_id,
        order_id=None,
        transaction_type="PAYMENT",
        amount=payload.amount,
        balance_after=new_balance,
        status="POSTED",
        description=payload.description
        or "Customer credit payment",
        payment_reference=payload.payment_reference,
        due_date=None,
    )

    db.add(payment)

    # --------------------------------------------------------
    # Commit
    # --------------------------------------------------------

    try:
        db.commit()
        db.refresh(payment)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record payment.",
        )

    return payment


# ============================================================
# CUSTOMER PAYMENT HISTORY
# ============================================================

@router.get(
    "/customer/{customer_id}",
    response_model=PaymentHistoryResponse,
)
def get_customer_payment_history(
    customer_id: int,
    shop_id: int,
    db: Session = Depends(get_db),
):
    """
    Get customer's credit/payment summary for a shop.
    """

    # --------------------------------------------------------
    # Validate customer
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Validate shop
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Get ledger
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Calculate totals
    # --------------------------------------------------------

    total_credit = Decimal("0.00")
    total_paid = Decimal("0.00")

    last_payment_amount = None
    last_payment_at = None

    for entry in entries:

        if entry.transaction_type == "CREDIT_PURCHASE":

            total_credit += entry.amount

        elif entry.transaction_type == "PAYMENT":

            total_paid += entry.amount

            last_payment_amount = entry.amount
            last_payment_at = entry.created_at

    # --------------------------------------------------------
    # Outstanding balance
    # --------------------------------------------------------

    outstanding_balance = (
        total_credit - total_paid
    )

    if outstanding_balance < Decimal("0.00"):
        outstanding_balance = Decimal("0.00")

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return {
        "customer_id": customer_id,
        "shop_id": shop_id,
        "total_credit": total_credit,
        "total_paid": total_paid,
        "outstanding_balance": outstanding_balance,
        "last_payment_amount": last_payment_amount,
        "last_payment_at": last_payment_at,
    }


# ============================================================
# CUSTOMER OUTSTANDING BALANCE
# ============================================================

@router.get(
    "/customer/{customer_id}/balance",
    response_model=dict,
)
def get_customer_balance(
    customer_id: int,
    shop_id: int,
    db: Session = Depends(get_db),
):
    """
    Get only the current outstanding amount.
    """

    # --------------------------------------------------------
    # Validate customer
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Latest ledger entry
    # --------------------------------------------------------

    last_entry = (
        db.query(CreditLedger)
        .filter(
            CreditLedger.customer_id == customer_id,
            CreditLedger.shop_id == shop_id,
            CreditLedger.status == "POSTED",
        )
        .order_by(
            CreditLedger.id.desc()
        )
        .first()
    )

    # --------------------------------------------------------
    # No credit history
    # --------------------------------------------------------

    if last_entry is None:
        balance = Decimal("0.00")

    else:
        balance = last_entry.balance_after

    return {
        "customer_id": customer_id,
        "shop_id": shop_id,
        "outstanding_balance": balance,
    }