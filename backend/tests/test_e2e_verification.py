import uuid
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_system_e2e():
    uid = uuid.uuid4().hex[:6]

    # 1. Register a fresh shopkeeper and shop
    sk_email = f"kirana_{uid}@localstore.com"
    sk_phone = f"99{int(uuid.uuid4().int % 100000000):08d}"
    r = client.post("/api/v1/auth/register/shopkeeper", json={
        "name": "Gupta Kirana Store",
        "email": sk_email,
        "phone": sk_phone,
        "password": "password123"
    })
    assert r.status_code == 201, f"Shopkeeper register failed: {r.text}"

    login_r = client.post("/api/v1/auth/login", json={"email": sk_email, "password": "password123"})
    sk_token = login_r.json()["access_token"]
    sk_headers = {"Authorization": f"Bearer {sk_token}"}

    # Create Shop in Koramangala
    shop_r = client.post("/api/v1/shops", headers=sk_headers, json={
        "shop_name": "Gupta Daily Supermarket",
        "shop_category": "Grocery & Daily Needs",
        "address": {
            "street": "100ft Road",
            "locality": "Koramangala 4th Block",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560034"
        }
    })
    assert shop_r.status_code == 201
    shop_id = shop_r.json()["id"]

    # Add Products
    p1_r = client.post("/api/v1/products", headers=sk_headers, json={
        "name": "Aashirvaad Shudh Chakki Atta 5kg",
        "category": "Groceries",
        "price": 245.00,
        "stock_quantity": 50,
        "unit": "packet",
        "is_active": True
    })
    assert p1_r.status_code == 201
    p1_id = p1_r.json()["id"]

    p2_r = client.post("/api/v1/products", headers=sk_headers, json={
        "name": "Fortune Sunlite Refined Sunflower Oil 5L",
        "category": "Groceries",
        "price": 620.00,
        "stock_quantity": 30,
        "unit": "can",
        "is_active": True
    })
    assert p2_r.status_code == 201
    p2_id = p2_r.json()["id"]

    # 2. Register a Customer in Koramangala
    c_email = f"customer_{uid}@localstore.com"
    c_phone = f"98{int(uuid.uuid4().int % 100000000):08d}"
    c_r = client.post("/api/v1/customers", json={
        "name": "Ananya Sharma",
        "email": c_email,
        "phone": c_phone,
        "password": "password123",
        "address": {
            "house_number": "42",
            "street": "80ft Road",
            "locality": "Koramangala 4th Block",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560034"
        }
    })
    assert c_r.status_code == 201

    c_login_r = client.post("/api/v1/auth/login", json={"email": c_email, "password": "password123"})
    c_token = c_login_r.json()["access_token"]
    c_headers = {"Authorization": f"Bearer {c_token}"}

    # 3. Discover nearby shops under 5km
    nearby_r = client.get("/api/v1/shops/nearby?max_distance_km=5.0", headers=c_headers)
    assert nearby_r.status_code == 200
    nearby_shops = nearby_r.json()
    assert len(nearby_shops) > 0
    shop_match = next((s for s in nearby_shops if s["id"] == shop_id), None)
    assert shop_match is not None
    assert shop_match["distance_km"] <= 5.0

    # 4. Customer requests Udhar Khata limit of Rs 5000
    req_r = client.post("/api/v1/credit/request", headers=c_headers, json={
        "shop_id": shop_id,
        "requested_limit": "5000.00",
        "notes": "Monthly household groceries"
    })
    assert req_r.status_code == 201
    req_id = req_r.json()["id"]

    # 5. Shopkeeper approves Udhar Khata
    appr_r = client.patch(f"/api/v1/credit/shopkeeper/requests/{req_id}", headers=sk_headers, json={
        "approved": True,
        "approved_limit": "5000.00",
        "notes": "Approved for neighbor"
    })
    assert appr_r.status_code == 200

    # 6. Customer creates Order and checks out with CREDIT (Udhar Khata)
    order_r = client.post("/api/v1/orders", headers=c_headers, json={
        "shop_id": shop_id,
        "items": [
            {"product_id": p1_id, "quantity": 2},
            {"product_id": p2_id, "quantity": 1}
        ]
    })
    assert order_r.status_code == 201
    order_id = order_r.json()["id"]
    total = order_r.json()["total_amount"]
    # 2*245 + 1*620 = 1110.00
    assert float(total) == 1110.00

    chk_r = client.post("/api/v1/checkout", headers=c_headers, json={
        "order_id": order_id,
        "payment_method": "CREDIT"
    })
    assert chk_r.status_code == 200
    assert chk_r.json()["payment_status"] in ["PAID", "CREDIT_CONFIRMED"]

    # 7. Verify Customer Itemized Ledger
    c_ledger_r = client.get(f"/api/v1/credit/ledger/{shop_id}", headers=c_headers)
    assert c_ledger_r.status_code == 200
    c_ledger = c_ledger_r.json()
    assert len(c_ledger) >= 1
    first_tx = c_ledger[0]
    assert first_tx["transaction_type"] == "CREDIT_PURCHASE"
    assert "formatted_date" in first_tx and first_tx["formatted_date"] is not None
    assert "formatted_time" in first_tx and first_tx["formatted_time"] is not None
    assert len(first_tx["items"]) == 2
    assert first_tx["items"][0]["product_name"] == "Aashirvaad Shudh Chakki Atta 5kg"
    assert float(first_tx["items"][0]["quantity"]) == 2.0
    assert float(first_tx["items"][0]["subtotal"]) == 490.00

    # 8. Verify Shopkeeper Customer Ledger & Record Payment
    cust_id = c_r.json()["id"]
    sk_cust_ledger_r = client.get(f"/api/v1/credit/shopkeeper/ledger/{cust_id}", headers=sk_headers)
    assert sk_cust_ledger_r.status_code == 200
    sk_ledger = sk_cust_ledger_r.json()
    assert len(sk_ledger) >= 1
    assert sk_ledger[0]["formatted_time"] is not None

    # Shopkeeper records payment of Rs 600
    pay_r = client.post(f"/api/v1/credit/shopkeeper/record-payment/{cust_id}", headers=sk_headers, json={
        "amount": "600.00",
        "payment_method": "UPI",
        "notes": "Received via GPay"
    })
    assert pay_r.status_code in [200, 201]

    # Verify updated balance is 510 (1110 - 600)
    bal_r = client.get(f"/api/v1/credit/account/{shop_id}", headers=c_headers)
    assert bal_r.status_code == 200
    assert float(bal_r.json()["outstanding_amount"]) == 510.00

    print("\n>>> ALL E2E WORKFLOW TESTS PASSED CLEANLY! <<<")
