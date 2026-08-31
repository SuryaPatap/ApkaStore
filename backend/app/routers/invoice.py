from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, func

from ..database import get_db
from ..models.invoice import PurchaseInvoice, PurchaseInvoiceItem
from ..models.product import Product
from ..models.inventory import Inventory
from ..models.shop import Shop
from ..models.user import User
from ..schemas.invoice import PurchaseInvoiceCreate, PurchaseInvoiceResponse
from ..core.roles import require_role

router = APIRouter(
    prefix="/api/v1/invoices",
    tags=["Invoices"],
)


@router.post("/purchase", response_model=PurchaseInvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_purchase_invoice(
    invoice_data: PurchaseInvoiceCreate,
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
            detail="Purchase invoice must contain at least one item.",
        )

    # Compute total amount
    total_amt = Decimal("0.00")
    for it in invoice_data.items:
        it_cost = it.total_cost if it.total_cost > 0 else (Decimal(str(it.quantity)) * Decimal(str(it.purchase_price)))
        total_amt += it_cost

    invoice = PurchaseInvoice(
        shop_id=shop.id,
        supplier_name=invoice_data.supplier_name.strip(),
        supplier_phone=invoice_data.supplier_phone.strip() if invoice_data.supplier_phone else None,
        invoice_number=invoice_data.invoice_number.strip(),
        invoice_date=invoice_data.invoice_date or datetime.now(timezone.utc),
        total_amount=invoice_data.total_amount if invoice_data.total_amount > 0 else total_amt,
        notes=invoice_data.notes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(invoice)
    db.flush()

    for it in invoice_data.items:
        product = None

        # 1. Match by product_id if provided
        if it.product_id:
            product = (
                db.query(Product)
                .filter(Product.id == it.product_id, Product.shop_id == shop.id)
                .first()
            )

        # 2. Match by exact product name in the same shop
        if not product and it.product_name.strip():
            product = (
                db.query(Product)
                .filter(
                    func.lower(Product.name) == it.product_name.strip().lower(),
                    Product.shop_id == shop.id,
                )
                .first()
            )

        # 3. If existing product, update price and increase stock
        if product:
            if it.selling_price > 0:
                product.price = it.selling_price
            if it.unit and it.unit.strip():
                product.unit = it.unit.strip()

            inv = (
                db.query(Inventory)
                .filter(Inventory.product_id == product.id, Inventory.shop_id == shop.id)
                .first()
            )
            if inv:
                inv.stock_quantity += it.quantity
            else:
                inv = Inventory(
                    shop_id=shop.id,
                    product_id=product.id,
                    stock_quantity=it.quantity,
                    is_active=True,
                )
                db.add(inv)
            
            resolved_prod_id = product.id

        # 4. If new product, create Product & initial Inventory
        else:
            new_prod = Product(
                shop_id=shop.id,
                name=it.product_name.strip(),
                category=it.category.strip() if it.category else "Groceries",
                unit=it.unit.strip() if it.unit else "1 unit",
                price=it.selling_price if it.selling_price > 0 else it.purchase_price,
                is_active=True,
            )
            db.add(new_prod)
            db.flush()

            inv = Inventory(
                shop_id=shop.id,
                product_id=new_prod.id,
                stock_quantity=it.quantity,
                is_active=True,
            )
            db.add(inv)
            resolved_prod_id = new_prod.id

        line_cost = it.total_cost if it.total_cost > 0 else (Decimal(str(it.quantity)) * Decimal(str(it.purchase_price)))

        line_item = PurchaseInvoiceItem(
            invoice_id=invoice.id,
            product_id=resolved_prod_id,
            product_name=it.product_name.strip(),
            category=it.category.strip() if it.category else "Groceries",
            unit=it.unit.strip() if it.unit else "1 unit",
            quantity=it.quantity,
            purchase_price=it.purchase_price,
            selling_price=it.selling_price,
            total_cost=line_cost,
        )
        db.add(line_item)

    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/purchase", response_model=List[PurchaseInvoiceResponse])
def get_purchase_invoices(
    search: Optional[str] = Query(None),
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

    query = db.query(PurchaseInvoice).filter(PurchaseInvoice.shop_id == shop.id)

    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                PurchaseInvoice.invoice_number.ilike(s),
                PurchaseInvoice.supplier_name.ilike(s),
            )
        )

    invoices = query.order_by(desc(PurchaseInvoice.created_at)).offset(offset).limit(limit).all()
    return invoices


@router.get("/purchase/{invoice_id}", response_model=PurchaseInvoiceResponse)
def get_purchase_invoice_by_id(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("shopkeeper", "admin")),
):
    invoice = db.query(PurchaseInvoice).filter(PurchaseInvoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase invoice not found.",
        )
    return invoice
