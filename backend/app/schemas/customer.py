from pydantic import BaseModel, EmailStr, Field, ConfigDict


class AddressCreate(BaseModel):
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


class AddressUpdate(BaseModel):
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


class AddressResponse(BaseModel):
    id: int
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
    normalized_address: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CustomerCreate(BaseModel):
    name: str
    phone: str
    email: EmailStr | None = None

    password: str = Field(
        min_length=6,
        max_length=100
    )

    address: AddressCreate


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None

    password: str | None = Field(
        default=None,
        min_length=6,
        max_length=100
    )

    address: AddressUpdate | None = None


class CustomerResponse(BaseModel):
    id: int
    user_id: int
    name: str
    phone: str
    email: EmailStr | None = None
    address_id: int | None = None
    address: AddressResponse | None = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)