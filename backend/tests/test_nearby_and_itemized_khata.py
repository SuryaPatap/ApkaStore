import uuid
import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def random_phone():
    return "9" + "".join(str(uuid.uuid4().int % 10) for _ in range(9))

def random_email():
    return f"user_{uuid.uuid4().hex[:8]}@example.com"


class TestNearbyShopsAndItemizedKhata:
    def test_nearby_5km_discovery_and_shop_selection(self):
        # 1. Register a Shopkeeper and create a Shop located in Bangalore (Indiranagar - 560038)
        sk_email = random_email()
        sk_phone = random_phone()
        sk_pass = "password123"

        sk_reg = client.post(
            "/api/v1/auth/register/shopkeeper",
            json={
                "name": "Gupta Kirana",
                "email": sk_email,
                "phone": sk_phone,
                "password": sk_pass,
            },
        )
        assert sk_reg.status_code in [200, 201]

        sk_login = client.post(
            "/api/v1/auth/login",
            json={"email": sk_email, "password": sk_pass},
        )
        assert sk_login.status_code == 200
        sk_token = sk_login.json()["access_token"]
        sk_headers = {"Authorization": f"Bearer {sk_token}"}

        # Create shop in Indiranagar (Lat: 12.9784, Lon: 77.6408)
        shop_res = client.post(
            "/api/v1/shops",
            headers=sk_headers,
            json={
                "shop_name": "Gupta Super Store",
                "shop_category": "Grocery & Daily Needs",
                "gst_number": f"29GUPTA{uuid.uuid4().hex[:4].upper()}1Z1",
                "address": {
                    "house_number": "42",
                    "street": "100ft Road",
                    "locality": "Indiranagar",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "pincode": "560038",
                    "latitude": 12.9784,
                    "longitude": 77.6408,
                },
            },
        )
        assert shop_res.status_code == 201
        shop_id = shop_res.json()["id"]

        # Add a product to this shop
        prod_res = client.post(
            "/api/v1/products",
            headers=sk_headers,
            json={
                "name": "Organic Aashirvaad Atta 5kg",
                "category": "Groceries",
                "unit": "packet",
                "price": "275.00",
                "stock_quantity": 40,
            },
        )
        assert prod_res.status_code == 201
        prod_id = prod_res.json()["id"]

        # 2. Register Customer A nearby in Indiranagar (1.1 km away) (Lat: 12.9710, Lon: 77.6350)
        c1_email = random_email()
        c1_phone = random_phone()
        c1_reg = client.post(
            "/api/v1/customers",
            json={
                "name": "Amit Nearby",
                "email": c1_email,
                "phone": c1_phone,
                "password": "password123",
                "address": {
                    "house_number": "12/A",
                    "street": "12th Main",
                    "locality": "Indiranagar",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "pincode": "560038",
                    "latitude": 12.9710,
                    "longitude": 77.6350,
                },
            },
        )
        assert c1_reg.status_code == 201

        c1_login = client.post(
            "/api/v1/auth/login",
            json={"email": c1_email, "password": "password123"},
        )
        c1_token = c1_login.json()["access_token"]
        c1_headers = {"Authorization": f"Bearer {c1_token}"}

        # Query nearby shops within 5km for Customer A
        nearby_res = client.get(
            "/api/v1/shops/nearby?max_distance_km=5.0",
            headers=c1_headers,
        )
        assert nearby_res.status_code == 200
        nearby_shops = nearby_res.json()
        shop_ids = [s["id"] for s in nearby_shops]
        assert shop_id in shop_ids
        matched_shop = next(s for s in nearby_shops if s["id"] == shop_id)
        assert matched_shop["distance_km"] <= 5.0
        assert matched_shop["shop_name"] == "Gupta Super Store"

        # Customer A selects this shop
        sel_res = client.post(
            f"/api/v1/customers/select-shop/{shop_id}",
            headers=c1_headers,
        )
        assert sel_res.status_code == 200
        assert sel_res.json()["id"] == shop_id

        # Verify selected shop endpoint
        cur_sel = client.get(
            "/api/v1/customers/selected-shop",
            headers=c1_headers,
        )
        assert cur_sel.status_code == 200
        assert cur_sel.json()["id"] == shop_id

        # 3. Register Customer B Far Away (e.g. Whitefield - 18 km away) (Lat: 12.9698, Lon: 77.7499)
        c2_email = random_email()
        c2_phone = random_phone()
        c2_reg = client.post(
            "/api/v1/customers",
            json={
                "name": "Rohan FarAway",
                "email": c2_email,
                "phone": c2_phone,
                "password": "password123",
                "address": {
                    "house_number": "88",
                    "street": "ITPL Road",
                    "locality": "Whitefield",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "pincode": "560066",
                    "latitude": 12.9698,
                    "longitude": 77.7499,
                },
            },
        )
        assert c2_reg.status_code == 201

        c2_login = client.post(
            "/api/v1/auth/login",
            json={"email": c2_email, "password": "password123"},
        )
        c2_token = c2_login.json()["access_token"]
        c2_headers = {"Authorization": f"Bearer {c2_token}"}

        # Customer B searching within 5km should NOT see Gupta Super Store
        c2_nearby = client.get(
            "/api/v1/shops/nearby?max_distance_km=5.0",
            headers=c2_headers,
        )
        assert c2_nearby.status_code == 200
        c2_shop_ids = [s["id"] for s in c2_nearby.json()]
        assert shop_id not in c2_shop_ids

    def test_itemized_udhar_khata_flow(self):
        # 1. Create shopkeeper and shop
        sk_email = random_email()
        sk_phone = random_phone()
        client.post(
            "/api/v1/auth/register/shopkeeper",
            json={
                "name": "Verma Store",
                "email": sk_email,
                "phone": sk_phone,
                "password": "password123",
            },
        )
        sk_token = client.post(
            "/api/v1/auth/login",
            json={"email": sk_email, "password": "password123"},
        ).json()["access_token"]
        sk_headers = {"Authorization": f"Bearer {sk_token}"}

        shop_id = client.post(
            "/api/v1/shops",
            headers=sk_headers,
            json={
                "shop_name": "Verma Provisions",
                "shop_category": "Grocery",
                "address": {
                    "house_number": "1",
                    "street": "Main Road",
                    "locality": "Jayanagar",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "pincode": "560041",
                },
            },
        ).json()["id"]

        # Add 2 products
        p1_id = client.post(
            "/api/v1/products",
            headers=sk_headers,
            json={
                "name": "Tata Tea Gold 500g",
                "category": "Beverages",
                "unit": "box",
                "price": "310.00",
                "stock_quantity": 50,
            },
        ).json()["id"]

        p2_id = client.post(
            "/api/v1/products",
            headers=sk_headers,
            json={
                "name": "Amul Pure Ghee 1L",
                "category": "Dairy",
                "unit": "tin",
                "price": "650.00",
                "stock_quantity": 30,
            },
        ).json()["id"]

        # 2. Create customer
        c_email = random_email()
        c_phone = random_phone()
        c_res = client.post(
            "/api/v1/customers",
            json={
                "name": "Priya Sharma",
                "email": c_email,
                "phone": c_phone,
                "password": "password123",
                "address": {
                    "house_number": "10",
                    "street": "3rd Cross",
                    "locality": "Jayanagar",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "pincode": "560041",
                },
            },
        ).json()
        cust_id = c_res["id"]

        c_token = client.post(
            "/api/v1/auth/login",
            json={"email": c_email, "password": "password123"},
        ).json()["access_token"]
        c_headers = {"Authorization": f"Bearer {c_token}"}

        # 3. Customer requests Udhar Khata of Rs 4000
        req_res = client.post(
            "/api/v1/credit/request",
            headers=c_headers,
            json={
                "shop_id": shop_id,
                "requested_limit": "4000.00",
                "notes": "Monthly groceries credit",
            },
        )
        assert req_res.status_code == 201
        req_id = req_res.json()["id"]

        # 4. Shopkeeper approves Udhar Khata with Rs 4000 limit
        appr_res = client.patch(
            f"/api/v1/credit/shopkeeper/requests/{req_id}",
            headers=sk_headers,
            json={
                "approved": True,
                "approved_limit": "4000.00",
                "notes": "Approved for regular customer",
            },
        )
        assert appr_res.status_code == 200
        assert appr_res.json()["status"] == "APPROVED"

        # 5. Customer adds Tata Tea (2x) and Amul Ghee (1x) to cart and creates order
        # Add to cart
        client.post(
            "/api/v1/cart/items",
            headers=c_headers,
            json={"shop_id": shop_id, "product_id": p1_id, "quantity": 2},
        )
        client.post(
            "/api/v1/cart/items",
            headers=c_headers,
            json={"shop_id": shop_id, "product_id": p2_id, "quantity": 1},
        )

        # Checkout via order creation
        order_res = client.post(
            "/api/v1/orders",
            headers=c_headers,
            json={
                "shop_id": shop_id,
                "items": [
                    {"product_id": p1_id, "quantity": 2},
                    {"product_id": p2_id, "quantity": 1},
                ],
            },
        )
        assert order_res.status_code == 201
        order_id = order_res.json()["id"]
        # Total = 2 * 310 + 1 * 650 = 1270.00
        assert Decimal(str(order_res.json()["total_amount"])) == Decimal("1270.00")

        # Checkout with CREDIT (Udhar Khata)
        chk_res = client.post(
            "/api/v1/checkout",
            headers=c_headers,
            json={
                "order_id": order_id,
                "payment_method": "CREDIT",
            },
        )
        assert chk_res.status_code == 200
        assert chk_res.json()["payment_status"] == "PAID"

        # 6. Verify Customer's itemized Udhar Khata ledger
        cust_ledger = client.get(
            f"/api/v1/credit/ledger/{shop_id}",
            headers=c_headers,
        )
        assert cust_ledger.status_code == 200
        c_entries = cust_ledger.json()
        assert len(c_entries) >= 1

        first_entry = c_entries[0]
        assert first_entry["transaction_type"] == "CREDIT_PURCHASE"
        assert Decimal(str(first_entry["amount"])) == Decimal("1270.00")
        assert Decimal(str(first_entry["balance_after"])) == Decimal("1270.00")
        assert first_entry["formatted_date"] is not None
        assert first_entry["formatted_time"] is not None
        assert first_entry["order_id"] == order_id
        assert len(first_entry["items"]) == 2

        # Check itemized items
        item_names = [it["product_name"] for it in first_entry["items"]]
        assert "Tata Tea Gold 500g" in item_names
        assert "Amul Pure Ghee 1L" in item_names

        # 7. Verify Shopkeeper's itemized Udhar Khata view for this customer
        sk_ledger = client.get(
            f"/api/v1/credit/shopkeeper/ledger/{cust_id}",
            headers=sk_headers,
        )
        assert sk_ledger.status_code == 200
        sk_entries = sk_ledger.json()
        assert len(sk_entries) >= 1
        assert sk_entries[0]["order_id"] == order_id
        assert len(sk_entries[0]["items"]) == 2
        assert sk_entries[0]["formatted_date"] is not None
        assert sk_entries[0]["formatted_time"] is not None
