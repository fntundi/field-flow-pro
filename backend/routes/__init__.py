# Backend Routes Package
# This module provides the router structure for modular route organization
# Routes are being incrementally migrated from server.py

from fastapi import APIRouter

# Create a master router to aggregate all sub-routers
# Each route module will create its own APIRouter and register it here
api_router = APIRouter()

# Import and include route modules as they are migrated
# Uncomment each line as the module is completed and tested

# from .jobs import router as jobs_router
# from .customers import router as customers_router
# from .technicians import router as technicians_router
# from .scheduling import router as scheduling_router
# from .financials import router as financials_router
# from .inventory import router as inventory_router
# from .leads import router as leads_router
# from .integrations import router as integrations_router
# from .reports import router as reports_router
# from .settings import router as settings_router
# from .projects import router as projects_router
# from .auth import router as auth_router

# Include routers with tags for documentation
# api_router.include_router(jobs_router, tags=["Jobs"])
# api_router.include_router(customers_router, tags=["Customers"])
# etc.

__all__ = ["api_router"]
