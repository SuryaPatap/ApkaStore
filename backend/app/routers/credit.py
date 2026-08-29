from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db

from ..models.user import User
from ..models.customer import Customer
from ..models.shop import Shop

from ..models.credit_request import CreditRequest
from ..models.credit_account import CreditAccount
from ..models.credit_ledger import CreditLedger
from ..models.credit_payment import CreditPayment
from ..models.order import Order
from ..models.order_item import OrderItem
from ..models.product import Product

from ..schemas.credit import (
    CreditRequestCreate,
    CreditApprovalRequest,
    CreditRequestResponse,
    CreditAccountResponse,
    CreditLedgerResponse,
    CreditPaymentCreate,
    CreditPaymentResponse,
    CustomerCreditSummary,
    ShopkeeperCustomerCreditResponse,
)

from ..core.dependencies import get_current_user


router = APIRouter(
    prefix="/api/v1/credit",
    tags=["Credit"],
)


# ============================================================
# CUSTOMER HELPER
# ============================================================

def get_customer(
    db: Session,
    current_user: User,
):
    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can access credit.",
        )

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
# SHOPKEEPER HELPER
# ============================================================

def get_shopkeeper_shop(
    db: Session,
    current_user: User,
):
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
            detail="Shop not found.",
        )

    return shop


# ============================================================
# HELPER: POPULATE DETAILED LEDGER ENTRIES (WITH ITEMS & DATES)
# ============================================================

def populate_ledger_details(
    entries: list[CreditLedger],
    db: Session,
) -> list[dict]:
    results = []
    for entry in entries:
        cust = db.query(Customer).filter(Customer.id == entry.customer_id).first()
        shp = db.query(Shop).filter(Shop.id == entry.shop_id).first()

        items_list = []
        if entry.order_id:
            order = db.query(Order).filter(Order.id == entry.order_id).first()
            if order and order.items:
                for it in order.items:
                    prod = db.query(Product).filter(Product.id == it.product_id).first() if it.product_id else None
                    p_name = prod.name if prod else f"Item #{it.product_id or it.id}"
                    p_unit = prod.unit if prod else "unit"
                    items_list.append({
                        "product_name": p_name,
                        "quantity": it.quantity,
                        "unit_price": it.unit_price,
                        "subtotal": it.unit_price * it.quantity,
                        "unit": p_unit,
                    })

        dt = entry.created_at
        f_date = dt.strftime("%d %b %Y") if dt else None
        f_time = dt.strftime("%I:%M %p") if dt else None

        results.append({
            "id": entry.id,
            "customer_id": entry.customer_id,
            "customer_name": cust.name if cust else None,
            "customer_phone": cust.phone if cust else None,
            "shop_id": entry.shop_id,
            "shop_name": shp.shop_name if shp else None,
            "order_id": entry.order_id,
            "transaction_type": entry.transaction_type,
            "amount": entry.amount,
            "balance_after": entry.balance_after,
            "description": entry.description,
            "payment_reference": entry.payment_reference,
            "formatted_date": f_date,
            "formatted_time": f_time,
            "created_at": entry.created_at,
            "items": items_list,
        })
    return results


# ============================================================
# CUSTOMER - REQUEST CREDIT
# ============================================================

