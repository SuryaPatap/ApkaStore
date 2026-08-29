"""
Parchi Router
=============
Parchi is a direct chat channel between a Customer and their connected Shop.

Endpoints
---------
POST   /api/v1/parchi/start                  - Customer: start (or get) a Parchi with selected shop
GET    /api/v1/parchi/my                     - Customer: get own Parchi thread detail
GET    /api/v1/parchi/shopkeeper             - Shopkeeper: list all customer Parchi threads
GET    /api/v1/parchi/shopkeeper/{parchi_id} - Shopkeeper: read a specific Parchi thread
POST   /api/v1/parchi/{parchi_id}/messages   - Send a text or ORDER_REQUEST message
GET    /api/v1/parchi/{parchi_id}/messages   - Poll messages for a thread
PATCH  /api/v1/parchi/shopkeeper/order/{msg_id}/respond - Shopkeeper: confirm or decline order request
"""

import json
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..core.dependencies import get_current_user

from ..models.user import User
from ..models.customer import Customer
from ..models.shop import Shop
from ..models.shop_customer import ShopCustomer
from ..models.product import Product
from ..models.order import Order
from ..models.order_item import OrderItem
from ..models.inventory import Inventory
from ..models.address import Address
from ..models.parchi import Parchi
from ..models.parchi_message import ParchiMessage

from ..models.address import Address as AddressModel
from ..schemas.parchi import (
    ParchiStartRequest,
    ParchiMessageCreate,
    ParchiMessageResponse,
    ParchiResponse,
    ParchiDetailResponse,
    ParchiOrderResponse,
)


router = APIRouter(
    prefix="/api/v1/parchi",
    tags=["Parchi"],
)


# ============================================================
# HELPERS
# ============================================================

def _format_address(db: Session, address_id: int | None) -> str | None:
    if not address_id:
        return None
    addr = db.query(AddressModel).filter(AddressModel.id == address_id).first()
    if not addr:
        return None
    parts = [
        p for p in [
            addr.house_number,
            addr.street,
            addr.locality,
            addr.landmark,
            addr.city,
            addr.state,
            addr.pincode,
        ] if p
    ]
    return ", ".join(parts) if parts else None


def _get_customer(db: Session, current_user: User) -> Customer:
    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can access this resource.",
        )
    customer = (
        db.query(Customer)
        .filter(Customer.user_id == current_user.id)
        .first()
    )
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found.",
        )
    return customer


def _get_shopkeeper_shop(db: Session, current_user: User) -> Shop:
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
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found for this shopkeeper.",
        )
    return shop


def _get_parchi(db: Session, parchi_id: int) -> Parchi:
    parchi = db.query(Parchi).filter(Parchi.id == parchi_id).first()
    if not parchi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parchi thread not found.",
        )
    return parchi


def _enrich_parchi(db: Session, parchi: Parchi) -> dict:
    """Build a ParchiResponse-compatible dict with extra context fields."""
    # Customer
    customer = db.query(Customer).filter(Customer.id == parchi.customer_id).first()
    customer_name = "Customer"
    customer_phone = None
    customer_address = None
    if customer:
        customer_user = db.query(User).filter(User.id == customer.user_id).first()
        if customer_user:
            customer_name = customer_user.name
            customer_phone = customer_user.phone
        customer_address = _format_address(db, customer.address_id)

    # Shop
    shop = db.query(Shop).filter(Shop.id == parchi.shop_id).first()
    shop_name = "Shop"
    shop_phone = None
    shop_address = None
    if shop:
        shop_name = shop.shop_name
        shop_phone = getattr(shop, "shop_phone", None)
        if not shop_phone:
            owner_user = db.query(User).filter(User.id == shop.owner_user_id).first()
            if owner_user:
                shop_phone = owner_user.phone
        shop_address = _format_address(db, shop.address_id)

    # Stats
    messages = (
        db.query(ParchiMessage)
        .filter(ParchiMessage.parchi_id == parchi.id)
        .order_by(ParchiMessage.created_at.desc())
        .all()
    )
    message_count = len(messages)
    last_message_preview = messages[0].content[:80] if messages else None
    order_count = sum(1 for m in messages if m.message_type in ("ORDER_REQUEST", "PARCHI_LIST"))

    return {
        "id": parchi.id,
        "customer_id": parchi.customer_id,
        "shop_id": parchi.shop_id,
        "is_active": parchi.is_active,
        "created_at": parchi.created_at,
        "last_message_at": parchi.last_message_at,
        "shop_name": shop_name,
        "shop_phone": shop_phone,
        "shop_address": shop_address,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "customer_address": customer_address,
        "last_message_preview": last_message_preview,
        "message_count": message_count,
        "order_count": order_count,
    }


