from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.customer import Customer
from ..models.address import Address
from ..models.shop import Shop
from ..models.shop_customer import ShopCustomer

from ..schemas.customer import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
)
from ..schemas.shop import ShopResponse

from ..core.dependencies import get_current_user
from ..core.roles import require_role
from ..core.security import hash_password
from ..core.geo import estimate_coordinates_from_address

router = APIRouter(
    prefix="/api/v1/customers",
    tags=["Customers"],
)


# ============================================================
# CREATE CUSTOMER
# ============================================================

@router.post(
    "",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_customer(
    customer_data: CustomerCreate,
    db: Session = Depends(get_db),
):
    address_data = customer_data.address

    # 1. Check existing user by phone
    existing_user = (
        db.query(User)
        .filter(User.phone == customer_data.phone)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this phone number already exists.",
        )

    # 2. Check existing user by email
    if customer_data.email:
        existing_email = (
            db.query(User)
            .filter(User.email == customer_data.email)
            .first()
        )

        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists.",
            )

    # 3. Coordinates
    lat = address_data.latitude
    lon = address_data.longitude
    if lat is None or lon is None:
        lat, lon = estimate_coordinates_from_address(
            address_data.pincode,
            address_data.city,
            address_data.locality,
        )

    addr_parts = [
        f"Flat {address_data.flat_number}" if address_data.flat_number else None,
        f"Bldg {address_data.building_number}" if address_data.building_number else None,
        address_data.house_number,
        address_data.street,
        f"Sector {address_data.sector}" if address_data.sector and not address_data.sector.lower().startswith("sector") else address_data.sector,
        address_data.locality,
        address_data.landmark,
        address_data.city,
        address_data.district,
        address_data.state,
        address_data.pincode,
        address_data.country,
    ]
    normalized_address = ", ".join(filter(None, addr_parts))

    address = Address(
        flat_number=address_data.flat_number,
        building_number=address_data.building_number,
        sector=address_data.sector,
        house_number=address_data.house_number,
        street=address_data.street,
        locality=address_data.locality,
        landmark=address_data.landmark,
        city=address_data.city,
        district=address_data.district,
        state=address_data.state,
        pincode=address_data.pincode,
        country=address_data.country,
        latitude=lat,
        longitude=lon,
        normalized_address=normalized_address,
    )

    db.add(address)
    db.flush()

    # 4. Create User
    user = User(
        name=customer_data.name,
        phone=customer_data.phone,
        email=customer_data.email,
        password_hash=hash_password(customer_data.password),
        role="customer",
    )

    db.add(user)
    db.flush()

    # 5. Create Customer
    customer = Customer(
        user_id=user.id,
        name=customer_data.name,
        phone=customer_data.phone,
        email=customer_data.email,
        address_id=address.id,
    )

    db.add(customer)

    try:
        db.commit()
        db.refresh(customer)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to register customer.",
        )

    return customer


# ============================================================
# GET CURRENT CUSTOMER PROFILE (ME)
# ============================================================

@router.get(
    "/me",
    response_model=CustomerResponse,
)
def get_customer_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can access customer profile.",
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
# SELECT ACTIVE NEARBY SHOP
# ============================================================

@router.post(
    "/select-shop/{shop_id}",
    response_model=ShopResponse,
)
def select_shop(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can select a shop.",
        )

    customer = (
        db.query(Customer)
        .filter(Customer.user_id == current_user.id)
        .first()
    )

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found.",
        )

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
            detail="Shop not found or inactive.",
        )

    # Deactivate previous active shop links
    db.query(ShopCustomer).filter(
        ShopCustomer.customer_id == customer.id
    ).update({"is_active": False})

    # Activate or create link for selected shop
    link = (
        db.query(ShopCustomer)
        .filter(
            ShopCustomer.customer_id == customer.id,
            ShopCustomer.shop_id == shop.id,
        )
        .first()
    )

    if link:
        link.is_active = True
    else:
        link = ShopCustomer(
            customer_id=customer.id,
            shop_id=shop.id,
            is_active=True,
        )
        db.add(link)

    db.commit()
    db.refresh(shop)
    return shop


# ============================================================
# GET CURRENTLY SELECTED SHOP
# ============================================================

