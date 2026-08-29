from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from ..models.credit_account import CreditAccount
from ..models.credit_payment import CreditPayment
from ..models.credit_transaction import CreditTransaction


# ============================================================
# GET CREDIT ACCOUNT
# ============================================================

def get_credit_account(
    db: Session,
    customer_id: int,
    shop_id: int,
) -> CreditAccount:
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
        raise ValueError(
            "Credit account not found."
        )

    return account


# ============================================================
# GET CREDIT ACCOUNT BY ID
# ============================================================

def get_credit_account_by_id(
    db: Session,
    credit_account_id: int,
) -> CreditAccount:
    """
    Get a credit account by its ID.
    """

    account = (
        db.query(CreditAccount)
        .filter(
            CreditAccount.id == credit_account_id,
        )
        .first()
    )

    if account is None:
        raise ValueError(
            "Credit account not found."
        )

    return account


# ============================================================
# VALIDATE PAYMENT AMOUNT
# ============================================================

def validate_payment_amount(
    amount: Decimal,
):
    """
    Validate credit payment amount.
    """

    if amount is None:
        raise ValueError(
            "Payment amount is required."
        )

    if amount <= Decimal("0.00"):
        raise ValueError(
            "Payment amount must be greater than zero."
        )


# ============================================================
# CHECK PAYMENT AGAINST OUTSTANDING
# ============================================================

def validate_payment_against_outstanding(
    account: CreditAccount,
    amount: Decimal,
):
    """
    Make sure payment does not exceed
    the customer's outstanding credit.
    """

    outstanding = account.outstanding_amount

    if outstanding < Decimal("0.00"):
        outstanding = Decimal("0.00")

    if amount > outstanding:
        raise ValueError(
            f"Payment amount cannot exceed "
            f"outstanding amount. "
            f"Outstanding: ₹{outstanding}, "
            f"Payment: ₹{amount}."
        )


# ============================================================
# CREATE CREDIT PAYMENT
# ============================================================

def create_credit_payment(
    db: Session,
    credit_account_id: int,
    amount: Decimal,
    payment_method: str,
    payment_reference: str | None = None,
    description: str | None = None,
):
    """
    Create a payment against a customer's credit account.

    Flow:

        CreditAccount
              ↓
        Validate payment
              ↓
        CreditPayment
              ↓
        CreditTransaction(PAYMENT)
              ↓
        Reduce outstanding_amount

    This function does NOT commit.
    The caller controls commit/rollback.
    """

    # --------------------------------------------------------
    # VALIDATE AMOUNT
    # --------------------------------------------------------

    validate_payment_amount(amount)

    # --------------------------------------------------------
    # GET ACCOUNT
    # --------------------------------------------------------

    account = get_credit_account_by_id(
        db=db,
        credit_account_id=credit_account_id,
    )

    # --------------------------------------------------------
    # ACCOUNT ACTIVE CHECK
    # --------------------------------------------------------

    if not account.is_active:
        raise ValueError(
            "Credit account is inactive."
        )

    # --------------------------------------------------------
    # ACCOUNT STATUS
    # --------------------------------------------------------

    if account.status != "APPROVED":
        raise ValueError(
            "Credit account is not approved."
        )

    # --------------------------------------------------------
    # CHECK OUTSTANDING
    # --------------------------------------------------------

    validate_payment_against_outstanding(
        account=account,
        amount=amount,
    )

    # --------------------------------------------------------
    # CURRENT BALANCE
    # --------------------------------------------------------

    previous_balance = (
        account.outstanding_amount
    )

    if previous_balance < Decimal("0.00"):
        previous_balance = Decimal("0.00")

    # --------------------------------------------------------
    # NEW BALANCE
    # --------------------------------------------------------

    new_balance = (
        previous_balance - amount
    )

    if new_balance < Decimal("0.00"):
        new_balance = Decimal("0.00")

    # --------------------------------------------------------
    # PAYMENT METHOD
    # --------------------------------------------------------

    if not payment_method:
        raise ValueError(
            "Payment method is required."
        )

    payment_method = (
        payment_method.upper().strip()
    )

    allowed_payment_methods = {
        "CASH",
        "UPI",
        "CARD",
        "BANK_TRANSFER",
        "ONLINE",
        "OTHER",
    }

    if payment_method not in allowed_payment_methods:
        raise ValueError(
            "Invalid payment method. "
            "Allowed values: CASH, UPI, CARD, "
            "BANK_TRANSFER, ONLINE, OTHER."
        )

    # --------------------------------------------------------
    # CREATE CREDIT PAYMENT
    # --------------------------------------------------------

    payment = CreditPayment(
        credit_account_id=account.id,
        amount=amount,
        payment_method=payment_method,
        payment_reference=payment_reference,
        status="POSTED",
        description=(
            description
            if description
            else "Credit account payment"
        ),
    )

    db.add(payment)

    db.flush()

    # --------------------------------------------------------
    # UPDATE CREDIT ACCOUNT
    # --------------------------------------------------------

    account.outstanding_amount = new_balance

    # --------------------------------------------------------
    # CREATE CREDIT TRANSACTION
    # --------------------------------------------------------

    transaction = CreditTransaction(
        credit_account_id=account.id,
        order_id=None,
        transaction_type="PAYMENT",
        amount=amount,
        balance_after=new_balance,
        status="POSTED",
        description=(
            description
            if description
            else "Credit account payment"
        ),
        reference=payment_reference,
    )

    db.add(transaction)

    db.flush()

    return {
        "payment": payment,
        "transaction": transaction,
        "credit_account": account,
        "previous_balance": previous_balance,
        "payment_amount": amount,
        "new_balance": new_balance,
        "available_credit": (
            account.credit_limit - new_balance
        ),
    }