# ============================================================
# CUSTOMER — START / GET MY PARCHI
# ============================================================

@router.post("/start", response_model=ParchiResponse)
def start_parchi(
    payload: ParchiStartRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Customer starts (or retrieves) their Parchi thread with the connected shop.
    Automatically connects customer to the selected shop or nearest active shop.
    """
    customer = _get_customer(db, current_user)

    target_shop_id = payload.shop_id if payload and payload.shop_id else None

    if target_shop_id:
        shop = db.query(Shop).filter(Shop.id == target_shop_id, Shop.is_active == True).first()
        if not shop:
            raise HTTPException(status_code=404, detail="Selected shop not found.")
        # Activate link
        link = db.query(ShopCustomer).filter(
            ShopCustomer.customer_id == customer.id,
            ShopCustomer.shop_id == target_shop_id,
        ).first()
        if not link:
            link = ShopCustomer(customer_id=customer.id, shop_id=target_shop_id, is_active=True)
            db.add(link)
        else:
            link.is_active = True
        shop_id = target_shop_id
    else:
        # Find existing active link
        link = (
            db.query(ShopCustomer)
            .filter(
                ShopCustomer.customer_id == customer.id,
                ShopCustomer.is_active == True,
            )
            .first()
        )
        if link:
            shop_id = link.shop_id
        else:
            # Pick first active shop
            shop = db.query(Shop).filter(Shop.is_active == True).first()
            if not shop:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No active shops available to start Parchi.",
                )
            link = ShopCustomer(customer_id=customer.id, shop_id=shop.id, is_active=True)
            db.add(link)
            shop_id = shop.id

    db.flush()

    # Return existing Parchi if one already exists
    parchi = (
        db.query(Parchi)
        .filter(
            Parchi.customer_id == customer.id,
            Parchi.shop_id == shop_id,
        )
        .first()
    )

    if not parchi:
        parchi = Parchi(
            customer_id=customer.id,
            shop_id=shop_id,
            is_active=True,
            created_at=datetime.utcnow(),
            last_message_at=datetime.utcnow(),
        )
        db.add(parchi)
        db.flush()

        # Welcome system message
        welcome = ParchiMessage(
            parchi_id=parchi.id,
            sender_role="SYSTEM",
            message_type="TEXT",
            content="🎉 Connected with store! You can now send Parchi lists, chat, and order groceries directly.",
            created_at=datetime.utcnow(),
        )
        db.add(welcome)
        db.commit()
        db.refresh(parchi)

    return _enrich_parchi(db, parchi)


@router.get("/my", response_model=ParchiDetailResponse)
def get_my_parchi(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Customer: get full Parchi thread (metadata + all messages)."""
    customer = _get_customer(db, current_user)

    parchi = (
        db.query(Parchi)
        .filter(Parchi.customer_id == customer.id)
        .first()
    )
    if not parchi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Parchi found. Start one first via POST /parchi/start.",
        )

    msgs = (
        db.query(ParchiMessage)
        .filter(ParchiMessage.parchi_id == parchi.id)
        .order_by(ParchiMessage.created_at.asc())
        .all()
    )

    return {
        "parchi": _enrich_parchi(db, parchi),
        "messages": msgs,
    }


# ============================================================
# SHOPKEEPER — LIST ALL PARCHI THREADS
# ============================================================