@router.post(
    "/request",
    response_model=CreditRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def request_credit(
    data: CreditRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = get_customer(
        db=db,
        current_user=current_user,
    )

    shop = (
        db.query(Shop)
        .filter(
            Shop.id == data.shop_id,
            Shop.is_active == True,
        )
        .first()
    )

    if shop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found.",
        )

    existing = (
        db.query(CreditRequest)
        .filter(
            CreditRequest.customer_id == customer.id,
            CreditRequest.shop_id == shop.id,
            CreditRequest.status == "PENDING",
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A credit request is already pending.",
        )

    request = CreditRequest(
        customer_id=customer.id,
        shop_id=shop.id,
        requested_limit=data.requested_limit,
        approved_limit=None,
        status="PENDING",
        notes=data.notes,
    )

    db.add(request)
    db.commit()
    db.refresh(request)

    return {
        "id": request.id,
        "customer_id": request.customer_id,
        "customer_name": customer.name,
        "customer_phone": customer.phone,
        "shop_id": request.shop_id,
        "shop_name": shop.shop_name,
        "requested_limit": request.requested_limit,
        "approved_limit": request.approved_limit,
        "status": request.status,
        "notes": request.notes,
        "created_at": request.created_at,
        "updated_at": request.updated_at,
    }


# ============================================================
# CUSTOMER - MY CREDIT REQUESTS
# ============================================================

@router.get(
    "/requests",
    response_model=list[CreditRequestResponse],
)
def get_my_credit_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = get_customer(
        db=db,
        current_user=current_user,
    )

    reqs = (
        db.query(CreditRequest)
        .filter(
            CreditRequest.customer_id == customer.id,
        )
        .order_by(CreditRequest.id.desc())
        .all()
    )

    output = []
    for r in reqs:
        shp = db.query(Shop).filter(Shop.id == r.shop_id).first()
        output.append({
            "id": r.id,
            "customer_id": r.customer_id,
            "customer_name": customer.name,
            "customer_phone": customer.phone,
            "shop_id": r.shop_id,
            "shop_name": shp.shop_name if shp else None,
            "requested_limit": r.requested_limit,
            "approved_limit": r.approved_limit,
            "status": r.status,
            "notes": r.notes,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        })
    return output


# ============================================================
# SHOPKEEPER - GET CREDIT REQUESTS
# ============================================================

@router.get(
    "/shopkeeper/requests",
    response_model=list[CreditRequestResponse],
)
def get_credit_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = get_shopkeeper_shop(
        db=db,
        current_user=current_user,
    )

    reqs = (
        db.query(CreditRequest)
        .filter(
            CreditRequest.shop_id == shop.id,
            CreditRequest.status == "PENDING",
        )
        .order_by(CreditRequest.id.desc())
        .all()
    )

    output = []
    for r in reqs:
        cust = db.query(Customer).filter(Customer.id == r.customer_id).first()
        output.append({
            "id": r.id,
            "customer_id": r.customer_id,
            "customer_name": cust.name if cust else None,
            "customer_phone": cust.phone if cust else None,
            "shop_id": r.shop_id,
            "shop_name": shop.shop_name,
            "requested_limit": r.requested_limit,
            "approved_limit": r.approved_limit,
            "status": r.status,
            "notes": r.notes,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        })
    return output


# ============================================================
# SHOPKEEPER - APPROVE / REJECT CREDIT
# ============================================================

@router.patch(
    "/shopkeeper/requests/{request_id}",
    response_model=CreditRequestResponse,
)
def approve_credit_request(
    request_id: int,
    data: CreditApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = get_shopkeeper_shop(
        db=db,
        current_user=current_user,
    )

    request = (
        db.query(CreditRequest)
        .filter(
            CreditRequest.id == request_id,
            CreditRequest.shop_id == shop.id,
            CreditRequest.status == "PENDING",
        )
        .first()
    )

    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending credit request not found.",
        )

    if data.approved:
        approved_limit = (
            data.approved_limit
            if data.approved_limit is not None
            else request.requested_limit
        )

        if approved_limit <= Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Approved credit limit must be greater than zero.",
            )

        request.approved_limit = approved_limit
        request.status = "APPROVED"

        account = (
            db.query(CreditAccount)
            .filter(
                CreditAccount.customer_id == request.customer_id,
                CreditAccount.shop_id == shop.id,
            )
            .first()
        )

        if account is None:
            account = CreditAccount(
                customer_id=request.customer_id,
                shop_id=shop.id,
                credit_limit=approved_limit,
                outstanding_amount=Decimal("0.00"),
                status="ACTIVE",
            )
            db.add(account)
        else:
            account.credit_limit = approved_limit
            account.status = "ACTIVE"

    else:
        request.status = "REJECTED"
        request.approved_limit = Decimal("0.00")

    if data.notes is not None:
        request.notes = data.notes

    db.commit()
    db.refresh(request)

    cust = db.query(Customer).filter(Customer.id == request.customer_id).first()
    return {
        "id": request.id,
        "customer_id": request.customer_id,
        "customer_name": cust.name if cust else None,
        "customer_phone": cust.phone if cust else None,
        "shop_id": request.shop_id,
        "shop_name": shop.shop_name,
        "requested_limit": request.requested_limit,
        "approved_limit": request.approved_limit,
        "status": request.status,
        "notes": request.notes,
        "created_at": request.created_at,
        "updated_at": request.updated_at,
    }


# ============================================================
# CUSTOMER - CREDIT ACCOUNT
# ============================================================

@router.get(
    "/account/{shop_id}",
    response_model=CreditAccountResponse,
)
def get_credit_account(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = get_customer(
        db=db,
        current_user=current_user,
    )

    account = (
        db.query(CreditAccount)
        .filter(
            CreditAccount.customer_id == customer.id,
            CreditAccount.shop_id == shop_id,
        )
        .first()
    )

    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit account not found.",
        )

    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    available_credit = account.credit_limit - account.outstanding_amount

    return {
        "id": account.id,
        "customer_id": account.customer_id,
        "customer_name": customer.name,
        "customer_phone": customer.phone,
        "shop_id": account.shop_id,
        "shop_name": shop.shop_name if shop else None,
        "credit_limit": account.credit_limit,
        "outstanding_amount": account.outstanding_amount,
        "available_credit": max(available_credit, Decimal("0.00")),
        "status": account.status,
        "created_at": account.created_at,
        "updated_at": account.updated_at,
    }


# ============================================================
# CUSTOMER - ITEMIZED CREDIT LEDGER
# ============================================================

@router.get(
    "/ledger/{shop_id}",
    response_model=list[CreditLedgerResponse],
)
def get_my_credit_ledger(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = get_customer(
        db=db,
        current_user=current_user,
    )

    entries = (
        db.query(CreditLedger)
        .filter(
            CreditLedger.customer_id == customer.id,
            CreditLedger.shop_id == shop_id,
        )
        .order_by(CreditLedger.id.desc())
        .all()
    )

    return populate_ledger_details(entries, db)


# ============================================================
# CUSTOMER - MAKE CREDIT PAYMENT
# ============================================================

@router.post(
    "/payment/{shop_id}",
    response_model=CreditPaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def make_credit_payment(
    shop_id: int,
    data: CreditPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = get_customer(
        db=db,
        current_user=current_user,
    )

    account = (
        db.query(CreditAccount)
        .filter(
            CreditAccount.customer_id == customer.id,
            CreditAccount.shop_id == shop_id,
        )
        .first()
    )

    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit account not found.",
        )

    if account.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Credit account is not active.",
        )

    if data.amount > account.outstanding_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment cannot be greater than outstanding amount.",
        )

    account.outstanding_amount -= data.amount

    payment = CreditPayment(
        customer_id=customer.id,
        shop_id=shop_id,
        amount=data.amount,
        payment_method=data.payment_method,
        reference_number=data.reference_number,
        status="SUCCESS",
    )

    db.add(payment)

    ledger = CreditLedger(
        customer_id=customer.id,
        shop_id=shop_id,
        order_id=None,
        transaction_type="PAYMENT",
        amount=data.amount,
        balance_after=account.outstanding_amount,
        description=data.notes or f"Repayment via {data.payment_method}",
    )

    db.add(ledger)
    db.commit()
    db.refresh(payment)

    return payment


# ============================================================
# SHOPKEEPER - CUSTOMER CREDIT ACCOUNTS
# ============================================================

@router.get(
    "/shopkeeper/accounts",
    response_model=list[ShopkeeperCustomerCreditResponse],
)
def get_shopkeeper_credit_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = get_shopkeeper_shop(
        db=db,
        current_user=current_user,
    )

    accounts = (
        db.query(CreditAccount)
        .filter(
            CreditAccount.shop_id == shop.id,
        )
        .order_by(CreditAccount.id.desc())
        .all()
    )

    response = []
    for account in accounts:
        customer = (
            db.query(Customer)
            .filter(Customer.id == account.customer_id)
            .first()
        )
        if customer is None:
            continue

        available_credit = account.credit_limit - account.outstanding_amount

        # Get last transaction
        last_t = (
            db.query(CreditLedger)
            .filter(
                CreditLedger.customer_id == customer.id,
                CreditLedger.shop_id == shop.id,
            )
            .order_by(CreditLedger.id.desc())
            .first()
        )

        response.append({
            "customer_id": customer.id,
            "customer_name": customer.name,
            "customer_phone": customer.phone,
            "customer_email": customer.email,
            "credit_limit": account.credit_limit,
            "outstanding_amount": account.outstanding_amount,
            "available_credit": max(available_credit, Decimal("0.00")),
            "account_status": account.status,
            "last_transaction_at": last_t.created_at if last_t else account.updated_at,
        })

    return response


# ============================================================
# SHOPKEEPER - VIEW SPECIFIC CUSTOMER'S ITEMIZED UDHAR KHATA LEDGER
# ============================================================

@router.get(
    "/shopkeeper/ledger/{customer_id}",
    response_model=list[CreditLedgerResponse],
)
def get_customer_ledger_for_shopkeeper(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = get_shopkeeper_shop(
        db=db,
        current_user=current_user,
    )

    entries = (
        db.query(CreditLedger)
        .filter(
            CreditLedger.customer_id == customer_id,
            CreditLedger.shop_id == shop.id,
        )
        .order_by(CreditLedger.id.desc())
        .all()
    )

    return populate_ledger_details(entries, db)


# ============================================================
# SHOPKEEPER - RECORD CUSTOMER PAYMENT
# ============================================================

@router.post(
    "/shopkeeper/record-payment/{customer_id}",
    response_model=CreditPaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def shopkeeper_record_payment(
    customer_id: int,
    data: CreditPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = get_shopkeeper_shop(
        db=db,
        current_user=current_user,
    )

    account = (
        db.query(CreditAccount)
        .filter(
            CreditAccount.customer_id == customer_id,
            CreditAccount.shop_id == shop.id,
        )
        .first()
    )

    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit account not found.",
        )

    if data.amount > account.outstanding_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount cannot exceed outstanding balance.",
        )

    account.outstanding_amount -= data.amount

    payment = CreditPayment(
        credit_account_id=account.id,
        amount=data.amount,
        payment_method=data.payment_method,
        payment_reference=data.reference_number,
        status="COMPLETED",
        description=data.notes or f"Repayment collected via {data.payment_method}",
    )
    db.add(payment)

    ledger = CreditLedger(
        customer_id=customer_id,
        shop_id=shop.id,
        order_id=None,
        transaction_type="PAYMENT",
        amount=data.amount,
        balance_after=account.outstanding_amount,
        description=data.notes or f"Repayment collected via {data.payment_method}",
    )
    db.add(ledger)
    db.commit()
    db.refresh(payment)

    return payment