from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .models import *
from .database import engine
from .base import Base

from .routers.auth import router as auth_router
from .routers.customer import router as customers_router
from .routers.order import router as orders_router
from .routers.inventory import router as inventory_router
from .routers.product import router as products_router
from .routers.shop import router as shops_router
from .routers.notification import router as notifications_router
from .routers.cart import router as cart_router
from .routers.credit import router as credit_router
from .routers.shopping_list import router as shopping_list_router
from .routers.credit_ledger import router as credit_ledger_router
from .routers.payment import router as payment_router
from .routers.checkout import router as checkout_router
from .routers.credit_account import router as credit_account_router
from .routers.credit_payment import router as credit_payment_router
from .routers.parchi import router as parchi_router


app = FastAPI(
    title="Local Store API",
    description="Backend API for Local Store Khata application",
    version="1.0.0",
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATABASE TABLE CREATION
# ============================================================

@app.on_event("startup")
def on_startup():
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables initialized successfully.")
    except Exception as e:
        print(f"Notice: Initial database connection attempt: {e}")


# ============================================================
# ROUTERS
# ============================================================

app.include_router(auth_router)
app.include_router(customers_router)
app.include_router(orders_router)
app.include_router(inventory_router)
app.include_router(products_router)
app.include_router(shops_router)
app.include_router(notifications_router)
app.include_router(cart_router)
app.include_router(credit_router)
app.include_router(shopping_list_router)
app.include_router(credit_ledger_router)
app.include_router(payment_router)
app.include_router(checkout_router)
app.include_router(credit_account_router)
app.include_router(credit_payment_router)
app.include_router(parchi_router)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "message": "Local Store API is running"
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health_check():

    try:

        with engine.connect() as connection:

            result = connection.execute(
                text("SELECT 1")
            )

            result.scalar()

        return {
            "status": "healthy",
            "database": "connected",
        }

    except Exception as e:

        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
        }