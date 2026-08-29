from decimal import Decimal

from sqlalchemy.orm import Session

from ..models.cart import Cart
from ..models.cart_item import CartItem
from ..models.product import Product


# ============================================================
# GET OR CREATE ACTIVE CART
# ============================================================

def get_or_create_cart(
    db: Session,
    customer_id: int,
    shop_id: int,
):
    """
    Get the customer's active cart for a shop.

    If an active cart does not exist, create one.
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
# ADD PRODUCT TO CART
# ============================================================

def add_to_cart(
    db: Session,
    customer_id: int,
    shop_id: int,
    product_id: int,
    quantity: int,
):
    """
    Add a product to the customer's cart.

    If the product already exists in the cart,
    increase its quantity.
    """

    if quantity <= 0:
        raise ValueError(
            "Quantity must be greater than zero."
        )

    # --------------------------------------------------------
    # Validate product
    # --------------------------------------------------------

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
        raise ValueError(
            "Product not found or inactive."
        )

    # --------------------------------------------------------
    # Get/create cart
    # --------------------------------------------------------

    cart = get_or_create_cart(
        db=db,
        customer_id=customer_id,
        shop_id=shop_id,
    )

    # --------------------------------------------------------
    # Check existing cart item
    # --------------------------------------------------------

    cart_item = (
        db.query(CartItem)
        .filter(
            CartItem.cart_id == cart.id,
            CartItem.product_id == product_id,
        )
        .first()
    )

    if cart_item is not None:
        cart_item.quantity += quantity
    else:
        cart_item = CartItem(
            cart_id=cart.id,
            product_id=product_id,
            quantity=quantity,
        )

        db.add(cart_item)

    db.flush()

    return cart_item


# ============================================================
# UPDATE CART ITEM
# ============================================================

def update_cart_item(
    db: Session,
    customer_id: int,
    shop_id: int,
    cart_item_id: int,
    quantity: int,
):
    """
    Update quantity of an existing cart item.

    Quantity = 0 removes the item.
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
        raise ValueError(
            "Active cart not found."
        )

    cart_item = (
        db.query(CartItem)
        .filter(
            CartItem.id == cart_item_id,
            CartItem.cart_id == cart.id,
        )
        .first()
    )

    if cart_item is None:
        raise ValueError(
            "Cart item not found."
        )

    # Quantity zero means remove
    if quantity == 0:
        db.delete(cart_item)
        db.flush()
        return None

    if quantity < 0:
        raise ValueError(
            "Quantity cannot be negative."
        )

    cart_item.quantity = quantity

    db.flush()

    return cart_item


# ============================================================
# REMOVE CART ITEM
# ============================================================

def remove_from_cart(
    db: Session,
    customer_id: int,
    shop_id: int,
    cart_item_id: int,
):
    """
    Remove a product from the active cart.
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
        raise ValueError(
            "Active cart not found."
        )

    cart_item = (
        db.query(CartItem)
        .filter(
            CartItem.id == cart_item_id,
            CartItem.cart_id == cart.id,
        )
        .first()
    )

    if cart_item is None:
        raise ValueError(
            "Cart item not found."
        )

    db.delete(cart_item)
    db.flush()

    return True


# ============================================================
# GET CART
# ============================================================

def get_cart(
    db: Session,
    customer_id: int,
    shop_id: int,
):
    """
    Return active cart for customer/shop.
    """

    return (
        db.query(Cart)
        .filter(
            Cart.customer_id == customer_id,
            Cart.shop_id == shop_id,
            Cart.is_active == True,
        )
        .first()
    )


# ============================================================
# CALCULATE CART TOTAL
# ============================================================

def calculate_cart_total(
    cart: Cart,
):
    """
    Calculate current cart total using product prices.

    Formula:
        product.price × quantity
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
# CLEAR CART
# ============================================================

def clear_cart(
    db: Session,
    customer_id: int,
    shop_id: int,
):
    """
    Remove all items from the active cart.
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
        return None

    for item in list(cart.items):
        db.delete(item)

    db.flush()

    return cart


# ============================================================
# CLOSE CART
# ============================================================

def close_cart(
    db: Session,
    cart: Cart,
):
    """
    Mark cart as inactive.

    Usually called after successfully creating an order.
    """

    cart.is_active = False

    db.flush()

    return cart


# ============================================================
# CONVERT CART TO ORDER DATA
# ============================================================

def get_cart_order_items(
    cart: Cart,
):
    """
    Convert cart items into simple order data.

    The order service can use this data when creating
    an Order and OrderItem records.
    """

    if cart is None:
        raise ValueError(
            "Cart not found."
        )

    if not cart.items:
        raise ValueError(
            "Cart is empty."
        )

    items = []

    for item in cart.items:

        if item.product is None:
            raise ValueError(
                f"Product not found for cart item {item.id}."
            )

        items.append(
            {
                "product_id": item.product_id,
                "quantity": item.quantity,
                "unit_price": item.product.price,
            }
        )

    return items