# Authentication Routes
# Handles user registration, login, JWT tokens, and Google OAuth

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import bcrypt

from . import api_router
from .shared import (
    get_database, sanitize_string, validate_uuid,
    create_access_token, get_current_user, get_optional_user,
    logger
)
from models import (
    User, UserCreate, UserResponse, TokenResponse,
    PasswordChange,
)

# Get database
db = get_database()

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user: UserCreate):
    """Register a new user"""
    # Check if email exists
    existing = await db.users.find_one({"email": user.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt())
    
    # Create user
    new_user = User(
        email=user.email.lower(),
        password_hash=hashed.decode(),
        name=sanitize_string(user.name, 100),
        role=user.role or "technician",
    )
    
    await db.users.insert_one(new_user.dict())
    
    # Generate token
    token = create_access_token({
        "sub": new_user.id,
        "email": new_user.email,
        "name": new_user.name,
        "role": new_user.role,
    })
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=new_user.id,
            email=new_user.email,
            name=new_user.name,
            role=new_user.role,
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: dict):
    """Login with email and password"""
    email = credentials.get("email", "").lower()
    password = credentials.get("password", "")
    
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check password
    if not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate token
    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "technician"),
    })
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name", ""),
            role=user.get("role", "technician"),
        )
    )

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    user = await db.users.find_one({"id": current_user["sub"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user

@api_router.put("/auth/me")
async def update_me(updates: dict, current_user: dict = Depends(get_current_user)):
    """Update current user profile"""
    allowed_fields = ["name", "phone", "avatar_url"]
    update_data = {k: sanitize_string(v, 200) if isinstance(v, str) else v 
                   for k, v in updates.items() if k in allowed_fields}
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.users.update_one(
            {"id": current_user["sub"]},
            {"$set": update_data}
        )
    
    return {"message": "Profile updated"}

@api_router.post("/auth/change-password")
async def change_password(data: PasswordChange, current_user: dict = Depends(get_current_user)):
    """Change user password"""
    user = await db.users.find_one({"id": current_user["sub"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not bcrypt.checkpw(data.current_password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash new password
    new_hash = bcrypt.hashpw(data.new_password.encode(), bcrypt.gensalt())
    
    await db.users.update_one(
        {"id": current_user["sub"]},
        {"$set": {"password_hash": new_hash.decode(), "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Password changed successfully"}

@api_router.get("/auth/users")
async def get_users(current_user: dict = Depends(get_current_user)):
    """Get all users (admin only)"""
    if current_user.get("role") not in ["admin", "Admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    users = await db.users.find({}).to_list(100)
    for u in users:
        u.pop("_id", None)
        u.pop("password_hash", None)
    return users

@api_router.put("/auth/users/{user_id}/role")
async def update_user_role(user_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Update user role (admin only)"""
    if current_user.get("role") not in ["admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not validate_uuid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    new_role = data.get("role")
    if not new_role:
        raise HTTPException(status_code=400, detail="Role is required")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": new_role, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Role updated"}

# ==================== GOOGLE AUTH ====================

@api_router.post("/auth/google/session")
async def google_session(data: dict):
    """Create or update session from Google OAuth"""
    google_user = data.get("user", {})
    if not google_user:
        raise HTTPException(status_code=400, detail="User data required")
    
    email = google_user.get("email", "").lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    # Check if user exists
    existing = await db.users.find_one({"email": email})
    
    if existing:
        # Update existing user
        await db.users.update_one(
            {"email": email},
            {"$set": {
                "name": google_user.get("name", existing.get("name")),
                "avatar_url": google_user.get("picture"),
                "google_id": google_user.get("sub"),
                "last_login": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }}
        )
        user = await db.users.find_one({"email": email})
    else:
        # Create new user
        user = User(
            email=email,
            password_hash="",  # No password for OAuth users
            name=google_user.get("name", email.split("@")[0]),
            role="technician",
            avatar_url=google_user.get("picture"),
            google_id=google_user.get("sub"),
        )
        await db.users.insert_one(user.dict())
        user = user.dict()
    
    # Generate token
    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "technician"),
    })
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name", ""),
            "role": user.get("role", "technician"),
            "avatar_url": user.get("avatar_url"),
        }
    }

@api_router.post("/auth/google/logout")
async def google_logout(current_user: dict = Depends(get_optional_user)):
    """Logout from Google OAuth session"""
    # In a stateless JWT system, logout is handled client-side
    # But we can track logout for audit purposes
    if current_user:
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user.get("sub"),
            "action": "logout",
            "timestamp": datetime.now(timezone.utc),
        })
    return {"message": "Logged out successfully"}

# ==================== USERS CRUD ====================

@api_router.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate, current_user: dict = Depends(get_current_user)):
    """Create a new user (admin only)"""
    if current_user.get("role") not in ["admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.users.find_one({"email": user.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    hashed = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt())
    new_user = User(
        email=user.email.lower(),
        password_hash=hashed.decode(),
        name=sanitize_string(user.name, 100),
        role=user.role or "technician",
    )
    
    await db.users.insert_one(new_user.dict())
    return UserResponse(**new_user.dict())

@api_router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(get_current_user)):
    """List all users"""
    users = await db.users.find({}).to_list(100)
    return [UserResponse(**{k: v for k, v in u.items() if k != "_id" and k != "password_hash"}) for u in users]

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user by ID"""
    if not validate_uuid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.pop("_id", None)
    user.pop("password_hash", None)
    return UserResponse(**user)
