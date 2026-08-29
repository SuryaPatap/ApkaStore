from pydantic import BaseModel, EmailStr, Field


# ============================================================
# SHOPKEEPER REGISTRATION
# ============================================================

class ShopkeeperRegisterRequest(BaseModel):

    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
    )

    phone: str = Field(
        ...,
        min_length=10,
        max_length=15,
    )

    email: EmailStr

    password: str = Field(
        ...,
        min_length=6,
        max_length=100,
    )


# ============================================================
# LOGIN REQUEST
# ============================================================

class LoginRequest(BaseModel):

    email: EmailStr

    password: str = Field(
        min_length=6,
        max_length=100,
    )

    role: str | None = Field(
        default=None,
        description="Optional expected role: 'customer' or 'shopkeeper'",
    )


# ============================================================
# TOKEN RESPONSE
# ============================================================

class TokenResponse(BaseModel):

    access_token: str

    token_type: str = "bearer"

    role: str | None = None

    user_id: int | None = None

    name: str | None = None

    phone: str | None = None