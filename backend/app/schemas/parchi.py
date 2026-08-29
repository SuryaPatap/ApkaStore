from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# START PARCHI REQUEST
# ============================================================

class ParchiStartRequest(BaseModel):
    shop_id: int | None = None


# ============================================================
# PARCHI ORDER ITEM (inside an ORDER_REQUEST message)
# ============================================================

class ParchiOrderItem(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class ParchiCustomItem(BaseModel):
    name: str
    quantity: str = "1"


# ============================================================
# SEND MESSAGE
# ============================================================

class ParchiMessageCreate(BaseModel):
    content: str = Field(default="", max_length=3000)
    message_type: str = "TEXT"         # TEXT | PARCHI_LIST | ORDER_REQUEST
    items: list[ParchiOrderItem] = []   # catalog products
    parchi_items: list[ParchiCustomItem] = []  # freeform grocery items (e.g. Milk 2 pkt)
    payment_method: str = "COD"        # COD | UDHAR_KHATA
    customer_notes: str | None = None


# ============================================================
# MESSAGE RESPONSE
# ============================================================

class ParchiMessageResponse(BaseModel):
    id: int
    parchi_id: int
    sender_role: str
    message_type: str
    content: str
    order_id: int | None = None
    product_snapshot: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# SHOPKEEPER RESPOND TO ORDER_REQUEST
# ============================================================

class ParchiOrderResponse(BaseModel):
    action: str = Field(
        description="CONFIRM or DECLINE"
    )
    reply_note: str | None = None


# ============================================================
# PARCHI THREAD RESPONSE
# ============================================================

class ParchiResponse(BaseModel):
    id: int
    customer_id: int
    shop_id: int
    is_active: bool
    created_at: datetime
    last_message_at: datetime | None = None

    # enriched
    shop_name: str | None = None
    shop_phone: str | None = None
    shop_address: str | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_address: str | None = None
    last_message_preview: str | None = None
    message_count: int = 0
    order_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# FULL PARCHI (thread + messages)
# ============================================================

class ParchiDetailResponse(BaseModel):
    parchi: ParchiResponse
    messages: list[ParchiMessageResponse]

    model_config = ConfigDict(from_attributes=True)

