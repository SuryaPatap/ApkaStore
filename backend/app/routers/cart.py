from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db

from ..models.user import User
from ..models.customer import Customer
from ..models.shop import Shop
from ..models.product import Product
from ..models.cart import Cart
from ..models.cart_item import CartItem
from ..models.inventory import Inventory

from ..schemas.cart import (
    CartItemCreate,
    CartItemUpdate,
    CartItemResponse,
    CartResponse,
)

from ..core.dependencies import get_current_user


router = APIRouter(
    prefix="/api/v1/cart",
    tags=["Cart"],
)


# ============================================================
# CUSTOMER
# ============================================================

def get_customer_for_user(
    db: Session,
    current_user: User,
):
    customer = (
        db.query(Customer)
        .filter(
            Customer.user_id == current_user.id,
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
# SHOP
# ============================================================

def get_active_shop(
    db: Session,
    shop_id: int,
):
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

    return shop


# ============================================================
# GET OR CREATE ACTIVE CART
# ============================================================

def get_or_create_cart(
    db: Session,
    customer_id: int,
    shop_id: int,
):
    cart = (
        db.query(Cart)
        .filter(
            Cart.customer_id == customer_id,
            Cart.shop_id == shop_id,
            Cart.is_active == True,
        )
        .first()
    )

    if cart is not None:
        return cart

    cart = Cart(
        customer_id=customer_id,
        shop_id=shop_id,
        is_active=True,
    )

    db.add(cart)
    db.flush()

    return cart


# ============================================================
# CALCULATE CART TOTAL
# ============================================================

def calculate_cart_total(
    cart: Cart,
):
    total = Decimal("0.00")

    for item in cart.items:

        if item.product is None:
            continue

        total += (
            Decimal(str(item.product.price))
            * item.quantity
        )

    return total


# ============================================================
# BUILD CART RESPONSE
# ============================================================

def build_cart_response(
    cart: Cart,
):
    items = []

    for item in cart.items:

        if item.product is None:
            continue

        unit_price = Decimal(
            str(item.product.price)
        )

        total_price = (
            unit_price
            * item.quantity
        )

        items.append(
            {
                "id": item.id,
                "product_id": item.product.id,
                "product_name": item.product.name,
                "quantity": item.quantity,
                "unit_price": unit_price,
                "total_price": total_price,
            }
        )

    return {
        "id": cart.id,
        "customer_id": cart.customer_id,
        "shop_id": cart.shop_id,
        "is_active": cart.is_active,
        "total_amount": calculate_cart_total(cart),
        "items": items,
        "created_at": cart.created_at,
        "updated_at": cart.updated_at,
    }


# ============================================================
# GET CART
# ============================================================

@router.get(
    "/{shop_id}",
    response_model=CartResponse,
)
def get_cart(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get customer's active cart for a shop.
    """

    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can access cart.",
        )

    customer = get_customer_for_user(
        db=db,
        current_user=current_user,
    )

    get_active_shop(
        db=db,
        shop_id=shop_id,
    )

    cart = get_or_create_cart(
        db=db,
        customer_id=customer.id,
        shop_id=shop_id,
    )

    db.commit()
    db.refresh(cart)

    return build_cart_response(cart)


# ============================================================
# ADD PRODUCT TO CART
# ============================================================

@router.post(
    "/{shop_id}/items",
    response_model=CartResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_cart_item(
    shop_id: int,
    item_data: CartItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Add a product to customer's cart.

    If the product already exists in the cart,
    its quantity is increased.
    """

    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can use cart.",
        )

    customer = get_customer_for_user(
        db=db,
        current_user=current_user,
    )

    get_active_shop(
        db=db,
        shop_id=shop_id,
    )

    # --------------------------------------------------------
    # VALIDATE QUANTITY
    # --------------------------------------------------------

    if item_data.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be greater than zero.",
        )

    # --------------------------------------------------------
    # PRODUCT
    # --------------------------------------------------------

    product = (
        db.query(Product)
        .filter(
            Product.id == item_data.product_id,
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

    # --------------------------------------------------------
    # CART
    # --------------------------------------------------------

    cart = get_or_create_cart(
        db=db,
        customer_id=customer.id,
        shop_id=shop_id,
    )

    # --------------------------------------------------------
    # EXISTING ITEM
    # --------------------------------------------------------

    cart_item = (
        db.query(CartItem)
        .filter(
            CartItem.cart_id == cart.id,
            CartItem.product_id == product.id,
        )
        .first()
    )

    if cart_item:

        cart_item.quantity += item_data.quantity

    else:

        cart_item = CartItem(
            cart_id=cart.id,
            product_id=product.id,
            quantity=item_data.quantity,
        )

        db.add(cart_item)

    db.commit()
    db.refresh(cart)

    return build_cart_response(cart)


# ============================================================
# UPDATE CART ITEM
# ============================================================

@router.patch(
    "/{shop_id}/items/{item_id}",
    response_model=CartResponse,
)
def update_cart_item(
    shop_id: int,
    item_id: int,
    item_data: CartItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Change the quantity of an existing cart item.
    """

    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can modify cart.",
        )

    customer = get_customer_for_user(
        db=db,
        current_user=current_user,
    )

    cart = (
        db.query(Cart)
        .filter(
            Cart.customer_id == customer.id,
            Cart.shop_id == shop_id,
            Cart.is_active == True,
        )
        .first()
    )

    if cart is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart not found.",
        )

    cart_item = (
        db.query(CartItem)
        .filter(
            CartItem.id == item_id,
            CartItem.cart_id == cart.id,
        )
        .first()
    )

    if cart_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart item not found.",
        )

    # --------------------------------------------------------
    # ZERO = REMOVE
    # --------------------------------------------------------

    if item_data.quantity <= 0:

        db.delete(cart_item)

    else:

        cart_item.quantity = item_data.quantity

    db.commit()
    db.refresh(cart)

    return build_cart_response(cart)


# ============================================================
# REMOVE CART ITEM
# ============================================================

@router.delete(
    "/{shop_id}/items/{item_id}",
    response_model=CartResponse,
)
def remove_cart_item(
    shop_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove one product from the cart.
    """

    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can modify cart.",
        )

    customer = get_customer_for_user(
        db=db,
        current_user=current_user,
    )

    cart = (
        db.query(Cart)
        .filter(
            Cart.customer_id == customer.id,
            Cart.shop_id == shop_id,
            Cart.is_active == True,
        )
        .first()
    )

    if cart is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart not found.",
        )

    cart_item = (
        db.query(CartItem)
        .filter(
            CartItem.id == item_id,
            CartItem.cart_id == cart.id,
        )
        .first()
    )

    if cart_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart item not found.",
        )

    db.delete(cart_item)

    db.commit()
    db.refresh(cart)

    return build_cart_response(cart)


# ============================================================
# CLEAR CART
# ============================================================

@router.delete(
    "/{shop_id}/clear",
)
def clear_cart(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove all items from the customer's cart.
    """

    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can modify cart.",
        )

    customer = get_customer_for_user(
        db=db,
        current_user=current_user,
    )

    cart = (
        db.query(Cart)
        .filter(
            Cart.customer_id == customer.id,
            Cart.shop_id == shop_id,
            Cart.is_active == True,
        )
        .first()
    )

    if cart is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart not found.",
        )

    for item in list(cart.items):
        db.delete(item)

    db.commit()

    return {
        "message": "Cart cleared successfully.",
        "cart_id": cart.id,
        "shop_id": shop_id,
    }