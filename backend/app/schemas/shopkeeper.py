from pydantic import BaseModel, EmailStr, Field


class ShopkeeperCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=10, max_length=20)
    email: EmailStr | None = None
    password: str = Field(min_length=8)

    shop_name: str = Field(min_length=2, max_length=150)
    shop_phone: str = Field(min_length=10, max_length=20)
    shop_category: str | None = None
    gst_number: str | None = None


class ShopkeeperResponse(BaseModel):
    user_id: int
    shop_id: int
    name: str
    phone: str
    email: str | None

    shop_name: str
    shop_phone: str
    shop_category: str | None

    is_active: bool