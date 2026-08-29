from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.inventory import Inventory
from ..models.product import Product
from ..models.shop import Shop
from ..models.user import User

from ..schemas.inventory import (
    InventoryCreate,
    InventoryUpdate,
    InventoryResponse,
)

from ..core.roles import require_role


router = APIRouter(
    prefix="/api/v1/inventory",
    tags=["Inventory"],
)


# ============================================================
# GET MY INVENTORY
# ============================================================

@router.get(
    "",
    response_model=list[InventoryResponse],
)
def get_inventory(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("shopkeeper", "admin")
    ),
):

    shop = (
        db.query(Shop)
        .filter(
            Shop.owner_user_id == current_user.id,
            Shop.is_active.is_(True),
        )
        .first()
    )

    if shop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found.",
        )

    inventory = (
        db.query(Inventory)
        .filter(
            Inventory.shop_id == shop.id,
            Inventory.is_active.is_(True),
        )
        .order_by(Inventory.id.desc())
        .all()
    )

    return inventory


# ============================================================
# ADD PRODUCT TO INVENTORY
# ============================================================

@router.post(
    "",
    response_model=InventoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_inventory(
    inventory_data: InventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("shopkeeper", "admin")
    ),
):

    shop = (
        db.query(Shop)
        .filter(
            Shop.owner_user_id == current_user.id,
            Shop.is_active.is_(True),
        )
        .first()
    )

    if shop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found.",
        )

    product = (
        db.query(Product)
        .filter(
            Product.id == inventory_data.product_id,
            Product.is_active.is_(True),
        )
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    if product.shop_id != shop.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This product does not belong to your shop.",
        )

    existing_inventory = (
        db.query(Inventory)
        .filter(
            Inventory.shop_id == shop.id,
            Inventory.product_id == product.id,
        )
        .first()
    )

    if existing_inventory:

        existing_inventory.is_active = True

        existing_inventory.stock_quantity = (
            inventory_data.stock_quantity
        )

        db.commit()
        db.refresh(existing_inventory)

        return existing_inventory

    inventory = Inventory(
        shop_id=shop.id,
        product_id=product.id,
        stock_quantity=inventory_data.stock_quantity,
        is_active=True,
    )

    db.add(inventory)
    db.commit()
    db.refresh(inventory)

    return inventory


# ============================================================
# UPDATE STOCK
# ============================================================

@router.put(
    "/{inventory_id}",
    response_model=InventoryResponse,
)
def update_inventory(
    inventory_id: int,
    inventory_data: InventoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("shopkeeper", "admin")
    ),
):

    shop = (
        db.query(Shop)
        .filter(
            Shop.owner_user_id == current_user.id,
            Shop.is_active.is_(True),
        )
        .first()
    )

    if shop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found.",
        )

    inventory = (
        db.query(Inventory)
        .filter(
            Inventory.id == inventory_id,
            Inventory.shop_id == shop.id,
            Inventory.is_active.is_(True),
        )
        .first()
    )

    if inventory is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found.",
        )

    inventory.stock_quantity = (
        inventory_data.stock_quantity
    )

    db.commit()
    db.refresh(inventory)

    return inventory


# ============================================================
# DELETE INVENTORY ITEM
# ============================================================

@router.delete(
    "/{inventory_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_inventory(
    inventory_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("shopkeeper", "admin")
    ),
):

    shop = (
        db.query(Shop)
        .filter(
            Shop.owner_user_id == current_user.id,
            Shop.is_active.is_(True),
        )
        .first()
    )

    if shop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found.",
        )

    inventory = (
        db.query(Inventory)
        .filter(
            Inventory.id == inventory_id,
            Inventory.shop_id == shop.id,
            Inventory.is_active.is_(True),
        )
        .first()
    )

    if inventory is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found.",
        )

    inventory.is_active = False

    db.commit()

    return None