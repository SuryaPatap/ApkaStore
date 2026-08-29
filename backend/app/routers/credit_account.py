from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.credit_account import CreditAccount
from ..models.customer import Customer
from ..models.shop import Shop
from ..schemas.credit_account import (
    CreditAccountBalanceResponse,
    CreditAccountCreate,
    CreditAccountResponse,
    CreditAccountUpdate,
)


router = APIRouter(
    prefix="/api/v1/credit-accounts",
    tags=["Credit Accounts"],
)


# ============================================================
# CREATE CREDIT ACCOUNT
# ============================================================

@router.post(
    "",
    response_model=CreditAccountResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_credit_account(
    payload: CreditAccountCreate,
    db: Session = Depends(get_db),
):
    """
    Create a credit account for a customer at a shop.

    Newly created accounts start with PENDING status.
    The shopkeeper must approve the account before
    CREDIT checkout can be used.
    """

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
    # Check duplicate account
    # --------------------------------------------------------

    existing = (
        db.query(CreditAccount)
        .filter(
            CreditAccount.customer_id == payload.customer_id,
            CreditAccount.shop_id == payload.shop_id,
        )
        .first()
    )

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Credit account already exists "
                "for this customer and shop."
            ),
        )

    # --------------------------------------------------------
    # Create account
    # --------------------------------------------------------

    account = CreditAccount(
        customer_id=payload.customer_id,
        shop_id=payload.shop_id,
        credit_limit=payload.credit_limit,
        outstanding_amount=Decimal("0.00"),
        status="PENDING",
        is_active=True,
    )

    db.add(account)

    db.commit()
    db.refresh(account)

    return account


# ============================================================
# GET CREDIT ACCOUNT
# ============================================================

@router.get(
    "/{account_id}",
    response_model=CreditAccountResponse,
)
def get_credit_account(
    account_id: int,
    db: Session = Depends(get_db),
):
    """
    Get a credit account by ID.
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

    return account


# ============================================================
# GET CUSTOMER CREDIT ACCOUNT
# ============================================================

@router.get(
    "/customer/{customer_id}",
    response_model=CreditAccountResponse,
)
def get_customer_credit_account(
    customer_id: int,
    shop_id: int,
    db: Session = Depends(get_db),
):
    """
    Get a customer's credit account for a specific shop.
    """

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

    return account


# ============================================================
# GET CREDIT BALANCE
# ============================================================

@router.get(
    "/customer/{customer_id}/balance",
    response_model=CreditAccountBalanceResponse,
)
def get_customer_credit_balance(
    customer_id: int,
    shop_id: int,
    db: Session = Depends(get_db),
):
    """
    Get customer's credit limit, outstanding amount,
    and available credit.
    """

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

    available_credit = (
        account.credit_limit
        - account.outstanding_amount
    )

    if available_credit < 0:
        available_credit = Decimal("0.00")

    return {
        "customer_id": account.customer_id,
        "shop_id": account.shop_id,
        "credit_limit": account.credit_limit,
        "outstanding_amount": account.outstanding_amount,
        "available_credit": available_credit,
        "status": account.status,
    }


# ============================================================
# UPDATE CREDIT ACCOUNT
# ============================================================

@router.patch(
    "/{account_id}",
    response_model=CreditAccountResponse,
)
def update_credit_account(
    account_id: int,
    payload: CreditAccountUpdate,
    db: Session = Depends(get_db),
):
    """
    Update credit limit, approval status, or active status.
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

    # --------------------------------------------------------
    # Validate status
    # --------------------------------------------------------

    if payload.status is not None:

        allowed_statuses = {
            "PENDING",
            "APPROVED",
            "REJECTED",
            "SUSPENDED",
        }

        new_status = payload.status.upper().strip()

        if new_status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Invalid credit account status. "
                    "Allowed values: PENDING, APPROVED, "
                    "REJECTED, SUSPENDED."
                ),
            )

        account.status = new_status

    # --------------------------------------------------------
    # Update credit limit
    # --------------------------------------------------------

    if payload.credit_limit is not None:

        if payload.credit_limit < account.outstanding_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Credit limit cannot be lower than "
                    "the current outstanding amount."
                ),
            )

        account.credit_limit = payload.credit_limit

    # --------------------------------------------------------
    # Update active status
    # --------------------------------------------------------

    if payload.is_active is not None:
        account.is_active = payload.is_active

    db.commit()
    db.refresh(account)

    return account


# ============================================================
# APPROVE CREDIT ACCOUNT
# ============================================================

@router.post(
    "/{account_id}/approve",
    response_model=CreditAccountResponse,
)
def approve_credit_account(
    account_id: int,
    db: Session = Depends(get_db),
):
    """
    Approve a customer's credit account.

    After approval, the customer can use CREDIT checkout
    provided the credit limit is sufficient.
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

    if not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credit account is inactive.",
        )

    account.status = "APPROVED"

    db.commit()
    db.refresh(account)

    return account


# ============================================================
# REJECT CREDIT ACCOUNT
# ============================================================

@router.post(
    "/{account_id}/reject",
    response_model=CreditAccountResponse,
)
def reject_credit_account(
    account_id: int,
    db: Session = Depends(get_db),
):
    """
    Reject a customer's credit account.
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

    account.status = "REJECTED"

    db.commit()
    db.refresh(account)

    return account


# ============================================================
# SUSPEND CREDIT ACCOUNT
# ============================================================

@router.post(
    "/{account_id}/suspend",
    response_model=CreditAccountResponse,
)
def suspend_credit_account(
    account_id: int,
    db: Session = Depends(get_db),
):
    """
    Suspend a customer's credit account.
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

    account.status = "SUSPENDED"

    db.commit()
    db.refresh(account)

    return account