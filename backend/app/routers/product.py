from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db

from ..models.product import Product
from ..models.inventory import Inventory
from ..models.shop import Shop
from ..models.user import User

from ..schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    InventoryUpdate,
)

from ..core.dependencies import get_current_user
from ..core.roles import require_role


router = APIRouter(
    prefix="/api/v1/products",
    tags=["Products"],
)


# ============================================================
# HELPER: GET SHOP OWNED BY CURRENT USER
# ============================================================

def get_shop_for_user(
    current_user: User,
    db: Session,
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
            detail="Shop not found for this user.",
        )

    return shop


# ============================================================
# HELPER: BUILD PRODUCT RESPONSE
# ============================================================

def product_response(
    product: Product,
    inventory: Inventory | None,
):
    return {
        "id": product.id,
        "shop_id": product.shop_id,
        "name": product.name,
        "category": product.category,
        "unit": product.unit,
        "price": product.price,
        "stock_quantity": (
            inventory.stock_quantity
            if inventory
            else 0
        ),
        "is_active": product.is_active,
    }


# ============================================================
# CREATE PRODUCT
# ============================================================

@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("shopkeeper", "admin")
    ),
):

    shop = get_shop_for_user(
        current_user,
        db,
    )

    # --------------------------------------------------------
    # Prevent duplicate active product
    # --------------------------------------------------------

    existing_product = (
        db.query(Product)
        .filter(
            Product.shop_id == shop.id,
            Product.name.ilike(product_data.name),
            Product.is_active.is_(True),
        )
        .first()
    )

    if existing_product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This product already exists in your shop.",
        )

    # --------------------------------------------------------
    # Create product
    # --------------------------------------------------------

    product = Product(
        shop_id=shop.id,
        name=product_data.name,
        category=product_data.category,
        unit=product_data.unit,
        price=product_data.price,
        is_active=True,
    )

    db.add(product)
    db.flush()

    # --------------------------------------------------------
    # Create inventory
    # --------------------------------------------------------

    inventory = Inventory(
        shop_id=shop.id,
        product_id=product.id,
        stock_quantity=product_data.stock_quantity,
        is_active=True,
    )

    db.add(inventory)

    db.commit()

    db.refresh(product)
    db.refresh(inventory)

    return product_response(
        product,
        inventory,
    )


# ============================================================
# GET MY INVENTORY / PRODUCTS
# ============================================================

@router.get(
    "/inventory",
    response_model=list[ProductResponse],
)
def get_my_inventory(
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("shopkeeper", "admin")
    ),
):

    shop = get_shop_for_user(
        current_user,
        db,
    )

    query = (
        db.query(Product)
        .filter(
            Product.shop_id == shop.id,
            Product.is_active.is_(True),
        )
    )

    # --------------------------------------------------------
    # Search
    # --------------------------------------------------------

    if search:

        search_value = f"%{search}%"

        query = query.filter(
            (Product.name.ilike(search_value))
            |
            (Product.category.ilike(search_value))
        )

    products = (
        query
        .order_by(Product.name.asc())
        .all()
    )

    result = []

    for product in products:

        inventory = (
            db.query(Inventory)
            .filter(
                Inventory.shop_id == shop.id,
                Inventory.product_id == product.id,
                Inventory.is_active.is_(True),
            )
            .first()
        )

        result.append(
            product_response(
                product,
                inventory,
            )
        )

    return result


# ============================================================
# GET PRODUCTS (CATALOG BY SHOP_ID / CATEGORY / SEARCH)
# PUBLIC / CUSTOMER
# ============================================================

