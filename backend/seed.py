import sys
import os
from decimal import Decimal

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.base import Base
from app.models.user import User
from app.models.shop import Shop
from app.models.customer import Customer
from app.models.shop_customer import ShopCustomer
from app.models.product import Product
from app.models.inventory import Inventory
from app.models.credit_account import CreditAccount
from app.models.credit_transaction import CreditTransaction
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.notification import Notification
from app.core.security import hash_password

def seed_database():
    print("Creating tables if they do not exist...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Shopkeeper User
        shopkeeper_user = db.query(User).filter(
            (User.email == "shopkeeper@example.com") | (User.phone == "9876543210")
        ).first()

        if not shopkeeper_user:
            shopkeeper_user = User(
                name="Ramesh Kumar (Store Owner)",
                email="shopkeeper@example.com",
                phone="9876543210",
                password_hash=hash_password("password123"),
                role="shopkeeper",
                is_active=True,
            )
            db.add(shopkeeper_user)
            db.commit()
            db.refresh(shopkeeper_user)
            print(f"Created Shopkeeper User: {shopkeeper_user.email} (ID: {shopkeeper_user.id})")
        else:
            shopkeeper_user.email = "shopkeeper@example.com"
            shopkeeper_user.password_hash = hash_password("password123")
            shopkeeper_user.role = "shopkeeper"
            db.commit()
            print(f"Updated Shopkeeper User (ID: {shopkeeper_user.id}) with demo credentials.")

        # 2. Shop
        shop = db.query(Shop).filter(Shop.owner_user_id == shopkeeper_user.id).first()
        if not shop:
            shop = Shop(
                owner_user_id=shopkeeper_user.id,
                shop_name="Fresh Mart Super Store",
                shop_phone=shopkeeper_user.phone,
                shop_category="Grocery & Daily Needs",
                is_active=True,
            )
            db.add(shop)
            db.commit()
            db.refresh(shop)
            print(f"Created Shop: {shop.shop_name} (ID: {shop.id})")
        else:
            print(f"Shop exists: {shop.shop_name} (ID: {shop.id})")

        # 3. Customer User
        customer_user = db.query(User).filter(
            (User.email == "customer@example.com") | (User.phone == "9123456789")
        ).first()

        if not customer_user:
            customer_user = User(
                name="Rahul Sharma",
                email="customer@example.com",
                phone="9123456789",
                password_hash=hash_password("password123"),
                role="customer",
                is_active=True,
            )
            db.add(customer_user)
            db.commit()
            db.refresh(customer_user)
            print(f"Created Customer User: {customer_user.email} (ID: {customer_user.id})")
        else:
            customer_user.email = "customer@example.com"
            customer_user.password_hash = hash_password("password123")
            customer_user.role = "customer"
            db.commit()
            print(f"Updated Customer User (ID: {customer_user.id}) with demo credentials.")

        # 4. Customer Profile
        customer = db.query(Customer).filter(Customer.user_id == customer_user.id).first()
        if not customer:
            customer = Customer(
                user_id=customer_user.id,
                name="Rahul Sharma",
                phone=customer_user.phone,
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)
            print(f"Created Customer Profile: ID {customer.id}")
        else:
            print(f"Customer profile exists: ID {customer.id}")

        # 4b. Shop Customer Link
        link = db.query(ShopCustomer).filter(
            ShopCustomer.shop_id == shop.id,
            ShopCustomer.customer_id == customer.id,
        ).first()
        if not link:
            link = ShopCustomer(shop_id=shop.id, customer_id=customer.id, is_active=True)
            db.add(link)
            db.commit()

        # 5. Products & Inventory
        products_data = [
            {"name": "Aashirvaad Superior MP Atta", "category": "Groceries", "unit": "5 kg", "price": Decimal("245.00"), "stock": 40},
            {"name": "Amul Taaza Homogenised Milk", "category": "Dairy", "unit": "1 Litre", "price": Decimal("64.00"), "stock": 25},
            {"name": "Fortune Sunlite Sunflower Oil", "category": "Groceries", "unit": "1 Litre", "price": Decimal("135.00"), "stock": 30},
            {"name": "Fresh Royal Shimla Apples", "category": "Fruits", "unit": "1 kg", "price": Decimal("160.00"), "stock": 18},
            {"name": "Tata Tea Gold Leaf Tea", "category": "Beverages", "unit": "500 g", "price": Decimal("280.00"), "stock": 35},
            {"name": "Haldiram Classic Bhujia", "category": "Snacks", "unit": "400 g", "price": Decimal("95.00"), "stock": 50},
            {"name": "India Gate Basmati Rice", "category": "Groceries", "unit": "1 kg", "price": Decimal("110.00"), "stock": 20},
            {"name": "Amul Pure Cow Ghee", "category": "Dairy", "unit": "1 Litre", "price": Decimal("590.00"), "stock": 15},
            {"name": "Britannia 100% Whole Wheat Bread", "category": "Bakery", "unit": "400 g", "price": Decimal("45.00"), "stock": 12},
            {"name": "Cadbury Dairy Milk Silk", "category": "Snacks", "unit": "150 g", "price": Decimal("175.00"), "stock": 28},
            {"name": "Dettol Original Liquid Handwash", "category": "Personal Care", "unit": "900 ml", "price": Decimal("140.00"), "stock": 22},
            {"name": "Farm Fresh Red Onions", "category": "Vegetables", "unit": "1 kg", "price": Decimal("38.00"), "stock": 50},
        ]

        created_products = []
        for pdata in products_data:
            prod = db.query(Product).filter(Product.shop_id == shop.id, Product.name == pdata["name"]).first()
            if not prod:
                prod = Product(
                    shop_id=shop.id,
                    name=pdata["name"],
                    category=pdata["category"],
                    unit=pdata["unit"],
                    price=pdata["price"],
                    is_active=True,
                )
                db.add(prod)
                db.commit()
                db.refresh(prod)

            inv = db.query(Inventory).filter(Inventory.shop_id == shop.id, Inventory.product_id == prod.id).first()
            if not inv:
                inv = Inventory(
                    shop_id=shop.id,
                    product_id=prod.id,
                    stock_quantity=pdata["stock"],
                    is_active=True,
                )
                db.add(inv)
                db.commit()

            created_products.append(prod)

        print(f"Catalog & Inventory initialized with {len(created_products)} active products.")

        # 6. Credit Account (Khata)
        credit_acc = db.query(CreditAccount).filter(
            CreditAccount.customer_id == customer.id,
            CreditAccount.shop_id == shop.id,
        ).first()

        if not credit_acc:
            credit_acc = CreditAccount(
                customer_id=customer.id,
                shop_id=shop.id,
                credit_limit=Decimal("5000.00"),
                outstanding_amount=Decimal("1450.00"),
                status="APPROVED",
                is_active=True,
            )
            db.add(credit_acc)
            db.commit()
            db.refresh(credit_acc)
            print(f"Created Khata Account: Limit Rs. {credit_acc.credit_limit}, Outstanding Rs. {credit_acc.outstanding_amount}")

            tx1 = CreditTransaction(
                credit_account_id=credit_acc.id,
                transaction_type="CREDIT_PURCHASE",
                amount=Decimal("850.00"),
                balance_after=Decimal("850.00"),
                description="Grocery Order #1001",
            )
            tx2 = CreditTransaction(
                credit_account_id=credit_acc.id,
                transaction_type="CREDIT_PURCHASE",
                amount=Decimal("600.00"),
                balance_after=Decimal("1450.00"),
                description="Atta & Ghee Purchase #1002",
            )
            db.add_all([tx1, tx2])
            db.commit()
        else:
            print("Credit Account already exists.")

        # 7. Sample Orders
        sample_order = db.query(Order).filter(Order.customer_id == customer.id).first()
        if not sample_order:
            order1 = Order(
                customer_id=customer.id,
                shop_id=shop.id,
                total_amount=Decimal("444.00"),
                status="PROCESSING",
            )
            db.add(order1)
            db.commit()
            db.refresh(order1)

            if len(created_products) >= 3:
                oi1 = OrderItem(order_id=order1.id, product_id=created_products[0].id, quantity=1, unit_price=created_products[0].price)
                oi2 = OrderItem(order_id=order1.id, product_id=created_products[1].id, quantity=2, unit_price=created_products[1].price)
                oi3 = OrderItem(order_id=order1.id, product_id=created_products[5].id, quantity=1, unit_price=created_products[5].price)
                db.add_all([oi1, oi2, oi3])
                db.commit()

            print(f"Created Sample Order #{order1.id} (Status: {order1.status})")

        # 8. Sample Notifications
        sample_notif = db.query(Notification).filter(Notification.user_id == customer_user.id).first()
        if not sample_notif:
            n1 = Notification(
                user_id=customer_user.id,
                type="SYSTEM",
                title="Welcome to Fresh Mart!",
                message="Your digital khata book is activated with Rs. 5,000 monthly credit limit.",
                is_read=False,
            )
            n2 = Notification(
                user_id=customer_user.id,
                type="ORDER",
                title="Order #1001 In Progress",
                message="Fresh Mart has accepted your grocery order and is packing it.",
                is_read=False,
            )
            db.add_all([n1, n2])
            db.commit()
            print("Created sample customer notifications.")

        print("\nDatabase seed completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
