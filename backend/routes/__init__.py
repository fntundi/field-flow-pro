# Backend Routes Package
# This module organizes all API routes into logical groups

from fastapi import APIRouter

# Create the main API router that will be mounted to the app
api_router = APIRouter()

# Import all route modules - they will register their routes with api_router
from . import (
    auth,
    technicians,
    jobs,
    scheduling,
    inventory,
    customers,
    projects,
    financials,
    leads,
    integrations,
    settings,
    reports,
)

# Re-export the api_router for use in server.py
__all__ = ["api_router"]
