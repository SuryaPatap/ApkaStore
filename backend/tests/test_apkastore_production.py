import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import engine
from sqlalchemy import text

client = TestClient(app)

@pytest.fixture(autouse=True)
def wipe_db():
    tables = [
        "credit_ledger", "credit_payments", "credit_transactions", "credit_accounts",
        "credit_requests", "monthly_settlements", "cart_items", "carts", "substitution_requests",
        "notifications", "order_items", "orders", "inventory", "payments", "purchase_items",
        "purchases", "products", "shop_customers", "shops", "customers", "addresses", "users"
    ]
    with engine.begin() as conn:
        for t in tables:
            try:
                conn.execute(text(f'TRUNCATE TABLE "{t}" RESTART IDENTITY CASCADE;'))
            except Exception:
                pass
    yield

def test_production_apkastore_suite():
    # 1. Register Real Shopkeeper 1 (Indiranagar, Bangalore - within 2km)
    reg_sk1 = client.post("/api/v1/auth/register/shopkeeper", json={
        "name": "Ramesh Gupta",
        "phone": "9876543210",
        "email": "ramesh@apkastore.com",
        "password": "Password123"
    })
    assert reg_sk1.status_code == 201, reg_sk1.text

    # Login as Shopkeeper
    login_sk1 = client.post("/api/v1/auth/login", json={
        "email": "ramesh@apkastore.com",
        "password": "Password123",
        "role": "shopkeeper"
    })
    assert login_sk1.status_code == 200
    sk1_token = login_sk1.json()["access_token"]
    sk1_headers = {"Authorization": f"Bearer {sk1_token}"}

    # Verify Shopkeeper role rejection if attempting customer login
    invalid_role_login = client.post("/api/v1/auth/login", json={
        "email": "ramesh@apkastore.com",
        "password": "Password123",
        "role": "customer"
    })
    assert invalid_role_login.status_code == 400
    assert "registered as a Shopkeeper" in invalid_role_login.json()["detail"]

    # Create Store 1 in Indiranagar (560038)
    shop1_res = client.post("/api/v1/shops", headers=sk1_headers, json={
        "shop_name": "Apka Fresh Mart Indiranagar",
        "shop_category": "Grocery & Daily Needs",
        "gst_number": "29ABCDE1234F1Z5",
        "address": {
            "house_number": "12",
            "street": "100 Feet Road",
            "locality": "Indiranagar",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560038"
        }
    })
    assert shop1_res.status_code == 201
    shop1_id = shop1_res.json()["id"]

    # Add Products to Store 1
    p1 = client.post("/api/v1/products", headers=sk1_headers, json={
        "name": "Aashirvaad Atta 5kg",
        "category": "Groceries",
        "unit": "5 kg",
        "price": 245.0,
        "stock_quantity": 50
    })
    assert p1.status_code == 201
    p1_id = p1.json()["id"]

    # 2. Register Real Shopkeeper 2 Far Away (Whitefield, Bangalore - 15km away)
    reg_sk2 = client.post("/api/v1/auth/register/shopkeeper", json={
        "name": "Suresh Kumar",
        "phone": "9876543222",
        "email": "suresh@apkastore.com",
        "password": "Password123"
    })
    assert reg_sk2.status_code == 201
    login_sk2 = client.post("/api/v1/auth/login", json={
        "email": "suresh@apkastore.com",
        "password": "Password123",
        "role": "shopkeeper"
    })
    sk2_token = login_sk2.json()["access_token"]
    sk2_headers = {"Authorization": f"Bearer {sk2_token}"}

    client.post("/api/v1/shops", headers=sk2_headers, json={
        "shop_name": "Apka Distant Mart Whitefield",
        "shop_category": "Grocery",
        "address": {
            "street": "ITPL Main Road",
            "locality": "Whitefield",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560066"
        }
    })

    # 3. Register Customer in Indiranagar (Within 2km of Store 1, far from Store 2)
    reg_cust = client.post("/api/v1/customers", json={
        "name": "Ananya Sharma",
        "phone": "9876543233",
        "email": "ananya@gmail.com",
        "password": "Password123",
        "address": {
            "house_number": "45/B",
            "street": "12th Main Road",
            "locality": "Indiranagar",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560038"
        }
    })
    assert reg_cust.status_code == 201

    # Customer Login with strict role
    login_cust = client.post("/api/v1/auth/login", json={
        "email": "ananya@gmail.com",
        "password": "Password123",
        "role": "customer"
    })
    assert login_cust.status_code == 200
    cust_token = login_cust.json()["access_token"]
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    # Verify Customer role rejection if attempting shopkeeper login
    invalid_cust_login = client.post("/api/v1/auth/login", json={
        "email": "ananya@gmail.com",
        "password": "Password123",
        "role": "shopkeeper"
    })
    assert invalid_cust_login.status_code == 400
    assert "registered as a Customer" in invalid_cust_login.json()["detail"]

    # 4. Check 2km Nearby Shop Discovery
    nearby_res = client.get("/api/v1/shops/nearby?max_distance_km=2.0", headers=cust_headers)
    assert nearby_res.status_code == 200
    nearby_shops = nearby_res.json()
    assert len(nearby_shops) == 1, f"Expected exactly 1 shop under 2km, got {len(nearby_shops)}"
    assert nearby_shops[0]["id"] == shop1_id
    assert nearby_shops[0]["distance_km"] <= 2.0
    assert nearby_shops[0]["owner_name"] == "Ramesh Gupta"

    # Customer selects the 2km store
    sel_res = client.post(f"/api/v1/customers/select-shop/{shop1_id}", headers=cust_headers)
    assert sel_res.status_code == 200

    # 5. Direct Udhar Khata Connectivity:
    # Customer requests ₹3,000 credit limit
    req_res = client.post("/api/v1/credit/request", headers=cust_headers, json={
        "shop_id": shop1_id,
        "requested_limit": 3000.0,
        "notes": "Monthly groceries credit request"
    })
    assert req_res.status_code == 201
    credit_req_id = req_res.json()["id"]

    # Shopkeeper views pending request in live Khata book
    sk_requests = client.get("/api/v1/credit/shopkeeper/requests", headers=sk1_headers)
    assert sk_requests.status_code == 200
    assert len(sk_requests.json()) == 1

    # Shopkeeper approves request for ₹3,000
    appr_res = client.patch(f"/api/v1/credit/shopkeeper/requests/{credit_req_id}", headers=sk1_headers, json={
        "approved": True,
        "approved_limit": 3000.0
    })
    assert appr_res.status_code == 200

    # Customer checks their Udhar Khata account
    acc_res = client.get(f"/api/v1/credit/account/{shop1_id}", headers=cust_headers)
    assert acc_res.status_code == 200
    assert float(acc_res.json()["credit_limit"]) == 3000.0
    assert float(acc_res.json()["outstanding_amount"]) == 0.0

    # 6. Customer places an Order using Udhar Khata
    order_res = client.post("/api/v1/orders", headers=cust_headers, json={
        "shop_id": shop1_id,
        "payment_method": "UDHAR_KHATA",
        "notes": "Please deliver to 45/B",
        "items": [
            {
                "product_id": p1_id,
                "quantity": 2,
                "unit_price": 245.0
            }
        ]
    })
    assert order_res.status_code == 201
    order_data = order_res.json()
    order_id = order_data["id"]
    assert float(order_data["total_amount"]) == 490.0

    # Shopkeeper receives order live & marks READY
    sk_orders = client.get("/api/v1/orders/shopkeeper", headers=sk1_headers)
    assert sk_orders.status_code == 200
    assert len(sk_orders.json()) == 1

    # Shopkeeper receives order live & advances status to READY
    status_update = client.patch(f"/api/v1/orders/shopkeeper/{order_id}/status", headers=sk1_headers, json={
        "status": "READY"
    })
    assert status_update.status_code == 200
    assert status_update.json()["status"] == "READY"

    # Customer checks live Itemized Ledger & Digital Receipt
    cust_ledger = client.get(f"/api/v1/credit/ledger/{shop1_id}", headers=cust_headers)
    assert cust_ledger.status_code == 200
    entries = cust_ledger.json()
    assert len(entries) >= 1
    assert entries[0]["items"][0]["product_name"] == "Aashirvaad Atta 5kg"
    assert entries[0]["items"][0]["quantity"] == 2
    assert float(entries[0]["balance_after"]) == 490.0

    # Customer queries /me profile
    me_res = client.get("/api/v1/customers/me", headers=cust_headers)
    assert me_res.status_code == 200
    assert me_res.json()["name"] == "Ananya Sharma"
    assert me_res.json()["address"]["locality"] == "Indiranagar"
