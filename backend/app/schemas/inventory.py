from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# ADD INVENTORY
# ============================================================

class InventoryCreate(BaseModel):
    product_id: int = Field(gt=0)
    stock_quantity: int = Field(ge=0)


# ============================================================
# UPDATE INVENTORY
# ============================================================

class InventoryUpdate(BaseModel):
    stock_quantity: int = Field(ge=0)


# ============================================================
# INVENTORY RESPONSE
# ============================================================

class InventoryResponse(BaseModel):
    id: int
    shop_id: int
    product_id: int
    stock_quantity: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )