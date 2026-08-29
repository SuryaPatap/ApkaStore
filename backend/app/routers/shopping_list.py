from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.cart import Cart
from ..models.cart_item import CartItem
from ..models.customer import Customer
from ..models.product import Product
from ..schemas.shopping_list import (
    ShoppingListCreate,
    ShoppingListResponse,
)


router = APIRouter(
    prefix="/api/v1/shopping-list",
    tags=["Shopping List"],
)


# ============================================================
# CURRENT USER HELPER
# ============================================================

def get_current_customer(
    db: Session,
    user_id: int,
) -> Customer:
    """
    Get customer profile using authenticated user ID.
    """

    customer = (
        db.query(Customer)
        .filter(
            Customer.user_id == user_id,
            Customer.is_active == True,
        )
        .first()
    )

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found.",
        )

    return customer


# ============================================================
# CREATE SHOPPING LIST
# ============================================================

@router.post(
    "",
    response_model=ShoppingListResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shopping_list(
    payload: ShoppingListCreate,
    db: Session = Depends(get_db),
):
    """
    Create a shopping list and optionally add products
    to the customer's cart.

    This endpoint is intentionally independent of the
    authentication dependency until the existing auth
    dependency is confirmed.
    """

    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shopping list cannot be empty.",
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
    # Validate products
    # --------------------------------------------------------

    product_ids = [item.product_id for item in payload.items]

    products = (
        db.query(Product)
        .filter(
            Product.id.in_(product_ids),
            Product.shop_id == payload.shop_id,
            Product.is_active == True,
        )
        .all()
    )

    product_map = {
        product.id: product
        for product in products
    }

    missing_products = [
        product_id
        for product_id in product_ids
        if product_id not in product_map
    ]

    if missing_products:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "Some products were not found.",
                "product_ids": missing_products,
            },
        )

    # --------------------------------------------------------
    # Get / create active cart
    # --------------------------------------------------------

    cart = (
        db.query(Cart)
        .filter(
            Cart.customer_id == payload.customer_id,
            Cart.shop_id == payload.shop_id,
            Cart.is_active == True,
        )
        .first()
    )

    if cart is None:
        cart = Cart(
            customer_id=payload.customer_id,
            shop_id=payload.shop_id,
            is_active=True,
        )

        db.add(cart)
        db.flush()

    # --------------------------------------------------------
    # Add items to cart
    # --------------------------------------------------------

    for requested_item in payload.items:

        existing_item = (
            db.query(CartItem)
            .filter(
                CartItem.cart_id == cart.id,
                CartItem.product_id == requested_item.product_id,
            )
            .first()
        )

        if existing_item:
            existing_item.quantity += requested_item.quantity

        else:
            cart_item = CartItem(
                cart_id=cart.id,
                product_id=requested_item.product_id,
                quantity=requested_item.quantity,
            )

            db.add(cart_item)

    db.commit()
    db.refresh(cart)

    # --------------------------------------------------------
    # Build response
    # --------------------------------------------------------

    response_items = []

    for item in cart.items:

        product = product_map.get(item.product_id)

        if product is None:
            product = (
                db.query(Product)
                .filter(Product.id == item.product_id)
                .first()
            )

        response_items.append(
            {
                "product_id": item.product_id,
                "product_name": (
                    product.name
                    if product
                    else "Unknown Product"
                ),
                "quantity": item.quantity,
                "unit_price": (
                    product.price
                    if product
                    else 0
                ),
            }
        )

    return {
        "cart_id": cart.id,
        "customer_id": cart.customer_id,
        "shop_id": cart.shop_id,
        "items": response_items,
    }


# ============================================================
# GET SHOPPING LIST / CART
# ============================================================

@router.get(
    "/{customer_id}/{shop_id}",
    response_model=ShoppingListResponse,
)
def get_shopping_list(
    customer_id: int,
    shop_id: int,
    db: Session = Depends(get_db),
):
    """
    Get the active shopping list/cart for a customer and shop.
    """

    cart = (
        db.query(Cart)
        .filter(
            Cart.customer_id == customer_id,
            Cart.shop_id == shop_id,
            Cart.is_active == True,
        )
        .first()
    )

    if cart is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shopping list not found.",
        )

    response_items = []

    for item in cart.items:

        product = (
            db.query(Product)
            .filter(Product.id == item.product_id)
            .first()
        )

        if product is None:
            continue

        response_items.append(
            {
                "product_id": product.id,
                "product_name": product.name,
                "quantity": item.quantity,
                "unit_price": product.price,
            }
        )

    return {
        "cart_id": cart.id,
        "customer_id": cart.customer_id,
        "shop_id": cart.shop_id,
        "items": response_items,
    }


# ============================================================
# ADD ONE PRODUCT
# ============================================================

@router.post(
    "/{customer_id}/{shop_id}/item",
    response_model=ShoppingListResponse,
)
def add_shopping_list_item(
    customer_id: int,
    shop_id: int,
    product_id: int,
    quantity: int = 1,
    db: Session = Depends(get_db),
):
    """
    Add one product to the customer's shopping list.
    """

    if quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be greater than zero.",
        )

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

    product = (
        db.query(Product)
        .filter(
            Product.id == product_id,
            Product.shop_id == shop_id,
            Product.is_active == True,
        )
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found in this shop.",
        )

    cart = (
        db.query(Cart)
        .filter(
            Cart.customer_id == customer_id,
            Cart.shop_id == shop_id,
            Cart.is_active == True,
        )
        .first()
    )

    if cart is None:
        cart = Cart(
            customer_id=customer_id,
            shop_id=shop_id,
            is_active=True,
        )

        db.add(cart)
        db.flush()

    cart_item = (
        db.query(CartItem)
        .filter(
            CartItem.cart_id == cart.id,
            CartItem.product_id == product_id,
        )
        .first()
    )

    if cart_item:
        cart_item.quantity += quantity
    else:
        cart_item = CartItem(
            cart_id=cart.id,
            product_id=product_id,
            quantity=quantity,
        )

        db.add(cart_item)

    db.commit()
    db.refresh(cart)

    return {
        "cart_id": cart.id,
        "customer_id": cart.customer_id,
        "shop_id": cart.shop_id,
        "items": [
            {
                "product_id": item.product_id,
                "product_name": item.product.name,
                "quantity": item.quantity,
                "unit_price": item.product.price,
            }
            for item in cart.items
        ],
    }


# ============================================================
# DELETE SHOPPING LIST
# ============================================================

@router.delete(
    "/{customer_id}/{shop_id}",
)
def clear_shopping_list(
    customer_id: int,
    shop_id: int,
    db: Session = Depends(get_db),
):
    """
    Clear the active shopping list.
    """

    cart = (
        db.query(Cart)
        .filter(
            Cart.customer_id == customer_id,
            Cart.shop_id == shop_id,
            Cart.is_active == True,
        )
        .first()
    )

    if cart is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shopping list not found.",
        )

    cart.is_active = False

    db.commit()

    return {
        "message": "Shopping list cleared successfully.",
        "cart_id": cart.id,
    }