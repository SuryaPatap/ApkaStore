from sqlalchemy.orm import Session

from ..models.inventory import Inventory
from ..models.order_item import OrderItem
from ..models.product import Product
from ..models.substitution_request import SubstitutionRequest


# ============================================================
# INVENTORY
# ============================================================

def get_inventory(
    db: Session,
    shop_id: int,
    product_id: int,
    lock: bool = False,
):
    """
    Get active inventory for a product in a specific shop.

    lock=True:
        Uses SELECT FOR UPDATE.

    This prevents concurrent transactions from
    overselling the same inventory.
    """

    query = (
        db.query(Inventory)
        .filter(
            Inventory.shop_id == shop_id,
            Inventory.product_id == product_id,
            Inventory.is_active == True,
        )
    )

    if lock:
        query = query.with_for_update()

    return query.first()


# ============================================================
# FIND SUBSTITUTE PRODUCT
# ============================================================

def find_substitute_product(
    db: Session,
    order_item: OrderItem,
):
    """
    Find an alternative product for an unavailable order item.

    Rules:
        - Same shop
        - Active product
        - Different from original product
        - Enough inventory
        - Cheapest product first
        - Do not select another product already present
          in the same order
    """

    order = order_item.order

    if order is None:
        return None

    # --------------------------------------------------------
    # ORIGINAL PRODUCT
    # --------------------------------------------------------

    original_product = (
        db.query(Product)
        .filter(
            Product.id == order_item.product_id,
            Product.shop_id == order.shop_id,
            Product.is_active == True,
        )
        .first()
    )

    if original_product is None:
        return None

    # --------------------------------------------------------
    # PRODUCTS ALREADY PRESENT IN ORDER
    # --------------------------------------------------------

    existing_product_ids = [
        item.product_id
        for item in order.items
        if item.id != order_item.id
    ]

    # --------------------------------------------------------
    # FIND SUBSTITUTE
    # --------------------------------------------------------

    query = (
        db.query(Product)
        .join(
            Inventory,
            Inventory.product_id == Product.id,
        )
        .filter(
            Product.shop_id == order.shop_id,
            Product.id != original_product.id,
            Product.is_active == True,

            Inventory.shop_id == order.shop_id,
            Inventory.is_active == True,
            Inventory.stock_quantity >= order_item.quantity,
        )
    )

    # Do not suggest a product already present
    # in this order.
    if existing_product_ids:
        query = query.filter(
            ~Product.id.in_(existing_product_ids)
        )

    candidates = (
        query
        .order_by(
            Product.price.asc(),
            Product.id.asc(),
        )
        .all()
    )

    return candidates[0] if candidates else None


# ============================================================
# CREATE SUBSTITUTION REQUEST
# ============================================================

def create_substitution_request(
    db: Session,
    order_item: OrderItem,
):
    """
    Create a pending substitution request.

    Duplicate pending substitution requests
    are prevented.
    """

    existing = (
        db.query(SubstitutionRequest)
        .filter(
            SubstitutionRequest.order_item_id == order_item.id,
            SubstitutionRequest.status == "PENDING",
        )
        .first()
    )

    if existing is not None:
        order_item.status = "SUBSTITUTION_PENDING"
        return existing

    substitute = find_substitute_product(
        db=db,
        order_item=order_item,
    )

    if substitute is None:
        return None

    substitution = SubstitutionRequest(
        order_item_id=order_item.id,
        original_product_id=order_item.product_id,
        suggested_product_id=substitute.id,
        requested_quantity=order_item.quantity,
        status="PENDING",
    )

    db.add(substitution)

    order_item.status = "SUBSTITUTION_PENDING"

    return substitution


# ============================================================
# CHECK ORDER ITEM INVENTORY
# ============================================================

def check_order_item_inventory(
    db: Session,
    order_item: OrderItem,
):
    """
    Check whether enough inventory exists.

    This function ONLY checks inventory.

    It does NOT deduct stock.
    """

    order = order_item.order

    if order is None:
        return {
            "available": False,
            "inventory": None,
            "substitution_request": None,
        }

    inventory = get_inventory(
        db=db,
        shop_id=order.shop_id,
        product_id=order_item.product_id,
        lock=False,
    )

    # --------------------------------------------------------
    # AVAILABLE
    # --------------------------------------------------------

    if (
        inventory is not None
        and inventory.stock_quantity >= order_item.quantity
    ):
        order_item.status = "AVAILABLE"

        return {
            "available": True,
            "inventory": inventory,
            "substitution_request": None,
        }

    # --------------------------------------------------------
    # UNAVAILABLE
    # --------------------------------------------------------

    substitution = create_substitution_request(
        db=db,
        order_item=order_item,
    )

    return {
        "available": False,
        "inventory": inventory,
        "substitution_request": substitution,
    }


# ============================================================
# RESERVE SINGLE ORDER ITEM INVENTORY
# ============================================================

def reserve_order_item_inventory(
    db: Session,
    order_item: OrderItem,
):
    """
    Atomically reserve inventory for one order item.

    Uses SELECT FOR UPDATE.

    Raises ValueError if inventory is unavailable.
    """

    order = order_item.order

    if order is None:
        raise ValueError(
            "Order not found for order item."
        )

    # --------------------------------------------------------
    # ITEMS THAT DO NOT CONSUME INVENTORY
    # --------------------------------------------------------

    if order_item.status in {
        "SUBSTITUTION_REJECTED",
        "SUBSTITUTION_PENDING",
        "CANCELLED",
    }:
        return None

    # --------------------------------------------------------
    # ALREADY RESERVED
    # --------------------------------------------------------

    if order_item.status == "RESERVED":
        return None

    # --------------------------------------------------------
    # ONLY USABLE ITEMS
    # --------------------------------------------------------

    if order_item.status not in {
        "AVAILABLE",
        "SUBSTITUTION_ACCEPTED",
    }:
        return None

    # --------------------------------------------------------
    # LOCK INVENTORY
    # --------------------------------------------------------

    inventory = get_inventory(
        db=db,
        shop_id=order.shop_id,
        product_id=order_item.product_id,
        lock=True,
    )

    if inventory is None:
        raise ValueError(
            f"Inventory not found for product "
            f"{order_item.product_id}."
        )

    # --------------------------------------------------------
    # CHECK STOCK AFTER LOCK
    # --------------------------------------------------------

    if inventory.stock_quantity < order_item.quantity:
        raise ValueError(
            f"Insufficient inventory for product "
            f"{order_item.product_id}. "
            f"Available: {inventory.stock_quantity}, "
            f"Required: {order_item.quantity}."
        )

    # --------------------------------------------------------
    # DEDUCT STOCK
    # --------------------------------------------------------

    inventory.stock_quantity -= order_item.quantity

    # --------------------------------------------------------
    # MARK RESERVED
    # --------------------------------------------------------

    order_item.status = "RESERVED"

    return inventory


# ============================================================
# RESERVE COMPLETE ORDER INVENTORY
# ============================================================

def reserve_order_inventory(
    db: Session,
    order,
):
    """
    Reserve inventory for every usable item in an order.

    Safe against duplicate reservation.

    Items consuming inventory:

        AVAILABLE
        SUBSTITUTION_ACCEPTED

    Items skipped:

        RESERVED
        SUBSTITUTION_PENDING
        SUBSTITUTION_REJECTED
        CANCELLED
        PENDING
    """

    items_to_reserve = []

    # --------------------------------------------------------
    # COLLECT ITEMS
    # --------------------------------------------------------

    for item in order.items:

        if item.status == "RESERVED":
            continue

        if item.status not in {
            "AVAILABLE",
            "SUBSTITUTION_ACCEPTED",
        }:
            continue

        items_to_reserve.append(item)

    if not items_to_reserve:
        return []

    # --------------------------------------------------------
    # LOCK + VALIDATE EVERYTHING FIRST
    # --------------------------------------------------------

    inventory_map = {}

    for item in items_to_reserve:

        inventory = get_inventory(
            db=db,
            shop_id=order.shop_id,
            product_id=item.product_id,
            lock=True,
        )

        if inventory is None:
            raise ValueError(
                f"Inventory not found for product "
                f"{item.product_id}."
            )

        if inventory.stock_quantity < item.quantity:
            raise ValueError(
                f"Insufficient inventory for product "
                f"{item.product_id}. "
                f"Available: {inventory.stock_quantity}, "
                f"Required: {item.quantity}."
            )

        inventory_map[item.id] = inventory

    # --------------------------------------------------------
    # DEDUCT AFTER ALL VALIDATION
    # --------------------------------------------------------

    deducted_inventory = []

    for item in items_to_reserve:

        inventory = inventory_map[item.id]

        inventory.stock_quantity -= item.quantity

        item.status = "RESERVED"

        deducted_inventory.append(inventory)

    return deducted_inventory


# ============================================================
# RELEASE SINGLE ORDER ITEM INVENTORY
# ============================================================

def release_order_item_inventory(
    db: Session,
    order_item: OrderItem,
):
    """
    Restore inventory for a previously reserved item.
    """

    order = order_item.order

    if order is None:
        raise ValueError(
            "Order not found for order item."
        )

    # --------------------------------------------------------
    # ONLY RESERVED ITEMS CAN BE RELEASED
    # --------------------------------------------------------

    if order_item.status != "RESERVED":
        return None

    inventory = get_inventory(
        db=db,
        shop_id=order.shop_id,
        product_id=order_item.product_id,
        lock=True,
    )

    if inventory is None:
        raise ValueError(
            f"Inventory not found for product "
            f"{order_item.product_id}."
        )

    inventory.stock_quantity += order_item.quantity

    order_item.status = "CANCELLED"

    return inventory


# ============================================================
# RELEASE COMPLETE ORDER INVENTORY
# ============================================================

