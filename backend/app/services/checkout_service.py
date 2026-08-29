from decimal import Decimal

from sqlalchemy.orm import Session

from ..models.cart import Cart
from ..models.order import Order
from ..models.order_item import OrderItem
from ..models.credit_account import CreditAccount
from ..models.credit_transaction import CreditTransaction
from ..models.credit_ledger import CreditLedger

from ..services.cart_service import close_cart
from ..services.order_service import (
    check_order_item_inventory,
    reserve_order_inventory,
    can_confirm_order,
)


# ============================================================
# CHECKOUT PAYMENT TYPES
# ============================================================

PAYMENT_TYPE_PAY_NOW = "PAY_NOW"
PAYMENT_TYPE_CREDIT = "CREDIT"


# ============================================================
# GET ACTIVE CART
# ============================================================

def get_active_cart(
    db: Session,
    customer_id: int,
    shop_id: int,
):
    """
    Get customer's active cart for a specific shop.
    """

    cart = (
        db.query(Cart)
        .filter(
            Cart.customer_id == customer_id,
            Cart.shop_id == shop_id,
            Cart.is_active.is_(True),
        )
        .first()
    )

    if cart is None:
        raise ValueError("Active cart not found.")

    return cart


# ============================================================
# VALIDATE CART
# ============================================================

def validate_cart(cart: Cart):
    """
    Validate that the cart can be checked out.
    """

    if cart is None:
        raise ValueError("Cart not found.")

    if not cart.is_active:
        raise ValueError("Cart is no longer active.")

    if not cart.items:
        raise ValueError("Cart is empty.")

    for item in cart.items:

        if item.product is None:
            raise ValueError(
                f"Product not found for cart item {item.id}."
            )

        if not item.product.is_active:
            raise ValueError(
                f"Product '{item.product.name}' "
                "is no longer available."
            )

        if item.quantity <= 0:
            raise ValueError(
                f"Invalid quantity for cart item {item.id}."
            )


# ============================================================
# CALCULATE CART TOTAL
# ============================================================

def calculate_checkout_total(
    cart: Cart,
) -> Decimal:
    """
    Calculate checkout total using current product prices.
    """

    total = Decimal("0.00")

    for item in cart.items:

        if item.product is None:
            continue

        total += (
            item.product.price *
            item.quantity
        )

    return total


# ============================================================
# GET CREDIT ACCOUNT
# ============================================================

