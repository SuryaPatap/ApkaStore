from decimal import Decimal
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db

from ..models.user import User
from ..models.customer import Customer
from ..models.shop import Shop
from ..models.product import Product
from ..models.order import Order
from ..models.order_item import OrderItem
from ..models.inventory import Inventory
from ..models.substitution_request import SubstitutionRequest

from ..schemas.order import (
    OrderCreate,
    OrderResponse,
    CustomerOrderSummary,
    SubstitutionDecision,
    ShopkeeperOrderResponse,
    OrderStatusUpdate,
    OrderPricingUpdateRequest,
)

from ..services.order_service import (
    check_order_item_inventory,
    reserve_order_inventory,
    reserve_substitute_inventory,
    release_order_inventory,
)

from ..core.dependencies import get_current_user


router = APIRouter(
    prefix="/api/v1/orders",
    tags=["Orders"],
)


# ============================================================
# CONSTANTS
# ============================================================

ORDER_STATUSES = {
    "PENDING",
    "SUBSTITUTION_PENDING",
    "CONFIRMED",
    "CREDIT_CONFIRMED",
    "PROCESSING",
    "READY",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "COMPLETED",
    "CANCELLED",
}


ORDER_ITEM_USABLE_STATUSES = {
    "AVAILABLE",
    "SUBSTITUTION_ACCEPTED",
    "RESERVED",
}


# ============================================================
# HELPER - GET SHOPKEEPER SHOP
# ============================================================

def get_shopkeeper_shop(
    db: Session,
    current_user: User,
):
    """
    Return the active shop owned by the logged-in shopkeeper.
    """

    if current_user.role != "shopkeeper":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only shopkeepers can access this resource.",
        )

    shop = (
        db.query(Shop)
        .filter(
            Shop.owner_user_id == current_user.id,
            Shop.is_active == True,
        )
        .first()
    )

    if shop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found for this shopkeeper.",
        )

    return shop


# ============================================================
# HELPER - GET SHOPKEEPER ORDER
# ============================================================