def release_order_inventory(
    db: Session,
    order,
):
    """
    Restore all reserved inventory for an order.
    """

    released_inventory = []

    for item in order.items:

        if item.status != "RESERVED":
            continue

        inventory = release_order_item_inventory(
            db=db,
            order_item=item,
        )

        if inventory is not None:
            released_inventory.append(inventory)

    return released_inventory


# ============================================================
# RESERVE SUBSTITUTE PRODUCT
# ============================================================

def reserve_substitute_inventory(
    db: Session,
    order_item: OrderItem,
):
    """
    Reserve inventory for an accepted substitution.

    The order item's product_id must already point to
    the substitute product.
    """

    order = order_item.order

    if order is None:
        raise ValueError(
            "Order not found for order item."
        )

    # --------------------------------------------------------
    # ALREADY RESERVED
    # --------------------------------------------------------

    if order_item.status == "RESERVED":
        return None

    # --------------------------------------------------------
    # VALIDATION
    # --------------------------------------------------------

    if order_item.status != "SUBSTITUTION_ACCEPTED":
        raise ValueError(
            "Order item is not an accepted substitution."
        )

    # --------------------------------------------------------
    # LOCK SUBSTITUTE INVENTORY
    # --------------------------------------------------------

    inventory = get_inventory(
        db=db,
        shop_id=order.shop_id,
        product_id=order_item.product_id,
        lock=True,
    )

    if inventory is None:
        raise ValueError(
            f"Inventory not found for substitute product "
            f"{order_item.product_id}."
        )

    # --------------------------------------------------------
    # CHECK STOCK
    # --------------------------------------------------------

    if inventory.stock_quantity < order_item.quantity:
        raise ValueError(
            f"Insufficient inventory for substitute product "
            f"{order_item.product_id}. "
            f"Available: {inventory.stock_quantity}, "
            f"Required: {order_item.quantity}."
        )

    # --------------------------------------------------------
    # DEDUCT SUBSTITUTE STOCK
    # --------------------------------------------------------

    inventory.stock_quantity -= order_item.quantity

    # --------------------------------------------------------
    # MARK RESERVED
    # --------------------------------------------------------

    order_item.status = "RESERVED"

    return inventory


# ============================================================
# COUNT PENDING SUBSTITUTIONS
# ============================================================

def count_pending_substitutions(
    db: Session,
    order_id: int,
):
    """
    Return the number of unresolved substitution requests
    for an order.
    """

    return (
        db.query(SubstitutionRequest)
        .join(
            OrderItem,
            OrderItem.id == SubstitutionRequest.order_item_id,
        )
        .filter(
            OrderItem.order_id == order_id,
            SubstitutionRequest.status == "PENDING",
        )
        .count()
    )


# ============================================================
# GET USABLE ORDER ITEMS
# ============================================================

def get_usable_order_items(order):
    """
    Return order items that can be fulfilled.
    """

    return [
        item
        for item in order.items
        if item.status in {
            "AVAILABLE",
            "SUBSTITUTION_ACCEPTED",
            "RESERVED",
        }
    ]


# ============================================================
# CAN ORDER BE CONFIRMED
# ============================================================

def can_confirm_order(
    db: Session,
    order,
):
    """
    Determine whether an order can move to CONFIRMED.

    Requirements:

        1. No pending substitutions.
        2. At least one usable item exists.
        3. No unresolved substitution-pending item remains.

    Returns:

        {
            "can_confirm": bool,
            "reason": str | None
        }
    """

    pending_substitutions = count_pending_substitutions(
        db=db,
        order_id=order.id,
    )

    if pending_substitutions > 0:
        return {
            "can_confirm": False,
            "reason": (
                "Customer substitution decisions "
                "are still pending."
            ),
        }

    usable_items = get_usable_order_items(order)

    if not usable_items:
        return {
            "can_confirm": False,
            "reason": (
                "Order cannot be confirmed because "
                "there are no usable order items."
            ),
        }

    # --------------------------------------------------------
    # Make sure no item is still waiting for substitution
    # --------------------------------------------------------

    for item in order.items:

        if item.status == "SUBSTITUTION_PENDING":
            return {
                "can_confirm": False,
                "reason": (
                    f"Order item {item.id} is still "
                    "waiting for substitution."
                ),
            }

    return {
        "can_confirm": True,
        "reason": None,
    }


# ============================================================
# FINALIZE ORDER AFTER SUBSTITUTION
# ============================================================

def finalize_order_after_substitution(
    db: Session,
    order,
):
    """
    Determine the correct order status after a customer
    accepts or rejects a substitution.

    If pending substitutions remain:
        SUBSTITUTION_PENDING

    If usable items remain:
        CONFIRMED

    If no usable items remain:
        CANCELLED
    """

    pending_substitutions = count_pending_substitutions(
        db=db,
        order_id=order.id,
    )

    if pending_substitutions > 0:

        order.status = "SUBSTITUTION_PENDING"

        return order.status

    usable_items = get_usable_order_items(order)

    if usable_items:

        order.status = "CONFIRMED"

    else:

        order.status = "CANCELLED"

    return order.status