# Backend Routes Package
# This module provides the router structure for modular route organization
# Routes are being incrementally migrated from server.py

from fastapi import APIRouter

# Create a master router to aggregate all sub-routers
api_router = APIRouter()

# Import and include route modules
from .jobs import router as jobs_router
from .customers import router as customers_router
from .technicians import router as technicians_router
from .scheduling import router as scheduling_router
from .financials import router as financials_router
from .leads import router as leads_router
from .inventory import router as inventory_router

# Include routers - these will be mounted under /api/v2/
api_router.include_router(jobs_router)
api_router.include_router(customers_router)
api_router.include_router(technicians_router)
api_router.include_router(scheduling_router)
api_router.include_router(financials_router)
api_router.include_router(leads_router)
api_router.include_router(inventory_router)

# Future route modules (uncomment as migrated):
# from .auth import router as auth_router
# from .integrations import router as integrations_router
# from .reports import router as reports_router
# from .settings import router as settings_router
# from .projects import router as projects_router

__all__ = ["api_router"]