def get_shopkeeper_order(
    db: Session,
    order_id: int,
    shop: Shop,
):
    """
    Return an order only if it belongs to the shopkeeper's shop.
    """

    order = (
        db.query(Order)
        .filter(
            Order.id == order_id,
            Order.shop_id == shop.id,
        )
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    return order


# ============================================================
# HELPER - GET CUSTOMER
# ============================================================

def get_customer_for_user(
    db: Session,
    current_user: User,
):
    """
    Return the active customer profile associated
    with the logged-in user.
    """

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
# HELPER - GET ORDER CUSTOMER
# ============================================================

def get_order_customer(
    db: Session,
    order: Order,
):
    """
    Return customer associated with an order.
    """

    customer = (
        db.query(Customer)
        .filter(
            Customer.id == order.customer_id,
        )
        .first()
    )

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    return customer


# ============================================================
# HELPER - GET PRODUCT
# ============================================================

def get_shop_product(
    db: Session,
    product_id: int,
    shop_id: int,
):
    """
    Get an active product belonging to a specific shop.
    """

    return (
        db.query(Product)
        .filter(
            Product.id == product_id,
            Product.shop_id == shop_id,
            Product.is_active == True,
        )
        .first()
    )


# ============================================================
# HELPER - GET INVENTORY
# ============================================================

def get_product_inventory(
    db: Session,
    shop_id: int,
    product_id: int,
):
    """
    Inventory is the source of truth for stock.
    """

    return (
        db.query(Inventory)
        .filter(
            Inventory.shop_id == shop_id,
            Inventory.product_id == product_id,
            Inventory.is_active == True,
        )
        .first()
    )


# ============================================================
# HELPER - RECALCULATE ORDER TOTAL
# ============================================================

def recalculate_order_total(
    order: Order,
):
    """
    Recalculate total from all non-rejected order items.
    """

    total = Decimal("0.00")

    for item in order.items:

        if item.status == "SUBSTITUTION_REJECTED":
            continue

        if item.unit_price is None:
            continue

        total += (
            Decimal(str(item.unit_price))
            * item.quantity
        )

    order.total_amount = total

    return total


# ============================================================
# HELPER - COUNT PENDING SUBSTITUTIONS
# ============================================================

def count_pending_substitutions(
    db: Session,
    order_id: int,
):
    """
    Count all unresolved substitution requests
    belonging to an order.
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
# HELPER - GET USABLE ORDER ITEMS
# ============================================================

def get_usable_order_items(
    order: Order,
):
    """
    Return order items that can be fulfilled.
    """

    return [
        item
        for item in order.items
        if item.status in ORDER_ITEM_USABLE_STATUSES
    ]


# ============================================================
# CREATE ORDER
# CUSTOMER ONLY
# ============================================================

@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    # ========================================================
    # 1. CUSTOMER ONLY
    # ========================================================

    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can create orders.",
        )

    # ========================================================
    # 2. CUSTOMER
    # ========================================================

    customer = get_customer_for_user(
        db=db,
        current_user=current_user,
    )

    # ========================================================
    # 3. SHOP
    # ========================================================

    shop = (
        db.query(Shop)
        .filter(
            Shop.id == order_data.shop_id,
            Shop.is_active == True,
        )
        .first()
    )

    if shop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found.",
        )

    # ========================================================
    # 4. VALIDATE ITEMS
    # ========================================================

    if not order_data.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order must contain at least one item.",
        )

    # ========================================================
    # 5. CREATE ORDER
    # ========================================================

    order = Order(
        customer_id=customer.id,
        shop_id=shop.id,
        status="PENDING",
        total_amount=Decimal("0.00"),
        payment_method=getattr(order_data, "payment_method", "COD") or "COD",
        notes=getattr(order_data, "notes", None),
    )

    try:

        db.add(order)
        db.flush()

        total_amount = Decimal("0.00")
        order_items = []

        # ====================================================
        # 6. CREATE ORDER ITEMS
        # ====================================================

        for item_data in order_data.items:

            if item_data.quantity <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Quantity must be greater than zero "
                        f"for product {item_data.product_id}."
                    ),
                )

            product = get_shop_product(
                db=db,
                product_id=item_data.product_id,
                shop_id=shop.id,
            )

            if product is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=(
                        f"Product {item_data.product_id} "
                        f"not found in this shop."
                    ),
                )

            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=item_data.quantity,
                unit_price=product.price,
                status="PENDING",
            )

            db.add(order_item)

            total_amount += (
                Decimal(str(product.price))
                * item_data.quantity
            )

            order_items.append(order_item)

        db.flush()

        # ====================================================
        # 7. CHECK INVENTORY
        # ====================================================

        substitution_pending = False
        unavailable = False

        for order_item in order_items:

            result = check_order_item_inventory(
                db=db,
                order_item=order_item,
            )

            if not result["available"]:

                unavailable = True

                if result.get("substitution_request") is not None:
                    substitution_pending = True

        # ====================================================
        # 8. DETERMINE ORDER STATUS
        # ====================================================

        if substitution_pending:

            order.status = "SUBSTITUTION_PENDING"

        elif unavailable:

            order.status = "PENDING"

        else:

            order.status = "CONFIRMED"

        # ====================================================
        # 9. TOTAL
        # ====================================================

        order.total_amount = total_amount

        # ====================================================
        # 10. RESERVE AVAILABLE INVENTORY
        # ========================================================
        #
        # If all items are available, the order becomes
        # CONFIRMED immediately, so inventory must be reserved
        # before committing the transaction.
        #
        # If substitution is pending, only AVAILABLE items are
        # reserved. The accepted substitute will be reserved
        # when the customer accepts it.
        # ========================================================

        reserve_order_inventory(
            db=db,
            order=order,
        )

        # ====================================================
        # 11. RECORD UDHAR KHATA LEDGER (IF PAYMENT IS UDHAR)
        # ====================================================
        if order_data.payment_method == "UDHAR_KHATA":
            from ..models.credit_account import CreditAccount
            from ..models.credit_ledger import CreditLedger
            from ..models.credit_transaction import CreditTransaction

            account = (
                db.query(CreditAccount)
                .filter(
                    CreditAccount.customer_id == customer.id,
                    CreditAccount.shop_id == shop.id,
                )
                .first()
            )

            if account:
                new_outstanding = account.outstanding_amount + total_amount
                account.outstanding_amount = new_outstanding

                tx = CreditTransaction(
                    credit_account_id=account.id,
                    order_id=order.id,
                    transaction_type="DEBIT",
                    amount=total_amount,
                    balance_after=new_outstanding,
                    description=f"Udhar purchase for Order #{order.id}",
                )
                db.add(tx)

                ledger = CreditLedger(
                    customer_id=customer.id,
                    shop_id=shop.id,
                    order_id=order.id,
                    transaction_type="CREDIT_PURCHASE",
                    amount=total_amount,
                    balance_after=new_outstanding,
                    description=f"Order #{order.id} Udhar Purchase",
                )
                db.add(ledger)

        db.commit()
        db.refresh(order)

        # Notify Shopkeeper
        _send_shopkeeper_notification(
            db=db,
            shop_id=shop.id,
            order_id=order.id,
            title=f"New Order #{order.id} Received",
            message=f"{current_user.name} placed an order of ₹{order.total_amount:.2f}.",
            notif_type="NEW_ORDER",
        )

        return order

    except HTTPException:
        db.rollback()
        raise

    except ValueError as e:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create order: {str(e)}",
        )


# ============================================================
# CUSTOMER - GET MY ORDERS
# ============================================================

@router.get(
    "/customer",
    response_model=list[CustomerOrderSummary],
)
def get_customer_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can access customer orders.",
        )

    customer = get_customer_for_user(
        db=db,
        current_user=current_user,
    )

    orders = (
        db.query(Order)
        .filter(
            Order.customer_id == customer.id,
        )
        .order_by(Order.id.desc())
        .all()
    )

    response = []
    for order in orders:
        shop = db.query(Shop).filter(Shop.id == order.shop_id).first()
        items_res = []
        for it in order.items:
            prod_name = getattr(it, "custom_name", None)
            if not prod_name and it.product_id:
                p = db.query(Product).filter(Product.id == it.product_id).first()
                if p:
                    prod_name = p.name
            items_res.append({
                "id": it.id,
                "order_id": it.order_id,
                "product_id": it.product_id,
                "product_name": prod_name or "Grocery Item",
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "status": it.status,
            })

        is_parchi = bool(order.notes and "parchi" in order.notes.lower())

        # Auto sync order total_amount if items have pricing but order total is 0
        calculated_items_total = sum(
            (Decimal(str(it.unit_price)) * it.quantity) for it in order.items if it.unit_price and it.unit_price > 0
        )
        if (not order.total_amount or order.total_amount == 0) and calculated_items_total > 0:
            order.total_amount = calculated_items_total
            try:
                db.commit()
            except Exception:
                db.rollback()

        response.append({
            "id": order.id,
            "shop_id": order.shop_id,
            "shop_name": shop.shop_name if shop else "Neighborhood Store",
            "status": order.status,
            "total_amount": order.total_amount,
            "payment_method": getattr(order, "payment_method", "COD") or "COD",
            "notes": getattr(order, "notes", None),
            "is_parchi": is_parchi,
            "order_source": "PARCHI" if is_parchi else "STORE",
            "created_at": order.created_at,
            "updated_at": order.updated_at,
            "items": items_res,
        })

    return response


# ============================================================
# CUSTOMER - GET SINGLE ORDER
# ============================================================

@router.get(
    "/customer/{order_id}",
    response_model=OrderResponse,
)
def get_customer_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can access this resource.",
        )

    customer = get_customer_for_user(
        db=db,
        current_user=current_user,
    )

    order = (
        db.query(Order)
        .filter(
            Order.id == order_id,
            Order.customer_id == customer.id,
        )
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    return order


# ============================================================
# CUSTOMER - ACCEPT / REJECT SUBSTITUTION
# ============================================================

@router.patch(
    "/substitution/{substitution_id}",
)
def decide_substitution(
    substitution_id: int,
    decision: SubstitutionDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    # ========================================================
    # 1. CUSTOMER ONLY
    # ========================================================

    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can respond to substitutions.",
        )

    # ========================================================
    # 2. CUSTOMER
    # ========================================================

    customer = get_customer_for_user(
        db=db,
        current_user=current_user,
    )

    # ========================================================
    # 3. FIND PENDING SUBSTITUTION
    # ========================================================

    substitution = (
        db.query(SubstitutionRequest)
        .filter(
            SubstitutionRequest.id == substitution_id,
            SubstitutionRequest.status == "PENDING",
        )
        .with_for_update()
        .first()
    )

    if substitution is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending substitution request not found.",
        )

    # ========================================================
    # 4. ORDER ITEM
    # ========================================================

    order_item = (
        db.query(OrderItem)
        .filter(
            OrderItem.id == substitution.order_item_id,
        )
        .first()
    )

    if order_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order item not found.",
        )

    # ========================================================
    # 5. ORDER
    # ========================================================

    order = (
        db.query(Order)
        .filter(
            Order.id == order_item.order_id,
        )
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    # ========================================================
    # 6. SECURITY
    # ========================================================

    if order.customer_id != customer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot modify this substitution.",
        )

    # ========================================================
    # 7. ORDER MUST BE WAITING
    # ========================================================

    if order.status != "SUBSTITUTION_PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This order is not waiting for "
                "a substitution decision."
            ),
        )

    try:

        # ====================================================
        # 8. ACCEPT
        # ====================================================

        if decision.accept:

            substitute = (
                db.query(Product)
                .filter(
                    Product.id == substitution.suggested_product_id,
                    Product.shop_id == order.shop_id,
                    Product.is_active == True,
                )
                .first()
            )

            if substitute is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Suggested product no longer exists.",
                )

            # ------------------------------------------------
            # IMPORTANT:
            # Use requested_quantity from the substitution
            # record instead of depending only on the mutable
            # order item quantity.
            # ------------------------------------------------

            requested_quantity = substitution.requested_quantity

            if requested_quantity <= 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Invalid requested substitution quantity.",
                )

            # ------------------------------------------------
            # Lock substitute inventory
            # ------------------------------------------------

            inventory = (
                db.query(Inventory)
                .filter(
                    Inventory.shop_id == order.shop_id,
                    Inventory.product_id == substitute.id,
                    Inventory.is_active == True,
                )
                .with_for_update()
                .first()
            )

            if (
                inventory is None
                or inventory.stock_quantity < requested_quantity
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "Suggested product is no longer "
                        "available in sufficient quantity."
                    ),
                )

            # ------------------------------------------------
            # Replace product
            # ------------------------------------------------

            order_item.product_id = substitute.id

            # ------------------------------------------------
            # Replace price
            # ------------------------------------------------

            order_item.unit_price = substitute.price

            # ------------------------------------------------
            # Ensure requested quantity is retained
            # ------------------------------------------------

            order_item.quantity = requested_quantity

            # ------------------------------------------------
            # Update item status
            # ------------------------------------------------

            order_item.status = "SUBSTITUTION_ACCEPTED"

            # ------------------------------------------------
            # Update substitution
            # ------------------------------------------------

            substitution.status = "ACCEPTED"

            # ------------------------------------------------
            # IMPORTANT:
            # Actually deduct substitute inventory.
            # ------------------------------------------------

            reserve_substitute_inventory(
                db=db,
                order_item=order_item,
            )

            message = "Substitution accepted."

        # ====================================================
        # 9. REJECT
        # ====================================================

        else:

            substitution.status = "REJECTED"

            order_item.status = "SUBSTITUTION_REJECTED"

            message = "Substitution rejected."

        # ====================================================
        # 10. RECALCULATE TOTAL
        # ====================================================

        recalculate_order_total(order)

        # ====================================================
        # 11. REMAINING SUBSTITUTIONS
        # ====================================================

        pending_substitutions = count_pending_substitutions(
            db=db,
            order_id=order.id,
        )

        # ====================================================
        # 12. UPDATE ORDER STATUS
        # ====================================================

        if pending_substitutions > 0:

            order.status = "SUBSTITUTION_PENDING"

        else:

            usable_items = get_usable_order_items(order)

            if usable_items:

                order.status = "CONFIRMED"

            else:

                order.status = "CANCELLED"

        # ====================================================
        # 13. SAVE
        # ====================================================

        db.commit()
        db.refresh(order)

        return {
            "message": message,
            "substitution_id": substitution.id,
            "substitution_status": substitution.status,
            "order_id": order.id,
            "order_status": order.status,
            "order_total": order.total_amount,
        }

    except HTTPException:
        db.rollback()
        raise

    except ValueError as e:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process substitution decision.",
        )


# ============================================================
# HELPER - BUILD SHOPKEEPER ORDER ITEM
# ============================================================

def build_shopkeeper_order_item(
    db: Session,
    item: OrderItem,
    shop: Shop,
):
    """
    Build response data for a single shopkeeper order item.
    """

    product = None
    if item.product_id:
        product = (
            db.query(Product)
            .filter(
                Product.id == item.product_id,
            )
            .first()
        )

    product_name = product.name if product else (getattr(item, "custom_name", None) or "Grocery Item")
    product_id = product.id if product else item.product_id

    # --------------------------------------------------------
    # INVENTORY
    # --------------------------------------------------------

    available_quantity = 0
    if product:
        inventory = get_product_inventory(
            db=db,
            shop_id=shop.id,
            product_id=product.id,
        )
        available_quantity = (
            inventory.stock_quantity
            if inventory
            else 0
        )

    # --------------------------------------------------------
    # PENDING SUBSTITUTION
    # --------------------------------------------------------

    substitution = (
        db.query(SubstitutionRequest)
        .filter(
            SubstitutionRequest.order_item_id == item.id,
            SubstitutionRequest.status == "PENDING",
        )
        .first()
    )

    suggested_product_id = None
    suggested_product_name = None
    suggested_product_price = None

    if substitution:

        suggested_product = (
            db.query(Product)
            .filter(
                Product.id == substitution.suggested_product_id,
                Product.shop_id == shop.id,
                Product.is_active == True,
            )
            .first()
        )

        if suggested_product:

            suggested_product_id = suggested_product.id
            suggested_product_name = suggested_product.name
            suggested_product_price = suggested_product.price

    return {
        "id": item.id,
        "product_id": product_id,
        "product_name": product_name,
        "quantity": item.quantity,
        "unit_price": item.unit_price,
        "available_quantity": available_quantity,
        "status": item.status,
        "suggested_product_id": suggested_product_id,
        "suggested_product_name": suggested_product_name,
        "suggested_product_price": suggested_product_price,
    }


def _get_customer_full_address_str(db: Session, customer: Customer) -> str:
    if not customer:
        return "Local Customer Address"
    if customer.address_id:
        from ..models.address import Address as AddressModel
        addr = db.query(AddressModel).filter(AddressModel.id == customer.address_id).first()
        if addr:
            if addr.normalized_address:
                return addr.normalized_address
            parts = [
                p for p in [
                    f"Flat {addr.flat_number}" if addr.flat_number else None,
                    f"Bldg {addr.building_number}" if addr.building_number else None,
                    addr.house_number,
                    addr.street,
                    f"Sector {addr.sector}" if addr.sector and not addr.sector.lower().startswith("sector") else addr.sector,
                    addr.locality,
                    addr.landmark,
                    addr.city,
                    addr.district,
                    addr.state,
                    addr.pincode,
                ] if p
            ]
            if parts:
                return ", ".join(parts)
    return "Local Customer Address"


# ============================================================
# SHOPKEEPER - GET ALL INCOMING ORDERS
# ============================================================

@router.get(
    "/shopkeeper",
    response_model=list[ShopkeeperOrderResponse],
)
def get_shopkeeper_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    shop = get_shopkeeper_shop(
        db=db,
        current_user=current_user,
    )

    orders = (
        db.query(Order)
        .filter(
            Order.shop_id == shop.id,
        )
        .order_by(Order.id.desc())
        .all()
    )

    response = []

    for order in orders:

        customer = (
            db.query(Customer)
            .filter(
                Customer.id == order.customer_id,
            )
            .first()
        )

        customer_name = "Customer"
        customer_phone = ""
        if customer:
            customer_name = customer.name or "Customer"
            customer_phone = customer.phone or ""
            if customer.user_id:
                customer_user = (
                    db.query(User)
                    .filter(
                        User.id == customer.user_id,
                    )
                    .first()
                )
                if customer_user:
                    customer_name = customer_user.name or customer_name
                    customer_phone = customer_user.phone or customer_phone

        response_items = []

        for item in order.items:

            response_item = build_shopkeeper_order_item(
                db=db,
                item=item,
                shop=shop,
            )

            if response_item is not None:
                response_items.append(response_item)

        customer_address = _get_customer_full_address_str(db=db, customer=customer)
        is_parchi = bool(order.notes and "parchi" in order.notes.lower())

        # Auto sync order total_amount if items have pricing but order total is 0
        calculated_items_total = sum(
            (Decimal(str(it.unit_price)) * it.quantity) for it in order.items if it.unit_price and it.unit_price > 0
        )
        if (not order.total_amount or order.total_amount == 0) and calculated_items_total > 0:
            order.total_amount = calculated_items_total
            try:
                db.commit()
            except Exception:
                db.rollback()

        response.append(
            {
                "id": order.id,
                "customer_id": order.customer_id,
                "customer_name": customer_name,
                "customer_phone": customer_phone,
                "customer_address": customer_address,
                "shop_id": shop.id,
                "status": order.status,
                "total_amount": order.total_amount,
                "payment_method": getattr(order, "payment_method", "COD") or "COD",
                "notes": getattr(order, "notes", None),
                "is_parchi": is_parchi,
                "order_source": "PARCHI" if is_parchi else "STORE",
                "created_at": order.created_at,
                "items": response_items,
            }
        )

    return response


# ============================================================
# SHOPKEEPER - GET SINGLE ORDER
# ============================================================

@router.get(
    "/shopkeeper/{order_id}",
    response_model=ShopkeeperOrderResponse,
)
def get_shopkeeper_order_detail(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    shop = get_shopkeeper_shop(
        db=db,
        current_user=current_user,
    )

    order = get_shopkeeper_order(
        db=db,
        order_id=order_id,
        shop=shop,
    )

    customer = get_order_customer(
        db=db,
        order=order,
    )

    customer_name = "Customer"
    customer_phone = ""
    if customer:
        customer_name = customer.name or "Customer"
        customer_phone = customer.phone or ""
        if customer.user_id:
            customer_user = (
                db.query(User)
                .filter(
                    User.id == customer.user_id,
                )
                .first()
            )
            if customer_user:
                customer_name = customer_user.name or customer_name
                customer_phone = customer_user.phone or customer_phone

    response_items = []

    for item in order.items:

        response_item = build_shopkeeper_order_item(
            db=db,
            item=item,
            shop=shop,
        )

        if response_item is not None:
            response_items.append(response_item)

    customer_address = _get_customer_full_address_str(db=db, customer=customer)
    is_parchi = bool(order.notes and "parchi" in order.notes.lower())

    return {
        "id": order.id,
        "customer_id": order.customer_id,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "customer_address": customer_address,
        "shop_id": shop.id,
        "status": order.status,
        "total_amount": order.total_amount,
        "payment_method": getattr(order, "payment_method", "COD") or "COD",
        "notes": getattr(order, "notes", None),
        "is_parchi": is_parchi,
        "order_source": "PARCHI" if is_parchi else "STORE",
        "created_at": order.created_at,
        "items": response_items,
    }


# ============================================================
# SHOPKEEPER - UPDATE ORDER STATUS
# ============================================================

@router.patch(
    "/shopkeeper/{order_id}/status",
)
@router.put(
    "/shopkeeper/{order_id}/status",
)
@router.patch(
    "/{order_id}/status",
)
@router.put(
    "/{order_id}/status",
)
def update_order_status(
    order_id: int,
    status_data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    # ========================================================
    # 1. SHOPKEEPER SHOP
    # ========================================================

    shop = get_shopkeeper_shop(
        db=db,
        current_user=current_user,
    )

    # ========================================================
    # 2. ORDER
    # ========================================================

    order = get_shopkeeper_order(
        db=db,
        order_id=order_id,
        shop=shop,
    )

    # ========================================================
    # 3. NORMALIZE STATUS
    # ========================================================

    new_status = status_data.status.upper().strip()
    current_status = order.status.upper().strip()

    # ========================================================
    # 4. VALID STATUSES
    # ========================================================

    if new_status not in ORDER_STATUSES:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid status '{new_status}'. "
                f"Allowed statuses: "
                f"{', '.join(sorted(ORDER_STATUSES))}"
            ),
        )

    # ========================================================
    # 5. SAME STATUS
    # ========================================================

    if new_status == current_status:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order is already {current_status}.",
        )

    # ========================================================
    # 6. PENDING SUBSTITUTIONS
    # ========================================================

    pending_substitutions = count_pending_substitutions(
        db=db,
        order_id=order.id,
    )

    # ========================================================
    # 7. VALID TRANSITIONS
    # ========================================================

    transitions = {
        "PENDING": {
            "CONFIRMED",
            "PROCESSING",
            "READY",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "COMPLETED",
            "CANCELLED",
        },
        "CREDIT_CONFIRMED": {
            "CONFIRMED",
            "PROCESSING",
            "READY",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "COMPLETED",
            "CANCELLED",
        },
        "SUBSTITUTION_PENDING": {
            "CANCELLED",
        },
        "CONFIRMED": {
            "PROCESSING",
            "READY",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "COMPLETED",
            "CANCELLED",
        },
        "PROCESSING": {
            "READY",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "COMPLETED",
            "CANCELLED",
        },
        "READY": {
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "COMPLETED",
            "CANCELLED",
        },
        "OUT_FOR_DELIVERY": {
            "DELIVERED",
            "COMPLETED",
            "CANCELLED",
        },
        "DELIVERED": {
            "COMPLETED",
        },
        "COMPLETED": set(),
        "CANCELLED": set(),
    }

    # ========================================================
    # 8. PREVENT CONFIRMATION WITH PENDING SUBSTITUTION
    # ========================================================

    if (
        new_status == "CONFIRMED"
        and pending_substitutions > 0
    ):

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Customer substitution decisions "
                "are still pending."
            ),
        )

    # ========================================================
    # 9. CHECK USABLE ITEMS BEFORE CONFIRMATION
    # ========================================================

    if new_status == "CONFIRMED":

        usable_items = get_usable_order_items(order)

        if not usable_items:

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Order cannot be confirmed because "
                    "there are no usable order items."
                ),
            )

    # ========================================================
    # 10. CHECK TRANSITION
    # ========================================================

    allowed_next_statuses = transitions.get(
        current_status,
        set(),
    )

    if new_status not in allowed_next_statuses:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot change order status "
                f"from {current_status} to {new_status}."
            ),
        )

    # ========================================================
    # 11. UPDATE
    # ========================================================

    try:

        if new_status == "CONFIRMED":

            try:
                reserve_order_inventory(
                    db=db,
                    order=order,
                )

            except ValueError as e:

                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=str(e),
                )

        if new_status == "CANCELLED":

            release_order_inventory(
                db=db,
                order=order,
            )

        order.status = new_status
        order.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(order)

        # Notify Customer
        _send_customer_notification(
            db=db,
            order=order,
            title=f"Order #{order.id} is {new_status}",
            message=f"Your order #{order.id} status was updated to {new_status}.",
            notif_type="ORDER_STATUS",
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update order status.",
        )

    # ========================================================
    # 12. RESPONSE
    # ========================================================

    return {
        "message": "Order status updated successfully.",
        "order_id": order.id,
        "old_status": current_status,
        "new_status": order.status,
        "status": order.status,
    }


# ============================================================
# HELPER NOTIFICATION DISPATCHERS
# ============================================================

def _send_customer_notification(db: Session, order: Order, title: str, message: str, notif_type: str = "ORDER_UPDATE"):
    try:
        from ..models.customer import Customer
        from ..models.notification import Notification
        cust = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if cust and cust.user_id:
            notif = Notification(
                user_id=cust.user_id,
                order_id=order.id,
                title=title,
                message=message,
                type=notif_type,
                is_read=False,
                created_at=datetime.utcnow(),
            )
            db.add(notif)
            db.commit()
    except Exception:
        pass


def _send_shopkeeper_notification(db: Session, shop_id: int, order_id: int, title: str, message: str, notif_type: str = "NEW_ORDER"):
    try:
        from ..models.shop import Shop
        from ..models.notification import Notification
        shp = db.query(Shop).filter(Shop.id == shop_id).first()
        if shp and shp.owner_user_id:
            notif = Notification(
                user_id=shp.owner_user_id,
                order_id=order_id,
                title=title,
                message=message,
                type=notif_type,
                is_read=False,
                created_at=datetime.utcnow(),
            )
            db.add(notif)
            db.commit()
    except Exception:
        pass


# ============================================================
# SHOPKEEPER - UPDATE PARCHI ITEM PRICING
# ============================================================

@router.patch(
    "/shopkeeper/{order_id}/items-pricing",
    response_model=ShopkeeperOrderResponse,
)
@router.put(
    "/shopkeeper/{order_id}/items-pricing",
    response_model=ShopkeeperOrderResponse,
)
@router.patch(
    "/{order_id}/items-pricing",
    response_model=ShopkeeperOrderResponse,
)
@router.put(
    "/{order_id}/items-pricing",
    response_model=ShopkeeperOrderResponse,
)
def update_order_items_pricing(
    order_id: int,
    body: OrderPricingUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = get_shopkeeper_shop(db=db, current_user=current_user)
    order = get_shopkeeper_order(db=db, order_id=order_id, shop=shop)

    pricing_map = {item.item_id: item for item in body.items}
    total_amount = Decimal("0.00")
    updated_items_summary = []

    for oi in order.items:
        if oi.id in pricing_map:
            update_data = pricing_map[oi.id]
            oi.unit_price = Decimal(str(update_data.unit_price))
            if update_data.quantity and update_data.quantity > 0:
                oi.quantity = update_data.quantity
            oi.updated_at = datetime.utcnow()

        item_subtotal = Decimal(str(oi.unit_price)) * oi.quantity
        total_amount += item_subtotal
        item_name = oi.custom_name or "Item"
        updated_items_summary.append(f"• {item_name}: ₹{oi.unit_price} × {oi.quantity} = ₹{item_subtotal:.2f}")

    order.total_amount = total_amount
    if body.notes:
        order.notes = f"{order.notes or ''} | Note: {body.notes}".strip()
    order.updated_at = datetime.utcnow()

    # Udhar Khata balance update if applicable
    if getattr(order, "payment_method", "") == "UDHAR_KHATA":
        try:
            from ..models.credit_account import CreditAccount
            from ..models.credit_transaction import CreditTransaction
            credit_acct = db.query(CreditAccount).filter(
                CreditAccount.customer_id == order.customer_id,
                CreditAccount.shop_id == shop.id,
                CreditAccount.status == "ACTIVE",
            ).first()
            if credit_acct:
                ct = db.query(CreditTransaction).filter(
                    CreditTransaction.order_id == order.id,
                    CreditTransaction.credit_account_id == credit_acct.id,
                ).first()
                if ct:
                    diff = total_amount - ct.amount
                    ct.amount = total_amount
                    credit_acct.outstanding_balance = float(credit_acct.outstanding_balance) + float(diff)
                else:
                    credit_acct.outstanding_balance = float(credit_acct.outstanding_balance) + float(total_amount)
                    new_ct = CreditTransaction(
                        credit_account_id=credit_acct.id,
                        transaction_type="DEBIT",
                        amount=total_amount,
                        description=f"Parchi order #{order.id} pricing update",
                        order_id=order.id,
                        created_at=datetime.utcnow(),
                    )
                    db.add(new_ct)
        except Exception:
            pass

    # Post message in linked Parchi thread if exists
    try:
        from ..models.parchi import ParchiThread, ParchiMessage
        parchi = db.query(ParchiThread).filter(
            ParchiThread.customer_id == order.customer_id,
            ParchiThread.shop_id == shop.id,
            ParchiThread.status == "ACTIVE",
        ).first()
        if parchi:
            breakdown_text = "\n".join(updated_items_summary)
            msg = ParchiMessage(
                parchi_id=parchi.id,
                sender_role="SHOPKEEPER",
                message_type="PARCHI_PRICING",
                content=f"🏷️ PRICING UPDATE (Order #{order.id})\n{breakdown_text}\nTotal Amount: ₹{total_amount:.2f}",
                order_id=order.id,
                created_at=datetime.utcnow(),
            )
            db.add(msg)
            parchi.last_message_at = datetime.utcnow()
    except Exception:
        pass

    db.commit()
    db.refresh(order)

    # Send Notification to Customer
    _send_customer_notification(
        db=db,
        order=order,
        title=f"Parchi Order #{order.id} Prices Updated",
        message=f"{shop.shop_name} updated prices for your order. Total Amount: ₹{total_amount:.2f}",
        notif_type="PRICE_UPDATE",
    )

    return get_shopkeeper_order_detail(order_id=order.id, db=db, current_user=current_user)