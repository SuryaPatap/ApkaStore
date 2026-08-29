from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.credit_account import CreditAccount
from ..models.credit_payment import CreditPayment
from ..services.credit_payment_service import (
    create_credit_payment,
    get_credit_payment,
    get_credit_payment_history,
)


router = APIRouter(
    prefix="/api/v1/credit-payments",
    tags=["Credit Payments"],
)


# ============================================================
# CREATE CREDIT PAYMENT
# ============================================================

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def create_payment(
    customer_id: int,
    shop_id: int,
    amount: Decimal,
    payment_method: str = "CASH",
    payment_reference: str | None = None,
    description: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Record a payment against a customer's credit account.
    """

    # --------------------------------------------------------
    # VALIDATE AMOUNT
    # --------------------------------------------------------

    if amount <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount must be greater than zero.",
        )

    # --------------------------------------------------------
    # GET CREDIT ACCOUNT
    # --------------------------------------------------------

    account = (
        db.query(CreditAccount)
        .filter(
            CreditAccount.customer_id == customer_id,
            CreditAccount.shop_id == shop_id,
        )
        .first()
    )

    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit account not found.",
        )

    # --------------------------------------------------------
    # ACCOUNT VALIDATION
    # --------------------------------------------------------

    if not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credit account is inactive.",
        )

    if account.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Credit account must be APPROVED "
                "before making a payment."
            ),
        )

    # --------------------------------------------------------
    # PREVENT OVERPAYMENT
    # --------------------------------------------------------

    if amount > account.outstanding_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Payment amount cannot exceed outstanding "
                f"balance of ₹{account.outstanding_amount}."
            ),
        )

    # --------------------------------------------------------
    # CREATE PAYMENT
    # --------------------------------------------------------

    try:
        result = create_credit_payment(
            db=db,
            credit_account_id=account.id,
            amount=amount,
            payment_method=payment_method,
            payment_reference=payment_reference,
            description=description,
        )

        db.commit()

        db.refresh(result["payment"])
        db.refresh(result["credit_account"])

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create credit payment.",
        )

    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return {
        "message": "Credit payment recorded successfully.",
        "payment_id": result["payment"].id,
        "credit_account_id": result["credit_account"].id,
        "customer_id": result["credit_account"].customer_id,
        "shop_id": result["credit_account"].shop_id,
        "previous_outstanding": result["previous_balance"],
        "payment_amount": result["payment_amount"],
        "new_outstanding": result["new_balance"],
        "available_credit": result["available_credit"],
        "payment_method": result["payment"].payment_method,
        "payment_reference": result["payment"].payment_reference,
        "status": result["payment"].status,
    }


# ============================================================
# GET CREDIT PAYMENT
# ============================================================

@router.get(
    "/{payment_id}",
)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
):
    """
    Get a single credit payment by ID.
    """

    try:
        payment = get_credit_payment(
            db=db,
            payment_id=payment_id,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )

    return payment


# ============================================================
# GET CUSTOMER PAYMENT HISTORY
# ============================================================

@router.get(
    "/customer/{customer_id}",
)
def get_customer_payments(
    customer_id: int,
    shop_id: int,
    db: Session = Depends(get_db),
):
    """
    Get all credit payments made by a customer
    for a specific shop.
    """

    try:
        payments = get_credit_payment_history(
            db=db,
            customer_id=customer_id,
            shop_id=shop_id,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )

    return {
        "customer_id": customer_id,
        "shop_id": shop_id,
        "count": len(payments),
        "payments": payments,
    }


# ============================================================
# GET CREDIT ACCOUNT PAYMENT HISTORY
# ============================================================

@router.get(
    "/account/{account_id}",
)
def get_account_payments(
    account_id: int,
    db: Session = Depends(get_db),
):
    """
    Get all payments associated with a credit account.
    """

    account = (
        db.query(CreditAccount)
        .filter(
            CreditAccount.id == account_id,
        )
        .first()
    )

    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit account not found.",
        )

    payments = (
        db.query(CreditPayment)
        .filter(
            CreditPayment.credit_account_id == account_id,
        )
        .order_by(
            CreditPayment.id.desc()
        )
        .all()
    )

    return {
        "credit_account_id": account_id,
        "customer_id": account.customer_id,
        "shop_id": account.shop_id,
        "count": len(payments),
        "payments": payments,
    }