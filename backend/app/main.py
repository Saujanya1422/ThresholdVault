"""ThresholdVault: FastAPI Application Entry Point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import (
    audit,
    auth,
    custodians,
    dashboard,
    demo,
    recovery,
    secrets,
    settings as settings_router,
)
from app.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown hooks."""
    # Ensure database schema is created
    Base.metadata.create_all(bind=engine)
    # Automatically seed demonstration data if database is fresh
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="ThresholdVault API",
    description=(
        "Institutional Cryptographic Key Custody and Recovery System. "
        "Demonstrates threshold secret sharing over Galois Field GF(2^8) "
        "with multi-custodian quorum workflows and tamper-evident audit logging."
    ),
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local prototype demo convenience
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)
app.include_router(secrets.router, prefix=settings.API_V1_PREFIX)
app.include_router(custodians.router, prefix=settings.API_V1_PREFIX)
app.include_router(recovery.router, prefix=settings.API_V1_PREFIX)
app.include_router(audit.router, prefix=settings.API_V1_PREFIX)
app.include_router(settings_router.router, prefix=settings.API_V1_PREFIX)
app.include_router(demo.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    return {
        "project": "ThresholdVault",
        "description": "Institutional Cryptographic Key Custody and Recovery Prototype",
        "version": settings.VERSION,
        "status": "OPERATIONAL",
        "crypto_engine": "Shamir Secret Sharing over GF(2^8)",
        "docs_url": "/docs",
    }
