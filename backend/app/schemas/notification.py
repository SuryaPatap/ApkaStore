from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):

    id: int

    user_id: int

    order_id: int | None = None

    substitution_id: int | None = None

    type: str

    title: str

    message: str

    is_read: bool

    created_at: datetime

    class Config:
        from_attributes = True