def get_credit_account(
    db: Session,
    customer_id: int,
    shop_id: int,
) -> CreditAccount:
    """
    Get the customer's credit account for a shop.
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
            "Customer does not have a credit account "
            "with this shop."
        )

    return account


# ============================================================
# CHECK CREDIT ELIGIBILITY
# ============================================================

def check_credit_eligibility(
    db: Session,
    customer_id: int,
    shop_id: int,
    amount: Decimal,
):
    """
    Check whether the customer can use shop credit.

    Requirements:

    1. Credit account must exist.
    2. Account must be active.
    3. Account must be APPROVED.
    4. Requested amount must be greater than zero.
    5. New outstanding balance must not exceed credit limit.
    """

    if amount <= Decimal("0.00"):
        raise ValueError(
            "Credit purchase amount must be greater than zero."
        )

    account = get_credit_account(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
    )

    # --------------------------------------------------------
    # ACTIVE ACCOUNT
    # --------------------------------------------------------

    if not account.is_active:
        raise ValueError(
            "Customer credit account is inactive."
        )

    # --------------------------------------------------------
    # APPROVAL STATUS
    # --------------------------------------------------------

    if account.status not in ["APPROVED", "ACTIVE"]:
        raise ValueError(
            "Customer credit account has not been "
            "approved by the shopkeeper."
        )

    # --------------------------------------------------------
    # CREDIT LIMIT
    # --------------------------------------------------------

    credit_limit = account.credit_limit

    if credit_limit <= Decimal("0.00"):
        raise ValueError(
            "Customer credit limit is not available."
        )

    # --------------------------------------------------------
    # CURRENT OUTSTANDING
    # --------------------------------------------------------

    current_balance = account.outstanding_amount

    if current_balance < Decimal("0.00"):
        current_balance = Decimal("0.00")

    # --------------------------------------------------------
    # NEW OUTSTANDING
    # --------------------------------------------------------

    new_balance = (
        current_balance + amount
    )

    # --------------------------------------------------------
    # LIMIT CHECK
    # --------------------------------------------------------

    if new_balance > credit_limit:

        available_credit = (
            credit_limit - current_balance
        )

        if available_credit < Decimal("0.00"):
            available_credit = Decimal("0.00")

        raise ValueError(
            f"Credit limit exceeded. "
            f"Credit limit: ₹{credit_limit}, "
            f"Current outstanding: ₹{current_balance}, "
            f"Available credit: ₹{available_credit}, "
            f"Requested purchase: ₹{amount}."
        )

    return {
        "account": account,
        "current_balance": current_balance,
        "credit_limit": credit_limit,
        "available_credit": (
            credit_limit - current_balance
        ),
        "new_balance": new_balance,
    }


# ============================================================
# CHECK DUPLICATE CREDIT PURCHASE
# ============================================================

def credit_purchase_exists(
    db: Session,
    order_id: int,
) -> bool:
    """
    Check whether a CREDIT_PURCHASE transaction
    already exists for an order.
    """

    existing = (
        db.query(CreditTransaction)
        .filter(
            CreditTransaction.order_id == order_id,
            CreditTransaction.transaction_type
            == "CREDIT_PURCHASE",
            CreditTransaction.status == "POSTED",
        )
        .first()
    )

    return existing is not None


# ============================================================
# CREATE CREDIT PURCHASE TRANSACTION
# ============================================================

def create_credit_purchase_entry(
    db: Session,
    order: Order,
    credit_account: CreditAccount,
):
    """
    Create a CREDIT_PURCHASE transaction.

    This function:

    1. Prevents duplicate credit transactions.
    2. Calculates the new outstanding balance.
    3. Updates CreditAccount.outstanding_amount.
    4. Creates CreditTransaction.
    5. Does NOT commit.

    The caller controls commit/rollback.
    """

    if order is None:
        raise ValueError("Order not found.")

    if credit_account is None:
        raise ValueError(
            "Credit account not found."
        )

    if order.total_amount <= Decimal("0.00"):
        raise ValueError(
            "Order total must be greater than zero."
        )

    # --------------------------------------------------------
    # VERIFY ACCOUNT / ORDER OWNERSHIP
    # --------------------------------------------------------

    if (
        credit_account.customer_id
        != order.customer_id
    ):
        raise ValueError(
            "Credit account does not belong "
            "to this customer."
        )

    if (
        credit_account.shop_id
        != order.shop_id
    ):
        raise ValueError(
            "Credit account does not belong "
            "to this shop."
        )

    # --------------------------------------------------------
    # PREVENT DUPLICATE TRANSACTION
    # --------------------------------------------------------

    if credit_purchase_exists(
        db=db,
        order_id=order.id,
    ):
        raise ValueError(
            "Credit purchase already recorded "
            "for this order."
        )

    # --------------------------------------------------------
    # CURRENT BALANCE
    # --------------------------------------------------------

    previous_balance = (
        credit_account.outstanding_amount
    )

    if previous_balance < Decimal("0.00"):
        previous_balance = Decimal("0.00")

    # --------------------------------------------------------
    # NEW BALANCE
    # --------------------------------------------------------

    new_balance = (
        previous_balance
        + order.total_amount
    )

    # --------------------------------------------------------
    # CREDIT LIMIT CHECK
    # --------------------------------------------------------

    if new_balance > credit_account.credit_limit:
        raise ValueError(
            "Credit limit exceeded."
        )

    # --------------------------------------------------------
    # UPDATE CREDIT ACCOUNT
    # --------------------------------------------------------

    credit_account.outstanding_amount = (
        new_balance
    )

    # --------------------------------------------------------
    # CREATE CREDIT TRANSACTION
    # --------------------------------------------------------

    transaction = CreditTransaction(
        credit_account_id=credit_account.id,
        order_id=order.id,
        transaction_type="CREDIT_PURCHASE",
        amount=order.total_amount,
        balance_after=new_balance,
        status="POSTED",
        description=(
            f"Credit purchase for order #{order.id}"
        ),
        reference=None,
    )

    db.add(transaction)

    # Also record in unified credit ledger
    ledger_entry = CreditLedger(
        customer_id=order.customer_id,
        shop_id=order.shop_id,
        order_id=order.id,
        transaction_type="CREDIT_PURCHASE",
        amount=order.total_amount,
        balance_after=new_balance,
        description=f"Udhar purchase for order #{order.id}",
    )
    db.add(ledger_entry)

    # Flush so transaction.id is available
    db.flush()

    return transaction


# ============================================================
# CREATE ORDER FROM CART
# ============================================================

def create_order_from_cart(
    db: Session,
    cart: Cart,
):
    """
    Create Order and OrderItems from active cart.

    Does NOT commit.
    """

    validate_cart(cart)

    total_amount = calculate_checkout_total(
        cart
    )

    if total_amount <= Decimal("0.00"):
        raise ValueError(
            "Checkout total must be greater than zero."
        )

    # --------------------------------------------------------
    # CREATE ORDER
    # --------------------------------------------------------

    order = Order(
        customer_id=cart.customer_id,
        shop_id=cart.shop_id,
        status="PENDING",
        total_amount=total_amount,
    )

    db.add(order)

    db.flush()

    # --------------------------------------------------------
    # CREATE ORDER ITEMS
    # --------------------------------------------------------

    for cart_item in cart.items:

        if cart_item.product is None:
            raise ValueError(
                f"Product not found for cart item "
                f"{cart_item.id}."
            )

        order_item = OrderItem(
            order_id=order.id,
            product_id=cart_item.product_id,
            quantity=cart_item.quantity,
            unit_price=cart_item.product.price,
            status="PENDING",
        )

        db.add(order_item)

    db.flush()

    # --------------------------------------------------------
    # REFRESH ORDER
    # --------------------------------------------------------

    db.refresh(order)

    return order


# ============================================================
# CHECKOUT INVENTORY
# ============================================================

def check_checkout_inventory(
    db: Session,
    order: Order,
):
    """
    Check inventory for every order item.

    Does NOT deduct inventory.
    """

    pending_substitution = False
    all_available = True

    for item in order.items:

        result = check_order_item_inventory(
            db=db,
            order_item=item,
        )

        if not result["available"]:

            all_available = False

            if (
                result.get("substitution_request")
                is not None
            ):
                pending_substitution = True

    db.flush()

    return {
        "available": all_available,
        "pending_substitution": pending_substitution,
    }


# ============================================================
# RESERVE CHECKOUT INVENTORY
# ============================================================

def reserve_checkout_inventory(
    db: Session,
    order: Order,
):
    """
    Reserve inventory using order_service.
    """

    return reserve_order_inventory(
        db=db,
        order=order,
    )


# ============================================================
# COMPLETE PAY-NOW CHECKOUT
# ============================================================

def checkout_pay_now(
    db: Session,
    customer_id: int,
    shop_id: int,
):
    """
    Checkout active cart using immediate payment.

    Payment gateway processing happens separately.

    This function creates the order and reserves inventory,
    but does NOT mark the order as PAID.
    """

    cart = get_active_cart(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
    )

    validate_cart(cart)

    # --------------------------------------------------------
    # CREATE ORDER
    # --------------------------------------------------------

    order = create_order_from_cart(
        db=db,
        cart=cart,
    )

    # --------------------------------------------------------
    # CHECK INVENTORY
    # --------------------------------------------------------

    inventory_result = check_checkout_inventory(
        db=db,
        order=order,
    )

    # --------------------------------------------------------
    # SUBSTITUTION REQUIRED
    # --------------------------------------------------------

    if inventory_result["pending_substitution"]:

        order.status = "SUBSTITUTION_PENDING"

        db.flush()

        return {
            "order": order,
            "payment_type": PAYMENT_TYPE_PAY_NOW,
            "status": "SUBSTITUTION_PENDING",
            "payment_required": False,
            "message": (
                "Some products are unavailable. "
                "Customer substitution decision "
                "is required."
            ),
        }

    # --------------------------------------------------------
    # RESERVE INVENTORY
    # --------------------------------------------------------

    reserve_checkout_inventory(
        db=db,
        order=order,
    )

    # --------------------------------------------------------
    # CONFIRM ORDER
    # --------------------------------------------------------

    confirmation = can_confirm_order(
        db=db,
        order=order,
    )

    if not confirmation["can_confirm"]:

        order.status = "PENDING"

        db.flush()

        return {
            "order": order,
            "payment_type": PAYMENT_TYPE_PAY_NOW,
            "status": "PENDING",
            "payment_required": False,
            "message": confirmation["reason"],
        }

    # --------------------------------------------------------
    # PAYMENT PENDING
    # --------------------------------------------------------

    order.status = "PAYMENT_PENDING"

    # --------------------------------------------------------
    # CLOSE CART
    # --------------------------------------------------------

    close_cart(
        db=db,
        cart=cart,
    )

    db.flush()

    return {
        "order": order,
        "payment_type": PAYMENT_TYPE_PAY_NOW,
        "status": "PAYMENT_PENDING",
        "payment_required": True,
        "amount": order.total_amount,
        "message": (
            "Order created successfully. "
            "Payment is required."
        ),
    }


# ============================================================
# COMPLETE CREDIT CHECKOUT
# ============================================================

def checkout_credit(
    db: Session,
    customer_id: int,
    shop_id: int,
):
    """
    Checkout active cart using approved customer credit.

    Flow:

        Cart
          ↓
        Validate cart
          ↓
        Calculate total
          ↓
        Validate CreditAccount
          ↓
        Create Order
          ↓
        Check inventory
          ↓
        Reserve inventory
          ↓
        Create CreditTransaction
          ↓
        Update CreditAccount.outstanding_amount
          ↓
        CREDIT_CONFIRMED
          ↓
        Close cart
    """

    # --------------------------------------------------------
    # GET CART
    # --------------------------------------------------------

    cart = get_active_cart(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
    )

    validate_cart(cart)

    # --------------------------------------------------------
    # CALCULATE TOTAL
    # --------------------------------------------------------

    total_amount = calculate_checkout_total(
        cart
    )

    if total_amount <= Decimal("0.00"):
        raise ValueError(
            "Checkout total must be greater than zero."
        )

    # --------------------------------------------------------
    # VALIDATE CREDIT
    # --------------------------------------------------------

    credit_info = check_credit_eligibility(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
        amount=total_amount,
    )

    credit_account = credit_info["account"]

    # --------------------------------------------------------
    # CREATE ORDER
    # --------------------------------------------------------

    order = create_order_from_cart(
        db=db,
        cart=cart,
    )

    # --------------------------------------------------------
    # CHECK INVENTORY
    # --------------------------------------------------------

    inventory_result = check_checkout_inventory(
        db=db,
        order=order,
    )

    # --------------------------------------------------------
    # SUBSTITUTION REQUIRED
    # --------------------------------------------------------

    if inventory_result["pending_substitution"]:

        order.status = "SUBSTITUTION_PENDING"

        db.flush()

        return {
            "order": order,
            "payment_type": PAYMENT_TYPE_CREDIT,
            "status": "SUBSTITUTION_PENDING",
            "credit_created": False,
            "payment_required": False,
            "message": (
                "Some products are unavailable. "
                "Resolve substitutions before "
                "credit purchase is posted."
            ),
        }

    # --------------------------------------------------------
    # RESERVE INVENTORY
    # --------------------------------------------------------

    reserve_checkout_inventory(
        db=db,
        order=order,
    )

    # --------------------------------------------------------
    # CONFIRM ORDER
    # --------------------------------------------------------

    confirmation = can_confirm_order(
        db=db,
        order=order,
    )

    if not confirmation["can_confirm"]:

        order.status = "PENDING"

        db.flush()

        return {
            "order": order,
            "payment_type": PAYMENT_TYPE_CREDIT,
            "status": "PENDING",
            "credit_created": False,
            "payment_required": False,
            "message": confirmation["reason"],
        }

    # --------------------------------------------------------
    # CREATE CREDIT TRANSACTION
    # --------------------------------------------------------

    transaction = create_credit_purchase_entry(
        db=db,
        order=order,
        credit_account=credit_account,
    )

    # --------------------------------------------------------
    # MARK ORDER CREDIT CONFIRMED
    # --------------------------------------------------------

    order.status = "CREDIT_CONFIRMED"

    # --------------------------------------------------------
    # CLOSE CART
    # --------------------------------------------------------

    close_cart(
        db=db,
        cart=cart,
    )

    db.flush()

    return {
        "order": order,
        "payment_type": PAYMENT_TYPE_CREDIT,
        "status": "CREDIT_CONFIRMED",
        "credit_created": True,
        "credit_transaction_id": transaction.id,
        "previous_balance": credit_info["current_balance"],
        "new_balance": transaction.balance_after,
        "credit_limit": credit_info["credit_limit"],
        "available_credit": (
            credit_info["credit_limit"]
            - transaction.balance_after
        ),
        "payment_required": False,
        "message": (
            "Order successfully added to "
            "customer's credit account."
        ),
    }


# ============================================================
# MAIN CHECKOUT FUNCTION
# ============================================================

def checkout(
    db: Session,
    customer_id: int,
    shop_id: int,
    payment_type: str,
):
    """
    Main checkout entry point.

    Supported payment types:

        PAY_NOW
        CREDIT
    """

    if not payment_type:
        raise ValueError(
            "Payment type is required."
        )

    payment_type = (
        payment_type.upper().strip()
    )

    try:

        # ----------------------------------------------------
        # PAY NOW
        # ----------------------------------------------------

        if payment_type == PAYMENT_TYPE_PAY_NOW:

            result = checkout_pay_now(
                db=db,
                customer_id=customer_id,
                shop_id=shop_id,
            )

        # ----------------------------------------------------
        # CREDIT
        # ----------------------------------------------------

        elif payment_type == PAYMENT_TYPE_CREDIT:

            result = checkout_credit(
                db=db,
                customer_id=customer_id,
                shop_id=shop_id,
            )

        # ----------------------------------------------------
        # INVALID PAYMENT TYPE
        # ----------------------------------------------------

        else:
            raise ValueError(
                "Invalid payment type. "
                "Allowed values: PAY_NOW, CREDIT."
            )

        # ----------------------------------------------------
        # COMMIT
        # ----------------------------------------------------

        db.commit()

        # ----------------------------------------------------
        # REFRESH ORDER
        # ----------------------------------------------------

        db.refresh(result["order"])

        return result

    except Exception:
        # ----------------------------------------------------
        # ROLLBACK
        # ----------------------------------------------------

        db.rollback()
        raise


# ============================================================
# CHECKOUT ORDER
# ============================================================

def checkout_order(
    db: Session,
    customer_id: int,
    shop_id: int,
    payment_type: str,
):
    """
    Public checkout entry point used by checkout router.

    Supported payment types:

        PAY_NOW
        CREDIT
    """

    return checkout(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
        payment_type=payment_type,
    )