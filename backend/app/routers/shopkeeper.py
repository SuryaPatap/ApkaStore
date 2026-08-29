from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.shop import Shop
from ..schemas.shopkeeper import (
    ShopkeeperCreate,
    ShopkeeperResponse,
)
from ..core.security import hash_password


router = APIRouter(
    prefix="/api/v1/shopkeepers",
    tags=["Shopkeepers"],
)


@router.post(
    "/register",
    response_model=ShopkeeperResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_shopkeeper(
    data: ShopkeeperCreate,
    db: Session = Depends(get_db),
):

    # Check phone
    existing_phone = (
        db.query(User)
        .filter(User.phone == data.phone)
        .first()
    )

    if existing_phone:
        raise HTTPException(
            status_code=400,
            detail="A user with this phone number already exists.",
        )

    # Check email
    if data.email:
        existing_email = (
            db.query(User)
            .filter(User.email == data.email)
            .first()
        )

        if existing_email:
            raise HTTPException(
                status_code=400,
                detail="A user with this email already exists.",
            )

    try:
        # Create shopkeeper
        user = User(
            name=data.name,
            phone=data.phone,
            email=data.email,
            password_hash=hash_password(data.password),
            role="shopkeeper",
            is_active=True,
        )

        db.add(user)
        db.flush()

        # Create shop automatically
        shop = Shop(
            owner_user_id=user.id,
            shop_name=data.shop_name,
            shop_phone=data.shop_phone,
            email=data.email,
            shop_category=data.shop_category,
            gst_number=data.gst_number,
            is_active=True,
        )

        db.add(shop)
        db.commit()

        db.refresh(user)
        db.refresh(shop)

        return ShopkeeperResponse(
            user_id=user.id,
            shop_id=shop.id,
            name=user.name,
            phone=user.phone,
            email=user.email,
            shop_name=shop.shop_name,
            shop_phone=shop.shop_phone,
            shop_category=shop.shop_category,
            is_active=user.is_active,
        )

    except Exception:
        db.rollback()
        raise