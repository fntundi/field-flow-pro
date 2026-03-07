# Backend Routes Package
# This module provides the router structure for modular route organization
# Routes have been migrated from the monolithic server.py

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
from .tasks import router as tasks_router
from .sites import router as sites_router
from .vendors import router as vendors_router
from .voip import router as voip_router
from .reports import router as reports_router
from .settings import router as settings_router
from .projects import router as projects_router
from .integrations import router as integrations_router

# Include routers - these will be mounted under /api/v2/ (temporary) or /api/ (final)
api_router.include_router(jobs_router)
api_router.include_router(customers_router)
api_router.include_router(technicians_router)
api_router.include_router(scheduling_router)
api_router.include_router(financials_router)
api_router.include_router(leads_router)
api_router.include_router(inventory_router)
api_router.include_router(tasks_router)
api_router.include_router(sites_router)
api_router.include_router(vendors_router)
api_router.include_router(voip_router)
api_router.include_router(reports_router)
api_router.include_router(settings_router)
api_router.include_router(projects_router)
api_router.include_router(integrations_router)

__all__ = ["api_router"]