@router.get("/shopkeeper", response_model=list[ParchiResponse])
def get_shopkeeper_parchibas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Shopkeeper: list all customer Parchi threads for this shop."""
    shop = _get_shopkeeper_shop(db, current_user)

    parchibas = (
        db.query(Parchi)
        .filter(Parchi.shop_id == shop.id)
        .order_by(Parchi.last_message_at.desc().nullslast())
        .all()
    )

    return [_enrich_parchi(db, p) for p in parchibas]


@router.get("/shopkeeper/{parchi_id}", response_model=ParchiDetailResponse)
def get_shopkeeper_parchi_detail(
    parchi_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Shopkeeper: read a specific customer's Parchi thread in full."""
    shop = _get_shopkeeper_shop(db, current_user)
    parchi = _get_parchi(db, parchi_id)

    if parchi.shop_id != shop.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This Parchi does not belong to your shop.",
        )

    msgs = (
        db.query(ParchiMessage)
        .filter(ParchiMessage.parchi_id == parchi.id)
        .order_by(ParchiMessage.created_at.asc())
        .all()
    )

    return {
        "parchi": _enrich_parchi(db, parchi),
        "messages": msgs,
    }


# ============================================================
# SEND A MESSAGE (both roles)
# ============================================================

@router.post("/{parchi_id}/messages", response_model=ParchiMessageResponse)
def send_message(
    parchi_id: int,
    body: ParchiMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send a message in a Parchi thread.

    - TEXT: plain chat message
    - ORDER_REQUEST: customer places an order via Parchi chat
    """
    parchi = _get_parchi(db, parchi_id)

    # Determine sender role
    if current_user.role == "customer":
        customer = _get_customer(db, current_user)
        if parchi.customer_id != customer.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This Parchi does not belong to you.",
            )
        sender_role = "CUSTOMER"
    elif current_user.role == "shopkeeper":
        shop = _get_shopkeeper_shop(db, current_user)
        if parchi.shop_id != shop.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This Parchi does not belong to your shop.",
            )
        sender_role = "SHOPKEEPER"
    else:
        raise HTTPException(status_code=403, detail="Unknown role.")

    order_id = None
    product_snapshot = None

    # Handle ORDER_REQUEST from customer
    if body.message_type == "ORDER_REQUEST":
        if sender_role != "CUSTOMER":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only customers can place an order request via Parchi.",
            )
        if not body.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order request must include at least one item.",
            )

        customer = _get_customer(db, current_user)
        shop_id = parchi.shop_id

        # Validate products and build snapshot
        snapshot = []
        total = 0.0
        order_items_data = []

        for item in body.items:
            product = (
                db.query(Product)
                .filter(
                    Product.id == item.product_id,
                    Product.shop_id == shop_id,
                )
                .first()
            )
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product {item.product_id} not found in this shop.",
                )

            inv = (
                db.query(Inventory)
                .filter(Inventory.product_id == product.id)
                .first()
            )
            available_qty = inv.stock_quantity if inv else 0
            if available_qty < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock for '{product.name}'. Available: {available_qty}",
                )

            price = float(product.price)
            total += price * item.quantity
            snapshot.append({
                "product_id": product.id,
                "name": product.name,
                "qty": item.quantity,
                "price": price,
                "subtotal": price * item.quantity,
            })
            order_items_data.append({"product": product, "quantity": item.quantity, "price": price})

        # Create the Order
        new_order = Order(
            customer_id=customer.id,
            shop_id=shop_id,
            status="PENDING",
            total_amount=total,
            payment_method=body.payment_method,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(new_order)
        db.flush()

        for od in order_items_data:
            oi = OrderItem(
                order_id=new_order.id,
                product_id=od["product"].id,
                quantity=od["quantity"],
                unit_price=od["price"],
                status="RESERVED",
            )
            db.add(oi)
            # Deduct inventory
            inv = (
                db.query(Inventory)
                .filter(Inventory.product_id == od["product"].id)
                .first()
            )
            if inv:
                inv.stock_quantity -= od["quantity"]

        order_id = new_order.id
        product_snapshot = json.dumps(snapshot, ensure_ascii=False)

        # Build the message content summary
        item_lines = ", ".join(
            f'{s["name"]} ×{s["qty"]} (₹{s["subtotal"]:.0f})' for s in snapshot
        )
        content_text = (
            f"🛒 ORDER REQUEST\n"
            f"{item_lines}\n"
            f"Total: ₹{total:.2f}\n"
            f"Payment: {body.payment_method}"
        )

        # Handle UDHAR_KHATA recording
        if body.payment_method == "UDHAR_KHATA":
            try:
                from ..models.credit_account import CreditAccount
                from ..models.credit_ledger import CreditLedger
                from ..models.credit_transaction import CreditTransaction

                credit_acct = (
                    db.query(CreditAccount)
                    .filter(
                        CreditAccount.customer_id == customer.id,
                        CreditAccount.shop_id == shop_id,
                        CreditAccount.status == "ACTIVE",
                    )
                    .first()
                )
                if credit_acct:
                    credit_acct.outstanding_balance = float(credit_acct.outstanding_balance) + total
                    ct = CreditTransaction(
                        credit_account_id=credit_acct.id,
                        transaction_type="DEBIT",
                        amount=total,
                        description=f"Parchi order #{new_order.id}",
                        order_id=new_order.id,
                        created_at=datetime.utcnow(),
                    )
                    db.add(ct)
            except Exception:
                pass  # Credit recording failure should not block the order

        msg_content = content_text

    elif body.message_type == "PARCHI_LIST":
        if sender_role != "CUSTOMER":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only customers can send a Parchi grocery list.",
            )

        customer = _get_customer(db, current_user)
        shop_id = parchi.shop_id

        # 1. Create a real Order entry for the Digital Parchi List
        parchi_order = Order(
            customer_id=customer.id,
            shop_id=shop_id,
            status="PENDING",
            total_amount=Decimal("0.00"),
            payment_method=body.payment_method or "COD",
            notes=f"Digital Parchi: {body.customer_notes or 'Grocery List'}",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(parchi_order)
        db.flush()

        calculated_total = Decimal("0.00")

        # 2. Add OrderItem records for each Parchi custom item
        if body.parchi_items:
            for it in body.parchi_items:
                import re
                qty_val = 1
                try:
                    digits = re.findall(r'\d+', it.quantity)
                    if digits:
                        qty_val = int(digits[0])
                except Exception:
                    qty_val = 1

                # Check if catalog has matching product
                matching_prod = db.query(Product).filter(
                    Product.shop_id == shop_id,
                    Product.name.ilike(f"%{it.name}%"),
                    Product.is_active == True,
                ).first()

                u_price = matching_prod.price if matching_prod else Decimal("0.00")
                if matching_prod:
                    calculated_total += Decimal(str(u_price)) * qty_val

                oi = OrderItem(
                    order_id=parchi_order.id,
                    product_id=matching_prod.id if matching_prod else None,
                    custom_name=f"{it.name} ({it.quantity})" if not matching_prod else it.name,
                    quantity=qty_val,
                    unit_price=u_price,
                    status="PENDING",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(oi)

            parchi_order.total_amount = calculated_total

            lines = [f"{idx+1}. {item.name} ({item.quantity})" for idx, item in enumerate(body.parchi_items)]
            items_str = "\n".join(lines)
            notes_str = f"\n📝 Note: {body.customer_notes}" if body.customer_notes else ""
            msg_content = (
                f"📋 DIGITAL PARCHI GROCERY LIST (Order #{parchi_order.id})\n"
                f"{items_str}{notes_str}\n"
                f"Payment: {body.payment_method or 'COD'}"
            )
            product_snapshot = json.dumps(
                [{"name": item.name, "quantity": item.quantity} for item in body.parchi_items],
                ensure_ascii=False,
            )
        else:
            msg_content = body.content or f"📋 Digital Parchi List (Order #{parchi_order.id})"

        order_id = parchi_order.id

    else:
        msg_content = body.content

    # Create message
    msg = ParchiMessage(
        parchi_id=parchi.id,
        sender_role=sender_role,
        message_type=body.message_type,
        content=msg_content,
        order_id=order_id,
        product_snapshot=product_snapshot,
        created_at=datetime.utcnow(),
    )
    db.add(msg)

    # Update last_message_at on thread
    parchi.last_message_at = datetime.utcnow()

    db.commit()
    db.refresh(msg)

    # Dispatch notification to recipient
    try:
        from ..models.notification import Notification
        if sender_role == "CUSTOMER":
            # Notify Shopkeeper
            shop = db.query(Shop).filter(Shop.id == parchi.shop_id).first()
            if shop and shop.owner_user_id:
                if body.message_type == "PARCHI_LIST":
                    n_title = "📋 New Digital Parchi List Received"
                    n_msg = f"{current_user.name} sent a grocery list (Order #{order_id})."
                elif body.message_type == "ORDER_REQUEST":
                    n_title = "🛒 New Order Request"
                    n_msg = f"{current_user.name} placed order #{order_id}."
                else:
                    n_title = f"💬 New Message from {current_user.name}"
                    n_msg = body.content[:100] if body.content else "Sent a message"

                notif = Notification(
                    user_id=shop.owner_user_id,
                    order_id=order_id,
                    title=n_title,
                    message=n_msg,
                    type="PARCHI_MESSAGE",
                    is_read=False,
                    created_at=datetime.utcnow(),
                )
                db.add(notif)
                db.commit()
        else:
            # Notify Customer
            customer = db.query(Customer).filter(Customer.id == parchi.customer_id).first()
            if customer and customer.user_id:
                shop = db.query(Shop).filter(Shop.id == parchi.shop_id).first()
                s_name = shop.shop_name if shop else "Shopkeeper"
                notif = Notification(
                    user_id=customer.user_id,
                    order_id=order_id,
                    title=f"💬 New Message from {s_name}",
                    message=body.content[:100] if body.content else "Sent you an update",
                    type="PARCHI_MESSAGE",
                    is_read=False,
                    created_at=datetime.utcnow(),
                )
                db.add(notif)
                db.commit()
    except Exception:
        pass

    return msg


# ============================================================
# GET MESSAGES (polling)
# ============================================================

@router.get("/{parchi_id}/messages", response_model=list[ParchiMessageResponse])
def get_messages(
    parchi_id: int,
    since_id: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch messages for a Parchi thread.
    Pass since_id to only get messages newer than that message ID (for polling).
    """
    parchi = _get_parchi(db, parchi_id)

    # Authorization
    if current_user.role == "customer":
        customer = _get_customer(db, current_user)
        if parchi.customer_id != customer.id:
            raise HTTPException(status_code=403, detail="Access denied.")
    elif current_user.role == "shopkeeper":
        shop = _get_shopkeeper_shop(db, current_user)
        if parchi.shop_id != shop.id:
            raise HTTPException(status_code=403, detail="Access denied.")

    query = db.query(ParchiMessage).filter(ParchiMessage.parchi_id == parchi.id)
    if since_id > 0:
        query = query.filter(ParchiMessage.id > since_id)

    return query.order_by(ParchiMessage.created_at.asc()).all()


# ============================================================
# SHOPKEEPER — RESPOND TO AN ORDER REQUEST
# ============================================================

@router.patch("/shopkeeper/order/{msg_id}/respond")
def respond_to_order_request(
    msg_id: int,
    body: ParchiOrderResponse,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Shopkeeper confirms or declines a Parchi ORDER_REQUEST message.
    - action: "CONFIRM" or "DECLINE"
    """
    shop = _get_shopkeeper_shop(db, current_user)

    msg = db.query(ParchiMessage).filter(ParchiMessage.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")
    if msg.message_type != "ORDER_REQUEST":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This message is not an order request.",
        )

    parchi = _get_parchi(db, msg.parchi_id)
    if parchi.shop_id != shop.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    action = body.action.upper()
    if action not in ("CONFIRM", "DECLINE"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="action must be CONFIRM or DECLINE.",
        )

    if msg.order_id:
        order = db.query(Order).filter(Order.id == msg.order_id).first()
        if order:
            if action == "CONFIRM":
                order.status = "CONFIRMED"
                new_msg_type = "ORDER_CONFIRMED"
                reply_text = body.reply_note or "✅ Order confirmed! We'll prepare it right away."
            else:
                order.status = "CANCELLED"
                new_msg_type = "ORDER_DECLINED"
                reply_text = body.reply_note or "❌ Sorry, we couldn't process this order."

    # Post a reply message from shopkeeper
    reply = ParchiMessage(
        parchi_id=parchi.id,
        sender_role="SHOPKEEPER",
        message_type=new_msg_type,
        content=reply_text,
        order_id=msg.order_id,
        created_at=datetime.utcnow(),
    )
    db.add(reply)
    parchi.last_message_at = datetime.utcnow()
    db.commit()

    return {
        "message": f"Order {action.lower()}d successfully.",
        "order_id": msg.order_id,
        "new_order_status": order.status if order else None,
    }
