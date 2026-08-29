from sqlalchemy import text
from app.database import engine

def wipe():
    tables = [
        "credit_ledger",
        "credit_payments",
        "credit_transactions",
        "credit_accounts",
        "credit_requests",
        "monthly_settlements",
        "cart_items",
        "carts",
        "substitution_requests",
        "notifications",
        "order_items",
        "orders",
        "inventory",
        "payments",
        "purchase_items",
        "purchases",
        "products",
        "shop_customers",
        "shops",
        "customers",
        "addresses",
        "users",
    ]
    with engine.begin() as conn:
        for t in tables:
            try:
                conn.execute(text(f'TRUNCATE TABLE "{t}" RESTART IDENTITY CASCADE;'))
                print(f"Truncated {t}")
            except Exception as e:
                print(f"Error {t}: {e}")
    print("ALL TABLES WIPED SUCCESSFULLY")

if __name__ == "__main__":
    wipe()
