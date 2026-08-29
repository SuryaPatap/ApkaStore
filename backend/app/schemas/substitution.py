from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class SubstitutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_item_id: int

    original_product_id: int
    suggested_product_id: int

    original_product_name: str | None = None
    suggested_product_name: str | None = None

    quantity: int

    original_price: Decimal | None = None
    suggested_price: Decimal | None = None

    status: str

    sent_at: datetime | None = None
    responded_at: datetime | None = None