@router.get(
    "",
    response_model=list[ProductResponse],
)
def get_products(
    shop_id: int | None = None,
    category: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Product).filter(Product.is_active.is_(True))

    if shop_id is not None:
        query = query.filter(Product.shop_id == shop_id)

    if category and category.lower() != "all":
        query = query.filter(Product.category.ilike(f"%{category}%"))

    if search:
        search_val = f"%{search}%"
        query = query.filter(
            (Product.name.ilike(search_val))
            | (Product.category.ilike(search_val))
        )

    products = query.order_by(Product.name.asc()).all()
    result = []

    for product in products:
        inventory = (
            db.query(Inventory)
            .filter(
                Inventory.shop_id == product.shop_id,
                Inventory.product_id == product.id,
                Inventory.is_active.is_(True),
            )
            .first()
        )
        result.append(product_response(product, inventory))

    return result


# ============================================================
# GET PRODUCT
# ============================================================

@router.get(
    "/{product_id}",
    response_model=ProductResponse,
)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    product = (
        db.query(Product)
        .filter(
            Product.id == product_id,
            Product.is_active.is_(True),
        )
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    inventory = (
        db.query(Inventory)
        .filter(
            Inventory.product_id == product.id,
            Inventory.shop_id == product.shop_id,
            Inventory.is_active.is_(True),
        )
        .first()
    )

    return product_response(
        product,
        inventory,
    )


# ============================================================
# UPDATE PRODUCT
# ============================================================

@router.put(
    "/{product_id}",
    response_model=ProductResponse,
)
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("shopkeeper", "admin")
    ),
):

    product = (
        db.query(Product)
        .filter(
            Product.id == product_id,
            Product.is_active.is_(True),
        )
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    # --------------------------------------------------------
    # Shopkeeper ownership
    # --------------------------------------------------------

    if current_user.role == "shopkeeper":

        shop = (
            db.query(Shop)
            .filter(
                Shop.id == product.shop_id,
                Shop.owner_user_id == current_user.id,
                Shop.is_active.is_(True),
            )
            .first()
        )

        if shop is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update this product.",
            )

    # --------------------------------------------------------
    # Update fields
    # --------------------------------------------------------

    if product_data.name is not None:
        product.name = product_data.name

    if product_data.category is not None:
        product.category = product_data.category

    if product_data.unit is not None:
        product.unit = product_data.unit

    if product_data.price is not None:
        product.price = product_data.price

    if product_data.is_active is not None:
        product.is_active = product_data.is_active

    db.commit()
    db.refresh(product)

    inventory = (
        db.query(Inventory)
        .filter(
            Inventory.product_id == product.id,
            Inventory.shop_id == product.shop_id,
            Inventory.is_active.is_(True),
        )
        .first()
    )

    return product_response(
        product,
        inventory,
    )


# ============================================================
# UPDATE INVENTORY
# ============================================================

@router.patch(
    "/{product_id}/inventory",
    response_model=ProductResponse,
)
def update_inventory(
    product_id: int,
    inventory_data: InventoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("shopkeeper", "admin")
    ),
):

    product = (
        db.query(Product)
        .filter(
            Product.id == product_id,
            Product.is_active.is_(True),
        )
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    # --------------------------------------------------------
    # Shopkeeper ownership
    # --------------------------------------------------------

    if current_user.role == "shopkeeper":

        shop = (
            db.query(Shop)
            .filter(
                Shop.id == product.shop_id,
                Shop.owner_user_id == current_user.id,
                Shop.is_active.is_(True),
            )
            .first()
        )

        if shop is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update this inventory.",
            )

    # --------------------------------------------------------
    # Find inventory
    # --------------------------------------------------------

    inventory = (
        db.query(Inventory)
        .filter(
            Inventory.product_id == product.id,
            Inventory.shop_id == product.shop_id,
        )
        .first()
    )

    # --------------------------------------------------------
    # Create if missing
    # --------------------------------------------------------

    if inventory is None:

        inventory = Inventory(
            shop_id=product.shop_id,
            product_id=product.id,
            stock_quantity=inventory_data.stock_quantity,
            is_active=True,
        )

        db.add(inventory)

    else:

        inventory.stock_quantity = (
            inventory_data.stock_quantity
        )

        inventory.is_active = True

    db.commit()

    db.refresh(product)
    db.refresh(inventory)

    return product_response(
        product,
        inventory,
    )