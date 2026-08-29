from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.shop import Shop
from ..models.user import User
from ..models.customer import Customer
from ..models.shop_customer import ShopCustomer
from ..models.credit_account import CreditAccount
from ..models.address import Address

from ..schemas.shop import (
    ShopCreate,
    ShopUpdate,
    ShopResponse,
    NearbyShopResponse,
)

from ..core.dependencies import get_current_user
from ..core.roles import require_role
from ..core.geo import (
    calculate_distance_km,
    estimate_coordinates_from_address,
    calculate_address_distance_km,
)


router = APIRouter(
    prefix="/api/v1/shops",
    tags=["Shops"],
)


# ============================================================
# CREATE SHOP
# SHOPKEEPER ONLY
# ============================================================

@router.post(
    "",
    response_model=ShopResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shop(
    shop_data: ShopCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("shopkeeper")
    ),
):
    # 1. Check whether shopkeeper already owns an active shop
    existing_shop = (
        db.query(Shop)
        .filter(
            Shop.owner_user_id == current_user.id,
            Shop.is_active == True,
        )
        .first()
    )

    if existing_shop:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active shop.",
        )

    # 2. Check GST uniqueness
    if shop_data.gst_number:
        existing_gst = (
            db.query(Shop)
            .filter(
                Shop.gst_number == shop_data.gst_number
            )
            .first()
        )
        if existing_gst:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A shop with this GST number already exists.",
            )

    # 3. Get address data and estimate lat/lng if not provided
    address_data = shop_data.address
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

    # 4. Create shop
    shop = Shop(
        owner_user_id=current_user.id,
        shop_name=shop_data.shop_name,
        shop_phone=current_user.phone,
        email=current_user.email,
        address_id=address.id,
        shop_category=shop_data.shop_category,
        gst_number=shop_data.gst_number,
        upi_id=shop_data.upi_id,
        is_active=True,
    )

    db.add(shop)

    try:
        db.commit()
        db.refresh(shop)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create shop.",
        )

    return shop


# ============================================================
# GET NEARBY SHOPS (UNDER 5KM)
# PUBLIC / CUSTOMER
# ============================================================

