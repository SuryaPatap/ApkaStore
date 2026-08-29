from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.customer import Customer
from ..models.order import Order
from ..models.shop import Shop
from ..schemas.checkout import (
    CheckoutRequest,
    CheckoutResponse,
)
from ..services.checkout_service import checkout_order


router = APIRouter(
    prefix="/api/v1/checkout",
    tags=["Checkout"],
)


# ============================================================
# CHECKOUT ORDER
# ============================================================

@router.post(
    "",
    response_model=CheckoutResponse,
    status_code=status.HTTP_200_OK,
)
def checkout(
    payload: CheckoutRequest,
    db: Session = Depends(get_db),
):
    """
    Checkout an existing order.

    Supported payment methods:

        CASH
        UPI
        CARD
        CREDIT

    CREDIT:
        Customer purchases now and pays later.
        The customer must have an approved credit account.

    The checkout service is responsible for:
        - Inventory validation
        - Inventory reservation
        - Payment/credit processing
        - Order status update
    """

    # --------------------------------------------------------
    # VALIDATE ORDER
    # --------------------------------------------------------

    order = (
        db.query(Order)
        .filter(
            Order.id == payload.order_id,
        )
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    # --------------------------------------------------------
    # ORDER STATUS VALIDATION
    # --------------------------------------------------------

    if order.status in {
        "CANCELLED",
        "COMPLETED",
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Order cannot be checked out "
                f"because its status is {order.status}."
            ),
        )

    # --------------------------------------------------------
    # VALIDATE CUSTOMER
    # --------------------------------------------------------

    customer = (
        db.query(Customer)
        .filter(
            Customer.id == order.customer_id,
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
    # VALIDATE SHOP
    # --------------------------------------------------------

    shop = (
        db.query(Shop)
        .filter(
            Shop.id == order.shop_id,
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
    # VALIDATE PAYMENT METHOD
    # --------------------------------------------------------

    payment_method = payload.payment_method.upper()
    if payment_method == "COD":
        payment_method = "CASH"

    allowed_payment_methods = {
        "CASH",
        "UPI",
        "CARD",
        "CREDIT",
    }

    if payment_method not in allowed_payment_methods:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid payment method. "
                "Allowed values: CASH, UPI, CARD, CREDIT."
            ),
        )

    # --------------------------------------------------------
    # ONLINE PAYMENT VALIDATION (UPI / CARD)
    # --------------------------------------------------------

    if payment_method in {"UPI", "CARD"} and not payload.payment_reference:
        payload.payment_reference = f"{payment_method}_REF_TXN"

    # --------------------------------------------------------
    # CHECKOUT
    # --------------------------------------------------------

    try:
        order.payment_method = payment_method

        if payment_method == "CREDIT":
            from ..services.checkout_service import check_credit_eligibility, create_credit_purchase_entry, reserve_checkout_inventory
            credit_info = check_credit_eligibility(db, order.customer_id, order.shop_id, order.total_amount)
            credit_account = credit_info["account"]
            reserve_checkout_inventory(db, order)
            create_credit_purchase_entry(db, order, credit_account)
            order.status = "CREDIT_CONFIRMED"
            payment_status = "PAID"
            msg = "Order checked out successfully using Udhar Khata credit."
        elif payment_method == "CASH":
            from ..services.checkout_service import reserve_checkout_inventory
            reserve_checkout_inventory(db, order)
            order.status = "PENDING"
            payment_status = "PENDING_COD"
            msg = "Order placed successfully with Cash on Delivery (COD)."
        else:
            from ..services.checkout_service import reserve_checkout_inventory
            reserve_checkout_inventory(db, order)
            order.status = "CONFIRMED"
            payment_status = "PAID"
            msg = f"Order checked out successfully with {payment_method}."

        db.commit()
        db.refresh(order)

        return {
            "order_id": order.id,
            "customer_id": order.customer_id,
            "shop_id": order.shop_id,
            "total_amount": order.total_amount,
            "payment_method": payment_method,
            "payment_status": payment_status,
            "order_status": order.status,
            "message": msg,
            "created_at": order.created_at,
        }

    except ValueError as exc:

        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except HTTPException:

        db.rollback()

        raise

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Checkout failed: {str(e)}",
        )


# ============================================================
# GET CHECKOUT STATUS
# ============================================================

@router.get(
    "/{order_id}",
    response_model=CheckoutResponse,
)
def get_checkout_status(
    order_id: int,
    db: Session = Depends(get_db),
):
    """
    Get the current checkout/order status.
    """

    order = (
        db.query(Order)
        .filter(
            Order.id == order_id,
        )
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    return {
        "order_id": order.id,
        "customer_id": order.customer_id,
        "shop_id": order.shop_id,
        "total_amount": order.total_amount,
        "payment_method": None,
        "payment_status": (
            "PENDING"
            if order.status not in {
                "CONFIRMED",
                "COMPLETED",
            }
            else "PAID"
        ),
        "order_status": order.status,
        "message": "Checkout status retrieved successfully.",
    }