from sqlalchemy import text
from app.database import engine

def wipe_all_database_data():
    print("Fetching all tables in public schema to truncate...")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"))
        tables = [row[0] for row in result.fetchall()]

    print(f"Found {len(tables)} tables: {tables}")
    for tbl in tables:
        with engine.begin() as conn:
            try:
                conn.execute(text(f'TRUNCATE TABLE "{tbl}" RESTART IDENTITY CASCADE;'))
                print(f"  [x] Successfully truncated table: {tbl}")
            except Exception as e:
                print(f"  [-] Error truncating {tbl}: {e}")

    print("\n>>> ALL DATABASE TABLES FULLY WIPED & IDENTITIES RESET TO 1! <<<")

if __name__ == "__main__":
    wipe_all_database_data()
