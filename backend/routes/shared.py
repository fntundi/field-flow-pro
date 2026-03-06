# Shared utilities, database connection, and dependencies for all routes

import os
import re
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
import jwt

# Logger setup
logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer(auto_error=False)

# Database connection (singleton)
_db_client = None
_db = None

def get_database():
    """Get database connection - creates connection on first call"""
    global _db_client, _db
    if _db is None:
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "field_service_db")
        _db_client = AsyncIOMotorClient(mongo_url)
        _db = _db_client[db_name]
    return _db

# Shorthand for getting db
db = property(lambda self: get_database())

# Make db accessible as module-level variable
def __getattr__(name):
    if name == "db":
        return get_database()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

# Input sanitization
def sanitize_string(value: Optional[str], max_length: int = 1000) -> Optional[str]:
    """Sanitize string input to prevent injection attacks"""
    if value is None:
        return None
    # Remove any potential script tags or SQL injection patterns
    value = re.sub(r'<script[^>]*>.*?</script>', '', value, flags=re.IGNORECASE | re.DOTALL)
    value = re.sub(r'[;\'"\\]', '', value)
    return value[:max_length].strip()

def sanitize_search_query(query: str) -> str:
    """Sanitize search query for MongoDB regex"""
    if not query:
        return query
    # Escape special regex characters
    return re.escape(sanitize_string(query, 200))

def validate_uuid(value: str) -> bool:
    """Validate UUID format"""
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError):
        return False

# JWT Token utilities
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=JWT_EXPIRATION_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# Authentication dependencies
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current authenticated user from JWT token"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return payload

async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[dict]:
    """Get current user if authenticated, None otherwise"""
    if not credentials:
        return None
    return decode_token(credentials.credentials)

# Role-based access control
def require_role(allowed_roles: List[str]):
    """Dependency to require specific roles"""
    async def role_checker(user: dict = Depends(get_current_user)):
        user_role = user.get("role", "")
        if user_role not in allowed_roles and "admin" not in user_role.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user_role}' not authorized for this action"
            )
        return user
    return role_checker
