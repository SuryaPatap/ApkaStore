from pydantic import BaseModel, EmailStr, Field, ConfigDict
from .customer import AddressResponse


class ShopAddressCreate(BaseModel):
    flat_number: str | None = None
    building_number: str | None = None
    sector: str | None = None
    house_number: str | None = None
    street: str | None = None
    locality: str | None = None
    landmark: str | None = None
    city: str
    district: str | None = None
    state: str
    pincode: str
    country: str = "India"
    latitude: float | None = None
    longitude: float | None = None


class ShopAddressUpdate(BaseModel):
    flat_number: str | None = None
    building_number: str | None = None
    sector: str | None = None
    house_number: str | None = None
    street: str | None = None
    locality: str | None = None
    landmark: str | None = None
    city: str | None = None
    district: str | None = None
    state: str | None = None
    pincode: str | None = None
    country: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class ShopCreate(BaseModel):
    shop_name: str = Field(
        ...,
        min_length=1,
        max_length=150,
    )
    address: ShopAddressCreate
    shop_category: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )
    gst_number: str | None = Field(
        default=None,
        max_length=30,
    )
    upi_id: str | None = Field(
        default=None,
        max_length=100,
    )


class ShopUpdate(BaseModel):
    shop_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
    )
    address: ShopAddressUpdate | None = None
    shop_category: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    gst_number: str | None = Field(
        default=None,
        max_length=30,
    )
    upi_id: str | None = Field(
        default=None,
        max_length=100,
    )


class ShopResponse(BaseModel):
    id: int
    owner_user_id: int
    owner_name: str | None = None
    shop_name: str
    shop_phone: str | None = None
    email: EmailStr | None = None
    address_id: int | None = None
    address: AddressResponse | None = None
    shop_category: str
    gst_number: str | None = None
    upi_id: str | None = None
    is_active: bool
    distance_km: float | None = None

    model_config = ConfigDict(from_attributes=True)


class NearbyShopResponse(BaseModel):
    id: int
    owner_user_id: int
    owner_name: str | None = None
    shop_name: str
    shop_phone: str | None = None
    email: EmailStr | None = None
    address: AddressResponse | None = None
    shop_category: str
    gst_number: str | None = None
    upi_id: str | None = None
    is_active: bool
    distance_km: float
    is_selected: bool = False
    has_khata: bool = False
    credit_limit: float | None = None
    outstanding_amount: float | None = None

    model_config = ConfigDict(from_attributes=True)