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


class TestFullAPIWorkflow:
    @classmethod
    def setup_class(cls):
        # Create shopkeeper
        cls.sk_email = random_email()
        cls.sk_phone = random_phone()
        cls.sk_password = "password123"
        
        reg_res = client.post(
            "/api/v1/auth/register/shopkeeper",
            json={
                "name": "Test Shopkeeper",
                "email": cls.sk_email,
                "phone": cls.sk_phone,
                "password": cls.sk_password,
            },
        )
        assert reg_res.status_code in [200, 201], reg_res.text
        cls.sk_id = reg_res.json()["user_id"]

        # Login shopkeeper
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": cls.sk_email, "password": cls.sk_password},
        )
        assert login_res.status_code == 200, login_res.text
        cls.sk_token = login_res.json()["access_token"]
        cls.sk_headers = {"Authorization": f"Bearer {cls.sk_token}"}

        # Create shop
        shop_res = client.post(
            "/api/v1/shops",
            headers=cls.sk_headers,
            json={
                "shop_name": "Fresh Mart",
                "shop_category": "Grocery",
                "gst_number": f"29ABCDE{uuid.uuid4().hex[:4].upper()}1Z5",
                "address": {
                    "house_number": "123",
                    "street": "Market Road",
                    "locality": "Sector 1",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "pincode": "560001",
                },
            },
        )
        assert shop_res.status_code in [200, 201], shop_res.text
        cls.shop_id = shop_res.json()["id"]

        # Create customer
        cls.cust_email = random_email()
        cls.cust_phone = random_phone()
        cls.cust_password = "password123"

        cust_res = client.post(
            "/api/v1/customers",
            json={
                "name": "Jane Doe",
                "email": cls.cust_email,
                "phone": cls.cust_phone,
                "password": cls.cust_password,
                "address": {
                    "house_number": "456",
                    "street": "Garden Lane",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "pincode": "560001",
                },
            },
        )
        assert cust_res.status_code in [200, 201], cust_res.text
        cls.customer_id = cust_res.json()["id"]
        cls.cust_user_id = cust_res.json()["user_id"]

        # Login customer
        cust_login_res = client.post(
            "/api/v1/auth/login",
            json={"email": cls.cust_email, "password": cls.cust_password},
        )
        assert cust_login_res.status_code == 200, cust_login_res.text
        cls.cust_token = cust_login_res.json()["access_token"]
        cls.cust_headers = {"Authorization": f"Bearer {cls.cust_token}"}

    def test_shopkeeper_my_shop(self):
        res = client.get("/api/v1/shops/my-shop", headers=self.sk_headers)
        assert res.status_code == 200, res.text
        assert res.json()["id"] == self.shop_id

        # update shop
        up_res = client.put(
            "/api/v1/shops/my-shop",
            headers=self.sk_headers,
            json={"shop_name": "Fresh Mart Super"},
        )
        assert up_res.status_code == 200, up_res.text
        assert up_res.json()["shop_name"] == "Fresh Mart Super"

    def test_product_crud_and_inventory(self):
        # Create product
        prod_res = client.post(
            "/api/v1/products",
            headers=self.sk_headers,
            json={
                "name": f"Apple_{uuid.uuid4().hex[:4]}",
                "category": "Fruits",
                "unit": "kg",
                "price": "120.00",
                "stock_quantity": 50,
            },
        )
        assert prod_res.status_code in [200, 201], prod_res.text
        prod_id = prod_res.json()["id"]

        # Get product
        get_res = client.get(f"/api/v1/products/{prod_id}", headers=self.cust_headers)
        assert get_res.status_code == 200, get_res.text

        # Update product
        put_res = client.put(
            f"/api/v1/products/{prod_id}",
            headers=self.sk_headers,
            json={"price": "130.00"},
        )
        assert put_res.status_code == 200, put_res.text

        # Update inventory via product
        patch_inv = client.patch(
            f"/api/v1/products/{prod_id}/inventory",
            headers=self.sk_headers,
            json={"stock_quantity": 60},
        )
        assert patch_inv.status_code == 200, patch_inv.text

        # List inventory
        inv_list = client.get("/api/v1/inventory", headers=self.sk_headers)
        assert inv_list.status_code == 200, inv_list.text

    def test_cart_operations(self):
        # Create a product for cart
        prod_res = client.post(
            "/api/v1/products",
            headers=self.sk_headers,
            json={
                "name": f"Banana_{uuid.uuid4().hex[:4]}",
                "category": "Fruits",
                "unit": "kg",
                "price": "60.00",
                "stock_quantity": 100,
            },
        )
        prod_id = prod_res.json()["id"]

        # Add to cart
        add_res = client.post(
            f"/api/v1/cart/{self.shop_id}/items",
            headers=self.cust_headers,
            json={"product_id": prod_id, "quantity": 2},
        )
        assert add_res.status_code in [200, 201], add_res.text
        item_id = add_res.json()["items"][0]["id"]

        # Get cart
        cart_res = client.get(f"/api/v1/cart/{self.shop_id}", headers=self.cust_headers)
        assert cart_res.status_code == 200, cart_res.text
        assert len(cart_res.json()["items"]) >= 1

        # Update cart item
        up_res = client.patch(
            f"/api/v1/cart/{self.shop_id}/items/{item_id}",
            headers=self.cust_headers,
            json={"quantity": 3},
        )
        assert up_res.status_code == 200, up_res.text

        # Clear cart
        clear_res = client.delete(f"/api/v1/cart/{self.shop_id}/clear", headers=self.cust_headers)
        assert clear_res.status_code == 200, clear_res.text

    def test_order_lifecycle(self):
        # Create product
        prod_res = client.post(
            "/api/v1/products",
            headers=self.sk_headers,
            json={
                "name": f"Rice_{uuid.uuid4().hex[:4]}",
                "category": "Grains",
                "unit": "kg",
                "price": "50.00",
                "stock_quantity": 100,
            },
        )
        prod_id = prod_res.json()["id"]

        # Place order
        order_res = client.post(
            "/api/v1/orders",
            headers=self.cust_headers,
            json={
                "shop_id": self.shop_id,
                "items": [{"product_id": prod_id, "quantity": 2}],
            },
        )
        assert order_res.status_code in [200, 201], order_res.text
        order_id = order_res.json()["id"]

        # Get customer orders
        cust_orders = client.get("/api/v1/orders/customer", headers=self.cust_headers)
        assert cust_orders.status_code == 200, cust_orders.text

        # Get shopkeeper orders
        sk_orders = client.get("/api/v1/orders/shopkeeper", headers=self.sk_headers)
        assert sk_orders.status_code == 200, sk_orders.text

        # Get single order detail
        order_detail = client.get(f"/api/v1/orders/shopkeeper/{order_id}", headers=self.sk_headers)
        assert order_detail.status_code == 200, order_detail.text

        # Update order status
        status_up = client.patch(
            f"/api/v1/orders/shopkeeper/{order_id}/status",
            headers=self.sk_headers,
            json={"status": "PROCESSING"},
        )
        assert status_up.status_code == 200, status_up.text

    def test_credit_request_and_approval_flow(self):
        # Customer requests credit
        req_res = client.post(
            "/api/v1/credit/request",
            headers=self.cust_headers,
            json={
                "shop_id": self.shop_id,
                "requested_limit": "5000.00",
                "notes": "Monthly groceries",
            },
        )
        assert req_res.status_code in [200, 201], req_res.text
        req_id = req_res.json()["id"]

        # Customer views requests
        my_reqs = client.get("/api/v1/credit/requests", headers=self.cust_headers)
        assert my_reqs.status_code == 200, my_reqs.text

        # Shopkeeper views requests
        sk_reqs = client.get("/api/v1/credit/shopkeeper/requests", headers=self.sk_headers)
        assert sk_reqs.status_code == 200, sk_reqs.text

        # Shopkeeper approves request
        app_res = client.patch(
            f"/api/v1/credit/shopkeeper/requests/{req_id}",
            headers=self.sk_headers,
            json={"approved": True, "approved_limit": "5000.00", "notes": "Approved"},
        )
        assert app_res.status_code == 200, app_res.text

        # Customer views credit account
        acc_res = client.get(f"/api/v1/credit/account/{self.shop_id}", headers=self.cust_headers)
        assert acc_res.status_code == 200, acc_res.text
        assert Decimal(str(acc_res.json()["credit_limit"])) == Decimal("5000.00")

    def test_credit_accounts_router(self):
        # Test credit-accounts direct router
        bal_res = client.get(
            f"/api/v1/credit-accounts/customer/{self.customer_id}/balance?shop_id={self.shop_id}"
        )
        assert bal_res.status_code == 200, bal_res.text

    def test_credit_ledger_router(self):
        # Create credit purchase ledger entry
        entry_res = client.post(
            "/api/v1/credit-ledger",
            json={
                "customer_id": self.customer_id,
                "shop_id": self.shop_id,
                "transaction_type": "CREDIT_PURCHASE",
                "amount": "100.00",
                "description": "Manual entry",
            },
        )
        assert entry_res.status_code in [200, 201], entry_res.text

        # Get customer ledger
        cust_led = client.get(f"/api/v1/credit-ledger/customer/{self.customer_id}?shop_id={self.shop_id}")
        assert cust_led.status_code == 200, cust_led.text

        # Get customer balance
        bal_res = client.get(f"/api/v1/credit-ledger/customer/{self.customer_id}/balance?shop_id={self.shop_id}")
        assert bal_res.status_code == 200, bal_res.text

    def test_credit_payments_router(self):
        # Make credit payment
        pay_res = client.post(
            f"/api/v1/credit-payments?customer_id={self.customer_id}&shop_id={self.shop_id}&amount=50.00&payment_method=CASH"
        )
        # Note: if credit account outstanding is 0, let's see response
        assert pay_res.status_code in [201, 400], pay_res.text

    def test_notifications_router(self):
        notifs = client.get("/api/v1/notifications", headers=self.cust_headers)
        assert notifs.status_code == 200, notifs.text

        unread = client.get("/api/v1/notifications/unread-count", headers=self.cust_headers)
        assert unread.status_code == 200, unread.text

        read_all = client.patch("/api/v1/notifications/read-all", headers=self.cust_headers)
        assert read_all.status_code == 200, read_all.text

    def test_shopping_list_router(self):
        prod_res = client.post(
            "/api/v1/products",
            headers=self.sk_headers,
            json={
                "name": f"Milk_{uuid.uuid4().hex[:4]}",
                "category": "Dairy",
                "unit": "litre",
                "price": "30.00",
                "stock_quantity": 50,
            },
        )
        prod_id = prod_res.json()["id"]

        list_res = client.post(
            "/api/v1/shopping-list",
            json={
                "customer_id": self.customer_id,
                "shop_id": self.shop_id,
                "items": [{"product_id": prod_id, "quantity": 1}],
            },
        )
        assert list_res.status_code in [200, 201], list_res.text

        get_list = client.get(f"/api/v1/shopping-list/{self.customer_id}/{self.shop_id}")
        assert get_list.status_code == 200, get_list.text

    def test_checkout_router(self):
        # Create an order
        prod_res = client.post(
            "/api/v1/products",
            headers=self.sk_headers,
            json={
                "name": f"Sugar_{uuid.uuid4().hex[:4]}",
                "category": "Grocery",
                "unit": "kg",
                "price": "45.00",
                "stock_quantity": 50,
            },
        )
        prod_id = prod_res.json()["id"]

        order_res = client.post(
            "/api/v1/orders",
            headers=self.cust_headers,
            json={
                "shop_id": self.shop_id,
                "items": [{"product_id": prod_id, "quantity": 1}],
            },
        )
        assert order_res.status_code in [200, 201], order_res.text
        order_id = order_res.json()["id"]

        # Checkout order
        checkout_res = client.post(
            "/api/v1/checkout",
            json={
                "order_id": order_id,
                "payment_method": "CASH",
                "payment_reference": "CASH_12345",
            },
        )
        assert checkout_res.status_code == 200, checkout_res.text

        # Get checkout status
        status_res = client.get(f"/api/v1/checkout/{order_id}")
        assert status_res.status_code == 200, status_res.text