@router.get(
    "/nearby",
    response_model=list[NearbyShopResponse],
)
def get_nearby_shops(
    max_distance_km: float = Query(default=2.0, description="Max distance in kilometers (default: 2km)"),
    latitude: float | None = Query(default=None),
    longitude: float | None = Query(default=None),
    pincode: str | None = Query(default=None),
    city: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    """
    Find and return only active shops located within max_distance_km (default 2km)
    from customer's address or specified coordinates.
    """
    customer_addr = None
    customer_id = None
    selected_shop_id = None

    # If user is authenticated as customer, resolve their saved address & selected shop
    if current_user and current_user.role == "customer":
        customer = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if customer:
            customer_id = customer.id
            if customer.address_id:
                customer_addr = db.query(Address).filter(Address.id == customer.address_id).first()

            # Find active linked shop
            active_link = db.query(ShopCustomer).filter(
                ShopCustomer.customer_id == customer.id,
                ShopCustomer.is_active == True,
            ).first()
            if active_link:
                selected_shop_id = active_link.shop_id

    # Fallback to coordinates if query parameters were passed
    if latitude is not None and longitude is not None:
        target_lat, target_lon = latitude, longitude
    elif customer_addr and customer_addr.latitude is not None and customer_addr.longitude is not None:
        target_lat, target_lon = customer_addr.latitude, customer_addr.longitude
    else:
        target_pincode = pincode or (customer_addr.pincode if customer_addr else None)
        target_city = city or (customer_addr.city if customer_addr else None)
        target_lat, target_lon = estimate_coordinates_from_address(target_pincode, target_city)

    # Query all active shops
    all_shops = db.query(Shop).filter(Shop.is_active == True).all()

    nearby_results = []
    for s in all_shops:
        shop_addr = db.query(Address).filter(Address.id == s.address_id).first() if s.address_id else None
        
        if shop_addr and shop_addr.latitude is not None and shop_addr.longitude is not None:
            dist = calculate_distance_km(target_lat, target_lon, shop_addr.latitude, shop_addr.longitude)
        elif shop_addr and customer_addr:
            dist = calculate_address_distance_km(customer_addr, shop_addr)
        else:
            s_lat, s_lon = estimate_coordinates_from_address(
                shop_addr.pincode if shop_addr else None,
                shop_addr.city if shop_addr else None,
            )
            dist = calculate_distance_km(target_lat, target_lon, s_lat, s_lon)

        # Check if customer has an active Udhar Khata with this shop
        has_khata = False
        limit_val = None
        outstanding_val = None
        if customer_id:
            acc = db.query(CreditAccount).filter(
                CreditAccount.customer_id == customer_id,
                CreditAccount.shop_id == s.id,
                CreditAccount.status == "ACTIVE",
            ).first()
            if acc:
                has_khata = True
                limit_val = float(acc.credit_limit)
                outstanding_val = float(acc.outstanding_amount)

        # Resolve owner contact
        owner = db.query(User).filter(User.id == s.owner_user_id).first() if s.owner_user_id else None
        owner_name = owner.name if owner else None
        shop_phone = s.shop_phone or (owner.phone if owner else None)

        # Filter strictly under max_distance_km
        if dist <= max_distance_km:
            is_sel = (s.id == selected_shop_id)
            nearby_results.append({
                "id": s.id,
                "owner_user_id": s.owner_user_id,
                "owner_name": owner_name,
                "shop_name": s.shop_name,
                "shop_phone": shop_phone,
                "email": s.email,
                "address": shop_addr,
                "shop_category": s.shop_category,
                "gst_number": s.gst_number,
                "upi_id": s.upi_id,
                "is_active": s.is_active,
                "distance_km": dist,
                "is_selected": is_sel,
                "has_khata": has_khata,
                "credit_limit": limit_val,
                "outstanding_amount": outstanding_val,
            })

    # Sort nearest first
    nearby_results.sort(key=lambda x: x["distance_km"])
    return nearby_results


# ============================================================
# GET ALL SHOPS
# PUBLIC
# ============================================================

@router.get(
    "",
    response_model=list[ShopResponse],
)
def get_all_shops(
    db: Session = Depends(get_db),
):
    shops = db.query(Shop).filter(Shop.is_active == True).all()
    return shops


# ============================================================
# GET MY SHOP
# SHOPKEEPER ONLY
# ============================================================

@router.get(
    "/my-shop",
    response_model=ShopResponse,
)
def get_my_shop(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("shopkeeper")
    ),
):
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
# GET SHOP BY ID
# PUBLIC / CUSTOMER
# ============================================================

@router.get(
    "/{shop_id}",
    response_model=ShopResponse,
)
def get_shop_by_id(
    shop_id: int,
    db: Session = Depends(get_db),
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
# UPDATE MY SHOP
# SHOPKEEPER ONLY
# ============================================================

@router.put(
    "/my-shop",
    response_model=ShopResponse,
)
def update_my_shop(
    shop_data: ShopUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("shopkeeper")
    ),
):
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

    if shop_data.gst_number is not None:
        existing_gst = (
            db.query(Shop)
            .filter(
                Shop.gst_number == shop_data.gst_number,
                Shop.id != shop.id,
            )
            .first()
        )
        if existing_gst:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A shop with this GST number already exists.",
            )
        shop.gst_number = shop_data.gst_number

    if shop_data.shop_name is not None:
        shop.shop_name = shop_data.shop_name

    if shop_data.shop_category is not None:
        shop.shop_category = shop_data.shop_category

    if shop_data.upi_id is not None:
        shop.upi_id = shop_data.upi_id

    if shop_data.address is not None:
        address_data = shop_data.address
        address = (
            db.query(Address)
            .filter(Address.id == shop.address_id)
            .first()
        )

        if address is None:
            address = Address(country="India")
            db.add(address)
            db.flush()
            shop.address_id = address.id

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
        if address_data.latitude is not None:
            address.latitude = address_data.latitude
        if address_data.longitude is not None:
            address.longitude = address_data.longitude

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

    shop.shop_phone = current_user.phone
    shop.email = current_user.email

    db.commit()
    db.refresh(shop)

    return shop


# ============================================================
# DELETE MY SHOP
# SHOPKEEPER ONLY
# ============================================================

@router.delete(
    "/my-shop",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_my_shop(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("shopkeeper")
    ),
):
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

    shop.is_active = False
    db.commit()
    return None