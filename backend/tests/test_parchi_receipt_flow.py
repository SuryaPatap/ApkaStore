import time
import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db, engine
from app.base import Base

client = TestClient(app)

def test_full_parchi_cash_order_and_receipt_flow():
    ts = int(time.time() * 1000)

    # 1. Register Shopkeeper
    shopkeeper_email = f"owner_{ts}@example.com"
    reg_sk = client.post("/api/v1/auth/register/shopkeeper", json={
        "name": "Ram Store Owner",
        "email": shopkeeper_email,
        "phone": f"98{str(ts)[-8:]}",
        "password": "Password@123",
    })
    assert reg_sk.status_code in (200, 201)

    login_sk = client.post("/api/v1/auth/login", json={
        "email": shopkeeper_email,
        "password": "Password@123",
        "role": "SHOPKEEPER",
    })
    assert login_sk.status_code == 200
    sk_token = login_sk.json()["access_token"]
    sk_headers = {"Authorization": f"Bearer {sk_token}"}

    # Create Shop with Address
    create_shop = client.post("/api/v1/shops", headers=sk_headers, json={
        "shop_name": "Ram Kirana Mart",
        "shop_category": "Grocery",
        "address": {
            "house_number": "12",
            "street": "Main Market Road",
            "locality": "Sector 4",
            "city": "Jaipur",
            "state": "Rajasthan",
            "pincode": "302001",
            "latitude": 26.9124,
            "longitude": 75.7873,
        }
    })
    assert create_shop.status_code in (200, 201)
    shop_id = create_shop.json()["id"]

    # Add Product to Shop
    add_prod = client.post("/api/v1/products", headers=sk_headers, json={
        "name": "Aashirvaad Shudh Chakki Atta 5kg",
        "category": "Groceries",
        "unit": "5kg pack",
        "price": 240.0,
        "stock_quantity": 25,
    })
    assert add_prod.status_code in (200, 201)
    product_id = add_prod.json()["id"]

    # 2. Register Customer with Full Address
    cust_email = f"customer_{ts}@example.com"
    reg_cust = client.post("/api/v1/customers", json={
        "name": "Amit Sharma",
        "email": cust_email,
        "phone": f"91{str(ts)[-8:]}",
        "password": "Password@123",
        "address": {
            "house_number": "Flat 302, Royal Residency",
            "street": "Lane 5, Park View",
            "locality": "Sector 4",
            "landmark": "Near Community Hall",
            "city": "Jaipur",
            "state": "Rajasthan",
            "pincode": "302001",
            "latitude": 26.9140,
            "longitude": 75.7885,
        }
    })
    assert reg_cust.status_code in (200, 201)

    login_cust = client.post("/api/v1/auth/login", json={
        "email": cust_email,
        "password": "Password@123",
        "role": "CUSTOMER",
    })
    assert login_cust.status_code == 200
    cust_token = login_cust.json()["access_token"]
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    # Select shop
    select_res = client.post(f"/api/v1/customers/select-shop/{shop_id}", headers=cust_headers)
    assert select_res.status_code == 200

    # 3. Test CASH Order Placement & Checkout from Cart
    order_create_res = client.post("/api/v1/orders", headers=cust_headers, json={
        "shop_id": shop_id,
        "payment_method": "CASH",
        "notes": "Please deliver to 3rd floor",
        "items": [
            {"product_id": product_id, "quantity": 1}
        ]
    })
    assert order_create_res.status_code in (200, 201)
    cash_order_id = order_create_res.json()["id"]

    # Checkout with CASH (No payment_reference needed for COD)
    checkout_res = client.post("/api/v1/checkout", headers=cust_headers, json={
        "order_id": cash_order_id,
        "payment_method": "CASH"
    })
    assert checkout_res.status_code == 200
    assert checkout_res.json()["payment_method"] == "CASH"

    # 4. Start Parchi Thread & Send Digital Parchi Grocery List
    start_p = client.post("/api/v1/parchi/start", headers=cust_headers, json={"shop_id": shop_id})
    assert start_p.status_code == 200
    parchi_id = start_p.json()["id"]

    send_parchi = client.post(f"/api/v1/parchi/{parchi_id}/messages", headers=cust_headers, json={
        "message_type": "PARCHI_LIST",
        "parchi_items": [
            {"name": "Milk Amul Taaza", "quantity": "2 packets"},
            {"name": "Sugar", "quantity": "1 kg"},
            {"name": "Fortune Sunlite Oil", "quantity": "1 litre"}
        ],
        "payment_method": "COD",
        "customer_notes": "Please deliver before 6 PM."
    })
    assert send_parchi.status_code == 200
    parchi_msg_data = send_parchi.json()
    parchi_order_id = parchi_msg_data.get("order_id")
    assert parchi_order_id is not None
    assert "DIGITAL PARCHI GROCERY LIST" in parchi_msg_data["content"]

    # 5. Verify Customer Orders Screen Endpoint includes BOTH cash order and Parchi order
    cust_orders = client.get("/api/v1/orders/customer", headers=cust_headers)
    assert cust_orders.status_code == 200
    cust_order_ids = [o["id"] for o in cust_orders.json()]
    assert cash_order_id in cust_order_ids
    assert parchi_order_id in cust_order_ids

    # 6. Verify Shopkeeper Orders Screen Endpoint includes customer address + items
    sk_orders = client.get("/api/v1/orders/shopkeeper", headers=sk_headers)
    assert sk_orders.status_code == 200
    sk_order_ids = [o["id"] for o in sk_orders.json()]
    assert cash_order_id in sk_order_ids
    assert parchi_order_id in sk_order_ids

    # Inspect the Parchi order in shopkeeper list
    sk_parchi_order = [o for o in sk_orders.json() if o["id"] == parchi_order_id][0]
    assert sk_parchi_order["customer_name"] == "Amit Sharma"
    assert "Flat 302, Royal Residency" in sk_parchi_order["customer_address"]
    assert "91" in sk_parchi_order["customer_phone"]
    assert len(sk_parchi_order["items"]) == 3
    item_names = [it["product_name"] for it in sk_parchi_order["items"]]
    assert any("Milk Amul Taaza" in n for n in item_names)
    assert any("Sugar" in n for n in item_names)
    assert any("Fortune Sunlite Oil" in n for n in item_names)

    # 7. Shopkeeper Order Receipt Endpoint Verification
    receipt_detail = client.get(f"/api/v1/orders/shopkeeper/{parchi_order_id}", headers=sk_headers)
    assert receipt_detail.status_code == 200
    r_json = receipt_detail.json()
    assert r_json["customer_name"] == "Amit Sharma"
    assert "Flat 302, Royal Residency" in r_json["customer_address"]
    assert "91" in r_json["customer_phone"]
    assert len(r_json["items"]) == 3
    assert r_json["payment_method"] == "COD"

    # 8. Test Shopkeeper Adding / Updating Rupees (Pricing) on Parchi Order Items
    items_to_price = r_json["items"]
    pricing_payload = {
        "items": [
            {"item_id": items_to_price[0]["id"], "unit_price": 66.0, "quantity": items_to_price[0]["quantity"]},
            {"item_id": items_to_price[1]["id"], "unit_price": 44.0, "quantity": items_to_price[1]["quantity"]},
            {"item_id": items_to_price[2]["id"], "unit_price": 145.0, "quantity": items_to_price[2]["quantity"]},
        ],
        "notes": "Updated fresh stock rates"
    }
    update_pricing = client.patch(f"/api/v1/orders/shopkeeper/{parchi_order_id}/items-pricing", headers=sk_headers, json=pricing_payload)
    assert update_pricing.status_code == 200
    priced_order = update_pricing.json()
    assert float(priced_order["total_amount"]) == (2 * 66.0) + 44.0 + 145.0

    # 9. Test Shopkeeper Delivering the Order (Status -> COMPLETED)
    deliver_res = client.patch(f"/api/v1/orders/shopkeeper/{parchi_order_id}/status", headers=sk_headers, json={"status": "COMPLETED"})
    assert deliver_res.status_code == 200
    assert deliver_res.json()["status"] == "COMPLETED"

    # 10. Test Notification System for Both Customer and Shopkeeper
    cust_notifs = client.get("/api/v1/notifications", headers=cust_headers)
    assert cust_notifs.status_code == 200
    cust_n_list = cust_notifs.json()
    assert len(cust_n_list) > 0

    sk_notifs = client.get("/api/v1/notifications", headers=sk_headers)
    assert sk_notifs.status_code == 200
    sk_n_list = sk_notifs.json()
    assert len(sk_n_list) > 0