@router.get(
    "/selected-shop",
    response_model=ShopResponse | None,
)
def get_selected_shop(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "customer":
        return None

    customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not customer:
        return None

    link = db.query(ShopCustomer).filter(
        ShopCustomer.customer_id == customer.id,
        ShopCustomer.is_active == True,
    ).first()

    if not link:
        return None

    shop = db.query(Shop).filter(Shop.id == link.shop_id, Shop.is_active == True).first()
    return shop


    return customer


# ============================================================
# GET CUSTOMERS
# ADMIN / STAFF ONLY
# ============================================================

@router.get(
    "",
    response_model=list[CustomerResponse],
)
def get_customers(
    search: str | None = None,
    is_active: bool = True,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "staff")
    ),
):

    # --------------------------------------------------------
    # Validate pagination
    # --------------------------------------------------------

    if skip < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="skip cannot be negative.",
        )

    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="limit must be between 1 and 100.",
        )

    # --------------------------------------------------------
    # Base query
    # --------------------------------------------------------

    query = (
        db.query(Customer)
        .filter(Customer.is_active == is_active)
    )

    # --------------------------------------------------------
    # Search
    # --------------------------------------------------------

    if search:

        search_value = f"%{search}%"

        query = query.filter(
            (Customer.name.ilike(search_value))
            | (Customer.phone.ilike(search_value))
            | (Customer.email.ilike(search_value))
        )

    # --------------------------------------------------------
    # Pagination
    # --------------------------------------------------------

    customers = (
        query
        .order_by(Customer.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return customers


# ============================================================
# GET CUSTOMER BY ID
# ADMIN / STAFF ONLY
# ============================================================

@router.get(
    "/{customer_id}",
    response_model=CustomerResponse,
)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "staff")
    ),
):

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

    return customer


# ============================================================
# UPDATE CUSTOMER
# ADMIN / STAFF ONLY
# ============================================================

@router.put(
    "/{customer_id}",
    response_model=CustomerResponse,
)
def update_customer(
    customer_id: int,
    customer_data: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "staff")
    ),
):

    # --------------------------------------------------------
    # 1. Find customer
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # 2. Get linked user
    # --------------------------------------------------------

    user = (
        db.query(User)
        .filter(User.id == customer.user_id)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Linked user not found.",
        )

    # --------------------------------------------------------
    # 3. Check phone uniqueness
    # --------------------------------------------------------

    if customer_data.phone is not None:

        existing_user = (
            db.query(User)
            .filter(
                User.phone == customer_data.phone,
                User.id != user.id,
            )
            .first()
        )

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this phone number already exists.",
            )

    # --------------------------------------------------------
    # 4. Check email uniqueness
    # --------------------------------------------------------

    if customer_data.email is not None:

        existing_email = (
            db.query(User)
            .filter(
                User.email == customer_data.email,
                User.id != user.id,
            )
            .first()
        )

        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists.",
            )

    # --------------------------------------------------------
    # 5. Update name
    # --------------------------------------------------------

    if customer_data.name is not None:

        customer.name = customer_data.name
        user.name = customer_data.name

    # --------------------------------------------------------
    # 6. Update phone
    # --------------------------------------------------------

    if customer_data.phone is not None:

        customer.phone = customer_data.phone
        user.phone = customer_data.phone

    # --------------------------------------------------------
    # 7. Update email
    # --------------------------------------------------------

    if customer_data.email is not None:

        customer.email = customer_data.email
        user.email = customer_data.email

    # --------------------------------------------------------
    # 8. Update password
    # --------------------------------------------------------

    if customer_data.password is not None:

        user.password_hash = hash_password(
            customer_data.password
        )

    # --------------------------------------------------------
    # 9. Update address
    # --------------------------------------------------------

    if customer_data.address is not None:

        address_data = customer_data.address

        address = (
            db.query(Address)
            .filter(Address.id == customer.address_id)
            .first()
        )

        if address is None:

            address = Address(
                country="India",
            )

            db.add(address)
            db.flush()

            customer.address_id = address.id

        if address_data.house_number is not None:
            address.house_number = address_data.house_number

        if address_data.street is not None:
            address.street = address_data.street

        if address_data.locality is not None:
            address.locality = address_data.locality

        if address_data.landmark is not None:
            address.landmark = address_data.landmark

        if address_data.city is not None:
            address.city = address_data.city

        if address_data.district is not None:
            address.district = address_data.district

        if address_data.state is not None:
            address.state = address_data.state

        if address_data.pincode is not None:
            address.pincode = address_data.pincode

        if address_data.country is not None:
            address.country = address_data.country

        # Rebuild normalized address

        address.normalized_address = ", ".join(
            filter(
                None,
                [
                    address.house_number,
                    address.street,
                    address.locality,
                    address.city,
                    address.district,
                    address.state,
                    address.pincode,
                    address.country,
                ],
            )
        )

    # --------------------------------------------------------
    # 10. Save changes
    # --------------------------------------------------------

    db.commit()
    db.refresh(customer)

    return customer


# ============================================================
# DELETE CUSTOMER
# ADMIN ONLY
# SOFT DELETE
# ============================================================

@router.delete(
    "/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin")
    ),
):

    # --------------------------------------------------------
    # 1. Find customer
    # --------------------------------------------------------

    customer = (
        db.query(Customer)
        .filter(Customer.id == customer_id)
        .first()
    )

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    # --------------------------------------------------------
    # 2. Already deleted
    # --------------------------------------------------------

    if not customer.is_active:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    # --------------------------------------------------------
    # 3. Soft delete
    # --------------------------------------------------------

    customer.is_active = False

    db.commit()

    return None
# ============================================================
# BULK ADD CUSTOMERS & STORE CUSTOMER DIRECTORY (FOR SHOPKEEPERS)
# ============================================================

