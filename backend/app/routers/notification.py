from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.notification import Notification
from ..schemas.notification import NotificationResponse
from ..core.dependencies import get_current_user


router = APIRouter(
    prefix="/api/v1/notifications",
    tags=["Notifications"],
)


# ============================================================
# GET MY NOTIFICATIONS
# ============================================================

@router.get(
    "",
    response_model=list[NotificationResponse],
)
def get_my_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    query = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
        )
    )

    if unread_only:

        query = query.filter(
            Notification.is_read.is_(False),
        )

    notifications = (
        query
        .order_by(Notification.id.desc())
        .limit(100)
        .all()
    )

    return notifications


# ============================================================
# GET UNREAD COUNT
# ============================================================

@router.get(
    "/unread-count",
)
def get_unread_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .count()
    )

    return {
        "unread_count": count,
    }


# ============================================================
# MARK ONE NOTIFICATION AS READ
# ============================================================

@router.patch(
    "/{notification_id}/read",
)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )

    if notification is None:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )

    notification.is_read = True

    db.commit()
    db.refresh(notification)

    return {
        "message": "Notification marked as read.",
        "notification_id": notification.id,
        "is_read": notification.is_read,
    }


# ============================================================
# MARK ALL AS READ
# ============================================================

@router.patch(
    "/read-all",
)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    updated = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .update(
            {
                Notification.is_read: True,
            },
            synchronize_session=False,
        )
    )

    db.commit()

    return {
        "message": "All notifications marked as read.",
        "updated_count": updated,
    }