from decimal import Decimal

from sqlalchemy.orm import Session

from ..models.credit_account import CreditAccount
from ..models.credit_transaction import CreditTransaction
from ..models.customer import Customer
from ..models.order import Order
from ..models.shop import Shop


# ============================================================
# GET CREDIT ACCOUNT
# ============================================================

def get_credit_account(
    db: Session,
    customer_id: int,
    shop_id: int,
) -> CreditAccount | None:
    """
    Get the customer's credit account for a specific shop.
    """

    return (
        db.query(CreditAccount)
        .filter(
            CreditAccount.customer_id == customer_id,
            CreditAccount.shop_id == shop_id,
        )
        .first()
    )


# ============================================================
# GET CURRENT CREDIT BALANCE
# ============================================================

def get_credit_balance(
    db: Session,
    customer_id: int,
    shop_id: int,
) -> Decimal:
    """
    Return the customer's current outstanding credit balance.
    """

    account = get_credit_account(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
    )

    if account is None:
        return Decimal("0.00")

    return account.outstanding_amount


# ============================================================
# VALIDATE CUSTOMER AND SHOP
# ============================================================

def validate_customer_shop(
    db: Session,
    customer_id: int,
    shop_id: int,
):
    """
    Validate that customer and shop exist and are active.
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
        raise ValueError("Customer not found.")

    shop = (
        db.query(Shop)
        .filter(
            Shop.id == shop_id,
            Shop.is_active == True,
        )
        .first()
    )

    if shop is None:
        raise ValueError("Shop not found.")

    return customer, shop


# ============================================================
# VALIDATE CREDIT ACCOUNT
# ============================================================

def validate_credit_account(
    db: Session,
    customer_id: int,
    shop_id: int,
):
    """
    Validate customer's credit account.
    """

    account = get_credit_account(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
    )

    if account is None:
        raise ValueError(
            "Customer does not have a credit account with this shop."
        )

    if not account.is_active:
        raise ValueError(
            "Customer credit account is inactive."
        )

    if account.status != "APPROVED":
        raise ValueError(
            "Customer credit account has not been approved."
        )

    return account


# ============================================================
# CHECK CREDIT LIMIT
# ============================================================

def check_credit_limit(
    account: CreditAccount,
    amount: Decimal,
):
    """
    Check whether a new credit purchase is within
    the customer's approved credit limit.
    """

    if amount <= Decimal("0.00"):
        raise ValueError(
            "Credit amount must be greater than zero."
        )

    new_balance = (
        account.outstanding_amount + amount
    )

    if new_balance > account.credit_limit:
        available_credit = (
            account.credit_limit
            - account.outstanding_amount
        )

        if available_credit < Decimal("0.00"):
            available_credit = Decimal("0.00")

        raise ValueError(
            f"Credit limit exceeded. "
            f"Available credit: ₹{available_credit}, "
            f"Requested amount: ₹{amount}."
        )

    return new_balance


# ============================================================
# CHECK DUPLICATE CREDIT PURCHASE
# ============================================================

def credit_purchase_exists(
    db: Session,
    order_id: int,
) -> bool:
    """
    Prevent the same order from creating multiple
    CREDIT_PURCHASE transactions.
    """

    existing = (
        db.query(CreditTransaction)
        .filter(
            CreditTransaction.order_id == order_id,
            CreditTransaction.transaction_type == "CREDIT_PURCHASE",
            CreditTransaction.status == "POSTED",
        )
        .first()
    )

    return existing is not None


# ============================================================
# CREATE CREDIT PURCHASE
# ============================================================

def create_credit_purchase(
    db: Session,
    order: Order,
):
    """
    Create a CREDIT_PURCHASE transaction.

    This increases CreditAccount.outstanding_amount.

    Does NOT commit.
    Caller controls commit/rollback.
    """

    if order is None:
        raise ValueError("Order not found.")

    if order.total_amount <= Decimal("0.00"):
        raise ValueError(
            "Order total must be greater than zero."
        )

    # --------------------------------------------------------
    # Validate customer and shop
    # --------------------------------------------------------

    validate_customer_shop(
        db=db,
        customer_id=order.customer_id,
        shop_id=order.shop_id,
    )

    # --------------------------------------------------------
    # Get approved credit account
    # --------------------------------------------------------

    account = validate_credit_account(
        db=db,
        customer_id=order.customer_id,
        shop_id=order.shop_id,
    )

    # --------------------------------------------------------
    # Prevent duplicate transaction
    # --------------------------------------------------------

    if credit_purchase_exists(
        db=db,
        order_id=order.id,
    ):
        raise ValueError(
            "Credit purchase already recorded for this order."
        )

    # --------------------------------------------------------
    # Previous balance
    # --------------------------------------------------------

    previous_balance = account.outstanding_amount

    # --------------------------------------------------------
    # Check credit limit
    # --------------------------------------------------------

    new_balance = check_credit_limit(
        account=account,
        amount=order.total_amount,
    )

    # --------------------------------------------------------
    # Update account balance
    # --------------------------------------------------------

    account.outstanding_amount = new_balance

    # --------------------------------------------------------
    # Create transaction
    # --------------------------------------------------------

    transaction = CreditTransaction(
        credit_account_id=account.id,
        order_id=order.id,
        transaction_type="CREDIT_PURCHASE",
        amount=order.total_amount,
        balance_after=new_balance,
        status="POSTED",
        description=(
            f"Credit purchase for order #{order.id}"
        ),
        reference=f"ORDER-{order.id}",
    )

    db.add(transaction)

    db.flush()

    return {
        "transaction": transaction,
        "account": account,
        "previous_balance": previous_balance,
        "new_balance": new_balance,
    }


# ============================================================
# RECORD CREDIT PAYMENT
# ============================================================

def record_credit_payment(
    db: Session,
    customer_id: int,
    shop_id: int,
    amount: Decimal,
    reference: str | None = None,
    description: str | None = None,
):
    """
    Record a payment against the customer's outstanding credit.

    Payment decreases outstanding_amount.

    Does NOT commit.
    """

    if amount <= Decimal("0.00"):
        raise ValueError(
            "Payment amount must be greater than zero."
        )

    account = get_credit_account(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
    )

    if account is None:
        raise ValueError(
            "Credit account not found."
        )

    if not account.is_active:
        raise ValueError(
            "Credit account is inactive."
        )

    if amount > account.outstanding_amount:
        raise ValueError(
            "Payment cannot exceed outstanding amount."
        )

    previous_balance = account.outstanding_amount

    new_balance = (
        account.outstanding_amount - amount
    )

    account.outstanding_amount = new_balance

    transaction = CreditTransaction(
        credit_account_id=account.id,
        transaction_type="PAYMENT",
        amount=amount,
        balance_after=new_balance,
        status="POSTED",
        description=description or "Credit account payment.",
        reference=reference,
    )

    db.add(transaction)

    db.flush()

    return {
        "transaction": transaction,
        "account": account,
        "previous_balance": previous_balance,
        "new_balance": new_balance,
    }


# ============================================================
# GET CREDIT TRANSACTIONS
# ============================================================

def get_credit_transactions(
    db: Session,
    customer_id: int,
    shop_id: int,
):
    """
    Return all posted credit transactions for
    a customer/shop account.
    """

    account = get_credit_account(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
    )

    if account is None:
        raise ValueError(
            "Credit account not found."
        )

    return (
        db.query(CreditTransaction)
        .filter(
            CreditTransaction.credit_account_id == account.id,
            CreditTransaction.status == "POSTED",
        )
        .order_by(
            CreditTransaction.id.asc()
        )
        .all()
    )


# ============================================================
# GET CREDIT SUMMARY
# ============================================================

def get_credit_summary(
    db: Session,
    customer_id: int,
    shop_id: int,
):
    """
    Return complete credit summary.
    """

    account = get_credit_account(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
    )

    if account is None:
        raise ValueError(
            "Credit account not found."
        )

    transactions = (
        db.query(CreditTransaction)
        .filter(
            CreditTransaction.credit_account_id == account.id,
            CreditTransaction.status == "POSTED",
        )
        .order_by(
            CreditTransaction.id.asc()
        )
        .all()
    )

    total_credit = Decimal("0.00")
    total_paid = Decimal("0.00")

    for transaction in transactions:

        if transaction.transaction_type == "CREDIT_PURCHASE":
            total_credit += transaction.amount

        elif transaction.transaction_type == "PAYMENT":
            total_paid += transaction.amount

    return {
        "customer_id": customer_id,
        "shop_id": shop_id,
        "credit_limit": account.credit_limit,
        "total_credit": total_credit,
        "total_paid": total_paid,
        "outstanding_balance": account.outstanding_amount,
        "available_credit": max(
            account.credit_limit - account.outstanding_amount,
            Decimal("0.00"),
        ),
        "status": account.status,
        "transaction_count": len(transactions),
    }