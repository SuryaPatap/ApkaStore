import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone
import random
from app.main import app
from app.database import SessionLocal, engine
from app.base import Base
from app.models.user import User
from app.models.shop import Shop
from app.core.security import create_access_token, hash_password

client = TestClient(app)

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()

def test_shopkeeper_add_10_bulk_customers_and_list(db_session):
    unique_suffix = int(datetime.now(timezone.utc).timestamp()) + random.randint(1000, 9999)
    phone_num = f"98{random.randint(10000000, 99999999)}"

    # 1. Setup Shopkeeper & Shop
    shop_user = User(
        email=f"bulk_shop_{unique_suffix}@testmail.com",
        name="Bulk Test Store Owner",
        phone=phone_num,
        role="shopkeeper",
        password_hash=hash_password("Pass123"),
        is_active=True,
    )
    db_session.add(shop_user)
    db_session.commit()

    shop = Shop(
        owner_user_id=shop_user.id,
        shop_name="Bulk Test Grocery Store",
        shop_phone=phone_num,
        shop_category="General",
        is_active=True,
    )
    db_session.add(shop)
    db_session.commit()

    token = create_access_token({"sub": str(shop_user.id), "role": "shopkeeper"})
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Add 12 customers in bulk at once
    customer_payload = {
        "customers": [
            {"name": f"Customer {i}", "phone": f"98{random.randint(10000000, 99999999)}"}
            for i in range(1, 13)
        ]
    }

    res = client.post("/api/v1/customers/shopkeeper/bulk", json=customer_payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["success"] is True
    assert len(data["customers"]) == 12

    # 3. Retrieve connected customers list
    list_res = client.get("/api/v1/customers/shopkeeper/list", headers=headers)
    assert list_res.status_code == 200, list_res.text
    customers_list = list_res.json()
    assert len(customers_list) >= 12
    assert any(c["name"] == "Customer 1" for c in customers_list)