from typing import Optional, List
from pydantic import BaseModel
from ..models.order import Order
from ..models.credit_account import CreditAccount

class BulkCustomerItem(BaseModel):
    name: str
    phone: str
    address: Optional[str] = None
    notes: Optional[str] = None

class BulkCustomerCreate(BaseModel):
    customers: List[BulkCustomerItem]

class ConnectedCustomerResponse(BaseModel):
    customer_id: int
    user_id: int
    name: str
    phone: str
    address: Optional[str] = None
    joined_at: Optional[str] = None


@router.post(
    "/shopkeeper/bulk",
    status_code=status.HTTP_201_CREATED,
)
def add_bulk_customers(
    payload: BulkCustomerCreate,
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
            detail="Active shop not found for this shopkeeper.",
        )

    added_count = 0
    connected_count = 0
    results = []

    for item in payload.customers:
        clean_name = item.name.strip()
        clean_phone = "".join(filter(str.isdigit, item.phone))
        if len(clean_phone) > 10 and clean_phone.startswith("91"):
            clean_phone = clean_phone[-10:]
        
        if len(clean_phone) < 10 or not clean_name:
            continue

        # 1. Find or create user
        user = db.query(User).filter(User.phone == clean_phone).first()
        if not user:
            user = User(
                name=clean_name,
                phone=clean_phone,
                role="customer",
                password_hash=hash_password("Pass123"),
                is_active=True,
            )
            db.add(user)
            db.flush()
            added_count += 1
        elif not user.name or user.name == "Customer":
            user.name = clean_name

        # 2. Find or create Customer profile
        customer = db.query(Customer).filter(Customer.user_id == user.id).first()
        if not customer:
            customer = Customer(
                user_id=user.id,
                name=clean_name,
                phone=clean_phone,
                is_active=True,
            )
            db.add(customer)
            db.flush()

        # 3. Link customer to ShopCustomer
        shop_customer = (
            db.query(ShopCustomer)
            .filter(
                ShopCustomer.shop_id == shop.id,
                ShopCustomer.customer_id == customer.id,
            )
            .first()
        )

        if not shop_customer:
            shop_customer = ShopCustomer(
                shop_id=shop.id,
                customer_id=customer.id,
                is_active=True,
            )
            db.add(shop_customer)
            connected_count += 1

        results.append({
            "customer_id": customer.id,
            "user_id": user.id,
            "name": user.name,
            "phone": user.phone,
        })

    db.commit()

    return {
        "success": True,
        "message": f"Successfully processed {len(results)} customers ({connected_count} newly connected to store).",
        "added_count": added_count,
        "connected_count": connected_count,
        "customers": results,
    }


@router.get(
    "/shopkeeper/list",
    response_model=List[ConnectedCustomerResponse],
)
def get_shopkeeper_customers(
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
            detail="Active shop not found for this shopkeeper.",
        )

    # 1. Customers linked via ShopCustomer
    linked_customers = (
        db.query(Customer, User, ShopCustomer.created_at)
        .join(User, Customer.user_id == User.id)
        .join(ShopCustomer, ShopCustomer.customer_id == Customer.id)
        .filter(ShopCustomer.shop_id == shop.id, ShopCustomer.is_active.is_(True))
        .all()
    )

    seen_customer_ids = set()
    customer_list = []

    for cust, u, joined_at in linked_customers:
        if cust.id not in seen_customer_ids:
            seen_customer_ids.add(cust.id)
            customer_list.append({
                "customer_id": cust.id,
                "user_id": u.id,
                "name": u.name or cust.name or "Valued Customer",
                "phone": u.phone or "",
                "joined_at": joined_at.isoformat() if joined_at else None,
            })

    # 2. Customers who placed Orders with this shop
    order_customers = (
        db.query(Customer, User, Order.created_at)
        .join(User, Customer.user_id == User.id)
        .join(Order, Order.customer_id == Customer.id)
        .filter(Order.shop_id == shop.id)
        .all()
    )

    for cust, u, order_date in order_customers:
        if cust.id not in seen_customer_ids:
            seen_customer_ids.add(cust.id)
            customer_list.append({
                "customer_id": cust.id,
                "user_id": u.id,
                "name": u.name or cust.name or "Valued Customer",
                "phone": u.phone or "",
                "joined_at": order_date.isoformat() if order_date else None,
            })

    # 3. Customers who have Credit Account with this shop
    credit_customers = (
        db.query(Customer, User, CreditAccount.created_at)
        .join(User, Customer.user_id == User.id)
        .join(CreditAccount, CreditAccount.customer_id == Customer.id)
        .filter(CreditAccount.shop_id == shop.id)
        .all()
    )

    for cust, u, cr_date in credit_customers:
        if cust.id not in seen_customer_ids:
            seen_customer_ids.add(cust.id)
            customer_list.append({
                "customer_id": cust.id,
                "user_id": u.id,
                "name": u.name or cust.name or "Valued Customer",
                "phone": u.phone or "",
                "joined_at": cr_date.isoformat() if cr_date else None,
            })

    return customer_list
