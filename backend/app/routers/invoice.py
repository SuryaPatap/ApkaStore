from datetime import datetime, timezone
import random
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from ..database import get_db
from ..models.invoice import Invoice, InvoiceItem
from ..models.product import Product
from ..models.inventory import Inventory
from ..models.shop import Shop
from ..models.user import User
from ..models.credit_account import CreditAccount
from ..models.credit_transaction import CreditTransaction
from ..schemas.invoice import InvoiceCreate, InvoiceResponse
from ..core.roles import require_role

router = APIRouter(
    prefix="/api/v1/invoices",
    tags=["Invoices"],
)


def generate_invoice_number(db: Session, shop_id: int) -> str:
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = db.query(Invoice).filter(Invoice.shop_id == shop_id).count() + 1
    random_suffix = random.randint(100, 999)
    return f"INV-{today_str}-{shop_id:02d}{count:03d}-{random_suffix}"


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    invoice_data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("shopkeeper", "admin")),
):
    shop = (
        db.query(Shop)
        .filter(
            Shop.owner_user_id == current_user.id,
            Shop.is_active.is_(True),
        )
        .first()
    )
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active shop not found.",
        )

    if not invoice_data.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice must have at least one line item.",
        )

    invoice_no = generate_invoice_number(db, shop.id)

    # Determine payment status
    payment_status = "PAID"
    if invoice_data.payment_method == "UDHAR_KHATA":
        payment_status = "PENDING"
    elif invoice_data.payment_status:
        payment_status = invoice_data.payment_status

    invoice = Invoice(
        shop_id=shop.id,
        customer_id=invoice_data.customer_id,
        invoice_number=invoice_no,
        customer_name=invoice_data.customer_name or "Walk-in Customer",
        customer_phone=invoice_data.customer_phone,
        subtotal_amount=invoice_data.subtotal_amount,
        discount_amount=invoice_data.discount_amount,
        tax_amount=invoice_data.tax_amount,
        total_amount=invoice_data.total_amount,
        payment_method=invoice_data.payment_method,
        payment_status=payment_status,
        notes=invoice_data.notes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(invoice)
    db.flush()

    # Add line items & deduct stock
    for item in invoice_data.items:
        line_item = InvoiceItem(
            invoice_id=invoice.id,
            product_id=item.product_id,
            product_name=item.product_name,
            unit=item.unit or "1 unit",
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.total_price,
        )
        db.add(line_item)

        # Deduct inventory stock if product_id is associated
        if item.product_id:
            inv = (
                db.query(Inventory)
                .filter(Inventory.product_id == item.product_id, Inventory.shop_id == shop.id)
                .first()
            )
            if inv:
                inv.stock_quantity = max(0, inv.stock_quantity - item.quantity)

    # Handle Udhar Khata credit tracking if customer selected
    if invoice_data.payment_method == "UDHAR_KHATA" and invoice_data.customer_id:
        credit_acc = (
            db.query(CreditAccount)
            .filter(
                CreditAccount.customer_id == invoice_data.customer_id,
                CreditAccount.shop_id == shop.id,
            )
            .first()
        )
        if not credit_acc:
            credit_acc = CreditAccount(
                customer_id=invoice_data.customer_id,
                shop_id=shop.id,
                credit_limit=Decimal("10000.00"),
                outstanding_amount=Decimal("0.00"),
                status="APPROVED",
                is_active=True,
            )
            db.add(credit_acc)
            db.flush()

        credit_acc.outstanding_amount += Decimal(str(invoice_data.total_amount))

        # Add credit transaction
        credit_tx = CreditTransaction(
            credit_account_id=credit_acc.id,
            amount=Decimal(str(invoice_data.total_amount)),
            transaction_type="DEBIT",
            notes=f"Invoice #{invoice_no}",
            created_at=datetime.now(timezone.utc),
        )
        db.add(credit_tx)

    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("", response_model=List[InvoiceResponse])
def get_invoices(
    search: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("shopkeeper", "admin")),
):
    shop = (
        db.query(Shop)
        .filter(
            Shop.owner_user_id == current_user.id,
            Shop.is_active.is_(True),
        )
        .first()
    )
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active shop not found.",
        )

    query = db.query(Invoice).filter(Invoice.shop_id == shop.id)

    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                Invoice.invoice_number.ilike(s),
                Invoice.customer_name.ilike(s),
                Invoice.customer_phone.ilike(s),
            )
        )

    if payment_method:
        query = query.filter(Invoice.payment_method == payment_method)

    if payment_status:
        query = query.filter(Invoice.payment_status == payment_status)

    invoices = query.order_by(desc(Invoice.created_at)).offset(offset).limit(limit).all()
    return invoices


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice_by_id(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("shopkeeper", "admin", "customer")),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found.",
        )
    return invoice