# ============================================================
# GET PAYMENT BY ID
# ============================================================

def get_credit_payment(
    db: Session,
    payment_id: int,
):
    """
    Get a credit payment by ID.
    """

    payment = (
        db.query(CreditPayment)
        .filter(
            CreditPayment.id == payment_id,
        )
        .first()
    )

    if payment is None:
        raise ValueError(
            "Credit payment not found."
        )

    return payment


# ============================================================
# GET CUSTOMER PAYMENT HISTORY
# ============================================================

def get_credit_payment_history(
    db: Session,
    customer_id: int,
    shop_id: int,
):
    """
    Get all credit payments for a customer
    at a specific shop.
    """

    account = get_credit_account(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
    )

    payments = (
        db.query(CreditPayment)
        .filter(
            CreditPayment.credit_account_id
            == account.id,
        )
        .order_by(
            CreditPayment.id.desc()
        )
        .all()
    )

    return payments


# ============================================================
# GET TOTAL PAID
# ============================================================

def get_total_credit_paid(
    db: Session,
    customer_id: int,
    shop_id: int,
) -> Decimal:
    """
    Calculate total posted payments made
    against a customer's credit account.
    """

    account = get_credit_account(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
    )

    payments = (
        db.query(CreditPayment)
        .filter(
            CreditPayment.credit_account_id
            == account.id,
            CreditPayment.status == "POSTED",
        )
        .all()
    )

    total_paid = Decimal("0.00")

    for payment in payments:
        total_paid += payment.amount

    return total_paid


# ============================================================
# CANCEL CREDIT PAYMENT
# ============================================================

def cancel_credit_payment(
    db: Session,
    payment_id: int,
):
    """
    Cancel a previously posted credit payment.

    When a payment is cancelled:

        Outstanding ₹3,000
             ↓
        Cancel payment ₹2,000
             ↓
        Outstanding ₹5,000

    A REVERSED transaction is created.

    This function does NOT commit.
    """

    payment = get_credit_payment(
        db=db,
        payment_id=payment_id,
    )

    # --------------------------------------------------------
    # ALREADY CANCELLED
    # --------------------------------------------------------

    if payment.status == "CANCELLED":
        raise ValueError(
            "Credit payment is already cancelled."
        )

    # --------------------------------------------------------
    # ONLY POSTED PAYMENTS CAN BE CANCELLED
    # --------------------------------------------------------

    if payment.status != "POSTED":
        raise ValueError(
            "Only POSTED credit payments can be cancelled."
        )

    # --------------------------------------------------------
    # GET ACCOUNT
    # --------------------------------------------------------

    account = get_credit_account_by_id(
        db=db,
        credit_account_id=payment.credit_account_id,
    )

    # --------------------------------------------------------
    # CURRENT BALANCE
    # --------------------------------------------------------

    previous_balance = (
        account.outstanding_amount
    )

    # --------------------------------------------------------
    # RESTORE PAYMENT AMOUNT
    # --------------------------------------------------------

    new_balance = (
        previous_balance + payment.amount
    )

    # --------------------------------------------------------
    # CHECK CREDIT LIMIT
    # --------------------------------------------------------

    if new_balance < Decimal("0.00"):
        new_balance = Decimal("0.00")

    # --------------------------------------------------------
    # UPDATE ACCOUNT
    # --------------------------------------------------------

    account.outstanding_amount = new_balance

    # --------------------------------------------------------
    # CANCEL PAYMENT
    # --------------------------------------------------------

    payment.status = "CANCELLED"

    # --------------------------------------------------------
    # CREATE REVERSAL TRANSACTION
    # --------------------------------------------------------

    reversal_transaction = CreditTransaction(
        credit_account_id=account.id,
        order_id=None,
        transaction_type="ADJUSTMENT",
        amount=payment.amount,
        balance_after=new_balance,
        status="REVERSED",
        description=(
            f"Reversal of credit payment "
            f"#{payment.id}"
        ),
        reference=payment.payment_reference,
    )

    db.add(reversal_transaction)

    db.flush()

    return {
        "payment": payment,
        "transaction": reversal_transaction,
        "credit_account": account,
        "previous_balance": previous_balance,
        "restored_amount": payment.amount,
        "new_balance": new_balance,
    }


# ============================================================
# CREDIT ACCOUNT SUMMARY
# ============================================================

def get_credit_account_summary(
    db: Session,
    customer_id: int,
    shop_id: int,
):
    """
    Return complete credit account summary.
    """

    account = get_credit_account(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
    )

    total_paid = get_total_credit_paid(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
    )

    available_credit = (
        account.credit_limit
        - account.outstanding_amount
    )

    if available_credit < Decimal("0.00"):
        available_credit = Decimal("0.00")

    return {
        "credit_account_id": account.id,
        "customer_id": account.customer_id,
        "shop_id": account.shop_id,
        "credit_limit": account.credit_limit,
        "outstanding_amount": (
            account.outstanding_amount
        ),
        "available_credit": available_credit,
        "total_paid": total_paid,
        "status": account.status,
        "is_active": account.is_active,
    }