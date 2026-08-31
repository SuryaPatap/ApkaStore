import pytest
from fastapi.testclient import TestClient
from decimal import Decimal
from datetime import datetime, timezone
import random
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.shop import Shop
from app.models.product import Product
from app.models.inventory import Inventory
from app.core.security import create_access_token, hash_password

client = TestClient(app)

@pytest.fixture
def db_session():
    session = SessionLocal()
    yield session
    session.close()

def test_invoice_creation_and_stock_deduction(db_session):
    unique_suffix = int(datetime.now(timezone.utc).timestamp()) + random.randint(1000, 9999)
    phone_num = f"98{random.randint(10000000, 99999999)}"

    # 1. Setup Shopkeeper & Shop
    shop_user = User(
        email=f"invoice_shop_{unique_suffix}@testmail.com",
        name="Invoice Store Owner",
        phone=phone_num,
        role="shopkeeper",
        password_hash=hash_password("Pass123"),
        is_active=True,
    )
    db_session.add(shop_user)
    db_session.commit()

    shop = Shop(
        owner_user_id=shop_user.id,
        shop_name="Invoice Test Store",
        shop_phone=phone_num,
        shop_category="General",
        is_active=True,
        upi_id="invoicetest@upi",
    )
    db_session.add(shop)
    db_session.commit()

    # 2. Add product with 10 units in Inventory
    prod = Product(
        shop_id=shop.id,
        name="Aashirvaad Atta 5kg",
        category="Flour",
        unit="5 kg",
        price=Decimal("250.00"),
        is_active=True,
    )
    db_session.add(prod)
    db_session.commit()

    inv = Inventory(
        shop_id=shop.id,
        product_id=prod.id,
        stock_quantity=10,
        is_active=True,
    )
    db_session.add(inv)
    db_session.commit()

    token = create_access_token({"sub": str(shop_user.id), "role": "shopkeeper"})
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Create invoice for 3 units
    payload = {
        "customer_name": "Ramesh Kumar",
        "customer_phone": "9999888877",
        "items": [
            {
                "product_id": prod.id,
                "product_name": "Aashirvaad Atta 5kg",
                "unit": "5 kg",
                "quantity": 3,
                "unit_price": 250.0,
                "total_price": 750.0,
            }
        ],
        "subtotal_amount": 750.0,
        "discount_amount": 50.0,
        "tax_amount": 0.0,
        "total_amount": 700.0,
        "payment_method": "CASH",
        "payment_status": "PAID",
        "notes": "Counter Cash Sale",
    }

    res = client.post("/api/v1/invoices", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["invoice_number"].startswith("INV-")
    assert data["customer_name"] == "Ramesh Kumar"
    assert float(data["total_amount"]) == 700.0
    assert len(data["items"]) == 1

    # 4. Verify inventory stock was decremented from 10 -> 7
    db_session.expire_all()
    updated_inv = db_session.query(Inventory).filter(Inventory.product_id == prod.id, Inventory.shop_id == shop.id).first()
    assert updated_inv.stock_quantity == 7

    # 5. Verify list endpoint
    list_res = client.get("/api/v1/invoices", headers=headers)
    assert list_res.status_code == 200
    invoices = list_res.json()
    assert len(invoices) >= 1
    assert any(i["id"] == data["id"] for i in invoices)
