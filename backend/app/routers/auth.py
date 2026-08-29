from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User

from ..schemas.auth import (
    LoginRequest,
    TokenResponse,
    ShopkeeperRegisterRequest,
)

from ..core.security import (
    verify_password,
    create_access_token,
    hash_password,
)


router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"],
)


# ============================================================
# SHOPKEEPER REGISTRATION
# ============================================================

@router.post(
    "/register/shopkeeper",
    status_code=status.HTTP_201_CREATED,
)
def register_shopkeeper(
    register_data: ShopkeeperRegisterRequest,
    db: Session = Depends(get_db),
):

    # --------------------------------------------------------
    # Check phone
    # --------------------------------------------------------

    existing_phone = (
        db.query(User)
        .filter(
            User.phone == register_data.phone
        )
        .first()
    )

    if existing_phone:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this phone number already exists.",
        )

    # --------------------------------------------------------
    # Check email
    # --------------------------------------------------------

    existing_email = (
        db.query(User)
        .filter(
            User.email == register_data.email
        )
        .first()
    )

    if existing_email:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )

    # --------------------------------------------------------
    # Create shopkeeper
    # --------------------------------------------------------

    user = User(
        name=register_data.name,
        phone=register_data.phone,
        email=register_data.email,
        password_hash=hash_password(
            register_data.password
        ),
        role="shopkeeper",
        is_active=True,
    )

    db.add(user)

    try:

        db.commit()
        db.refresh(user)

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create shopkeeper account.",
        )

    return {
        "message": "Shopkeeper registered successfully.",
        "user_id": user.id,
        "name": user.name,
        "phone": user.phone,
        "email": user.email,
        "role": user.role,
    }


# ============================================================
# LOGIN
# ============================================================

@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):

    user = (
        db.query(User)
        .filter(
            User.email == login_data.email
        )
        .first()
    )

    if user is None:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    if not verify_password(
        login_data.password,
        user.password_hash,
    ):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # --------------------------------------------------------
    # STRICT ROLE VERIFICATION
    # --------------------------------------------------------
    if login_data.role:
        expected_role = login_data.role.strip().lower()
        actual_role = (user.role or "").strip().lower()
        if expected_role != actual_role:
            actual_title = "Customer" if actual_role == "customer" else "Shopkeeper"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"This account is registered as a {actual_title}. Please sign in under the {actual_title} tab.",
            )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role": user.role,
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role.upper(),
        "user_id": user.id,
        "name": user.name,
        "phone": user.phone,
    }