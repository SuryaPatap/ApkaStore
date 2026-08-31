import pytest
from fastapi.testclient import TestClient
from decimal import Decimal
from datetime import datetime, timezone
import random
from app.main import app
from app.database import SessionLocal, engine
from app.base import Base
from app.models.user import User
from app.models.shop import Shop
from app.models.product import Product
from app.models.inventory import Inventory
from app.core.security import create_access_token, hash_password

client = TestClient(app)

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()

def test_purchase_invoice_bulk_product_add_and_restock(db_session):
    unique_suffix = int(datetime.now(timezone.utc).timestamp()) + random.randint(1000, 9999)
    phone_num = f"98{random.randint(10000000, 99999999)}"

    # 1. Setup Shopkeeper & Shop
    shop_user = User(
        email=f"purchase_shop_{unique_suffix}@testmail.com",
        name="Purchase Store Owner",
        phone=phone_num,
        role="shopkeeper",
        password_hash=hash_password("Pass123"),
        is_active=True,
    )
    db_session.add(shop_user)
    db_session.commit()

    shop = Shop(
        owner_user_id=shop_user.id,
        shop_name="Purchase Test Store",
        shop_phone=phone_num,
        shop_category="General",
        is_active=True,
    )
    db_session.add(shop)
    db_session.commit()

    # 2. Add an existing product with 10 units in stock
    existing_prod = Product(
        shop_id=shop.id,
        name="Tata Salt 1kg",
        category="Groceries",
        unit="1 kg",
        price=Decimal("25.00"),
        is_active=True,
    )
    db_session.add(existing_prod)
    db_session.commit()

    inv = Inventory(
        shop_id=shop.id,
        product_id=existing_prod.id,
        stock_quantity=10,
        is_active=True,
    )
    db_session.add(inv)
    db_session.commit()

    token = create_access_token({"sub": str(shop_user.id), "role": "shopkeeper"})
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Post a Supplier Purchase Invoice with:
    #   - Item 1: "Tata Salt 1kg" (existing product -> restock 20 units -> new total 30 units)
    #   - Item 2: "Fortune Sunflower Oil 1L" (new product -> create & add 50 units)
    payload = {
        "supplier_name": "Metro Cash & Carry Wholesalers",
        "supplier_phone": "9876543210",
        "invoice_number": f"SUP-INV-{unique_suffix}",
        "notes": "Weekly distributor restock",
        "items": [
            {
                "product_id": existing_prod.id,
                "product_name": "Tata Salt 1kg",
                "category": "Groceries",
                "unit": "1 kg",
                "quantity": 20,
                "purchase_price": 20.0,
                "selling_price": 28.0,
                "total_cost": 400.0,
            },
            {
                "product_name": "Fortune Sunflower Oil 1L",
                "category": "Edible Oil",
                "unit": "1 Litre",
                "quantity": 50,
                "purchase_price": 120.0,
                "selling_price": 145.0,
                "total_cost": 6000.0,
            }
        ],
        "total_amount": 6400.0,
    }

    res = client.post("/api/v1/invoices/purchase", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["supplier_name"] == "Metro Cash & Carry Wholesalers"
    assert len(data["items"]) == 2

    # 4. Verify existing product stock increased from 10 -> 30
    db_session.expire_all()
    updated_inv = db_session.query(Inventory).filter(
        Inventory.product_id == existing_prod.id,
        Inventory.shop_id == shop.id
    ).first()
    assert updated_inv.stock_quantity == 30
    assert existing_prod.price == Decimal("28.00")

    # 5. Verify new product was created in catalog with 50 units stock
    new_prod = db_session.query(Product).filter(
        Product.name == "Fortune Sunflower Oil 1L",
        Product.shop_id == shop.id
    ).first()
    assert new_prod is not None
    assert new_prod.price == Decimal("145.00")

    new_inv = db_session.query(Inventory).filter(
        Inventory.product_id == new_prod.id,
        Inventory.shop_id == shop.id
    ).first()
    assert new_inv is not None
    assert new_inv.stock_quantity == 50

    # 6. Verify GET purchase invoices
    list_res = client.get("/api/v1/invoices/purchase", headers=headers)
    assert list_res.status_code == 200
    invoices = list_res.json()
    assert len(invoices) >= 1
    assert any(i["id"] == data["id"] for i in invoices)
