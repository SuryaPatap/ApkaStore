from sqlalchemy.orm import Session

from ..models.notification import Notification


def create_notification(
    db: Session,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    order_id: int | None = None,
    substitution_id: int | None = None,
) -> Notification:
    """
    Create an in-app notification for a user.

    The caller is responsible for committing the transaction.
    """

    notification = Notification(
        user_id=user_id,
        order_id=order_id,
        substitution_id=substitution_id,
        type=notification_type,
        title=title,
        message=message,
    )

    db.add(notification)

    return notification