# Inventory Routes - Migrated from server.py
# Handles Inventory, Trucks, Stock Checks, and Restock Requests per RFC-002

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
import uuid as uuid_module

from .shared import (
    get_database, sanitize_string, validate_uuid, logger
)

# Create router for inventory
router = APIRouter(prefix="/inventory", tags=["Inventory"])

# Get database instance
db = get_database()


# ==================== INVENTORY CATEGORIES ====================

@router.get("/categories")
async def get_inventory_categories():
    """Get all inventory categories"""
    categories = await db.inventory_categories.find().to_list(100)
    for cat in categories:
        cat.pop("_id", None)
    return categories


@router.post("/categories")
async def create_inventory_category(data: dict):
    """Create an inventory category"""
    from models import InventoryCategory
    
    category = InventoryCategory(
        name=sanitize_string(data.get("name", ""), 100),
        description=sanitize_string(data.get("description"), 500) if data.get("description") else None,
        parent_category_id=data.get("parent_category_id"),
    )
    await db.inventory_categories.insert_one(category.dict())
    result = category.dict()
    return result


@router.delete("/categories/{category_id}")
async def delete_inventory_category(category_id: str):
    """Delete an inventory category"""
    if not validate_uuid(category_id):
        raise HTTPException(status_code=400, detail="Invalid category ID")
    
    # Check if category has items
    item_count = await db.inventory_items.count_documents({"category_id": category_id})
    if item_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete category with {item_count} items. Move or delete items first.")
    
    result = await db.inventory_categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}


# ==================== INVENTORY ITEMS ====================

@router.get("/items")
async def get_inventory_items(
    category_id: Optional[str] = None,
    low_stock: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=1000)
):
    """Get all inventory items"""
    query = {}
    if category_id:
        query["category_id"] = category_id
    if low_stock:
        query["$expr"] = {"$lte": ["$quantity_on_hand", "$reorder_point"]}
    if search:
        safe_search = sanitize_string(search, 100)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"sku": {"$regex": safe_search, "$options": "i"}},
            {"part_number": {"$regex": safe_search, "$options": "i"}},
        ]
    
    items = await db.inventory_items.find(query).limit(limit).to_list(limit)
    for item in items:
        item.pop("_id", None)
    return items


@router.get("/items/{item_id}")
async def get_inventory_item(item_id: str):
    """Get a specific inventory item"""
    item = await db.inventory_items.find_one({"$or": [{"id": item_id}, {"sku": item_id}]})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.pop("_id", None)
    return item


@router.post("/items")
async def create_inventory_item(data: dict):
    """Create an inventory item"""
    from models import InventoryItem
    
    item = InventoryItem(
        sku=sanitize_string(data.get("sku"), 50) or f"SKU-{str(uuid_module.uuid4())[:8].upper()}",
        part_number=sanitize_string(data.get("part_number"), 50) if data.get("part_number") else None,
        name=sanitize_string(data.get("name", ""), 200),
        description=sanitize_string(data.get("description"), 500) if data.get("description") else None,
        category_id=data.get("category_id"),
        unit_of_measure=data.get("unit_of_measure", "each"),
        cost=data.get("cost", 0),
        retail_price=data.get("retail_price", 0),
        quantity_on_hand=data.get("quantity_on_hand", 0),
        reorder_point=data.get("reorder_point", 5),
        reorder_quantity=data.get("reorder_quantity", 10),
        preferred_vendor_id=data.get("preferred_vendor_id"),
    )
    await db.inventory_items.insert_one(item.dict())
    result = item.dict()
    return result


@router.put("/items/{item_id}")
async def update_inventory_item(item_id: str, data: dict):
    """Update an inventory item"""
    item = await db.inventory_items.find_one({"$or": [{"id": item_id}, {"sku": item_id}]})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    update_data = {}
    allowed_fields = ["name", "description", "category_id", "unit_of_measure", "cost", 
                      "retail_price", "quantity_on_hand", "reorder_point", "reorder_quantity",
                      "preferred_vendor_id", "part_number"]
    
    for k, v in data.items():
        if k in allowed_fields and v is not None:
            if isinstance(v, str):
                update_data[k] = sanitize_string(v, 500)
            else:
                update_data[k] = v
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.inventory_items.update_one({"id": item["id"]}, {"$set": update_data})
    updated = await db.inventory_items.find_one({"id": item["id"]})
    updated.pop("_id", None)
    return updated


@router.delete("/items/{item_id}")
async def delete_inventory_item(item_id: str):
    """Delete an inventory item"""
    result = await db.inventory_items.delete_one({"$or": [{"id": item_id}, {"sku": item_id}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}


# ==================== TRUCKS ====================

@router.get("/trucks")
async def get_trucks(status: Optional[str] = None):
    """Get all trucks"""
    query = {}
    if status:
        query["status"] = status
    
    trucks = await db.trucks.find(query).to_list(100)
    for truck in trucks:
        truck.pop("_id", None)
    return trucks


@router.get("/trucks/{truck_id}")
async def get_truck(truck_id: str):
    """Get a specific truck"""
    truck = await db.trucks.find_one({"$or": [{"id": truck_id}, {"truck_number": truck_id}]})
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    truck.pop("_id", None)
    return truck


@router.post("/trucks")
async def create_truck(data: dict):
    """Create a truck"""
    from models import Truck
    
    count = await db.trucks.count_documents({})
    
    truck = Truck(
        truck_number=sanitize_string(data.get("truck_number"), 20) or f"TRK-{count + 101}",
        make=sanitize_string(data.get("make"), 50) if data.get("make") else None,
        model=sanitize_string(data.get("model"), 50) if data.get("model") else None,
        year=data.get("year"),
        vin=sanitize_string(data.get("vin"), 20) if data.get("vin") else None,
        license_plate=sanitize_string(data.get("license_plate"), 20) if data.get("license_plate") else None,
        assigned_technician_id=data.get("assigned_technician_id"),
    )
    
    # Get technician name
    if data.get("assigned_technician_id"):
        tech = await db.technicians.find_one({"id": data["assigned_technician_id"]})
        if tech:
            truck.assigned_technician_name = tech["name"]
    
    await db.trucks.insert_one(truck.dict())
    result = truck.dict()
    return result


@router.put("/trucks/{truck_id}")
async def update_truck(truck_id: str, data: dict):
    """Update a truck"""
    truck = await db.trucks.find_one({"$or": [{"id": truck_id}, {"truck_number": truck_id}]})
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    update_data = {}
    allowed_fields = ["make", "model", "year", "vin", "license_plate", "status", "assigned_technician_id"]
    
    for k, v in data.items():
        if k in allowed_fields and v is not None:
            if isinstance(v, str):
                update_data[k] = sanitize_string(v, 100)
            else:
                update_data[k] = v
    
    # Update technician name if ID changed
    if "assigned_technician_id" in update_data:
        tech = await db.technicians.find_one({"id": update_data["assigned_technician_id"]})
        update_data["assigned_technician_name"] = tech["name"] if tech else None
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.trucks.update_one({"id": truck["id"]}, {"$set": update_data})
    updated = await db.trucks.find_one({"id": truck["id"]})
    updated.pop("_id", None)
    return updated


@router.get("/trucks/by-technician/{technician_id}")
async def get_truck_by_technician(technician_id: str):
    """Get truck assigned to a technician"""
    if not validate_uuid(technician_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID")
    
    truck = await db.trucks.find_one({"assigned_technician_id": technician_id})
    if not truck:
        raise HTTPException(status_code=404, detail="No truck assigned to this technician")
    truck.pop("_id", None)
    return truck


# ==================== TRUCK INVENTORY ====================

@router.get("/truck-inventory/{truck_id}")
async def get_truck_inventory(truck_id: str):
    """Get inventory for a specific truck"""
    inventory = await db.truck_inventory.find_one({"truck_id": truck_id})
    if not inventory:
        return {"truck_id": truck_id, "items": [], "message": "No inventory record for this truck"}
    inventory.pop("_id", None)
    return inventory


@router.put("/truck-inventory/{truck_id}/items")
async def update_truck_inventory(truck_id: str, data: dict):
    """Update truck inventory items"""
    from models import TruckInventoryItem
    
    items = data.get("items", [])
    inventory_items = []
    
    for item_data in items:
        item = TruckInventoryItem(
            item_id=item_data["item_id"],
            sku=item_data.get("sku"),
            name=item_data.get("name"),
            quantity_on_truck=item_data.get("quantity_on_truck", 0),
            minimum_stock=item_data.get("minimum_stock", 1),
            maximum_stock=item_data.get("maximum_stock", 10),
        )
        inventory_items.append(item.dict())
    
    await db.truck_inventory.update_one(
        {"truck_id": truck_id},
        {"$set": {
            "items": inventory_items,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    updated = await db.truck_inventory.find_one({"truck_id": truck_id})
    updated.pop("_id", None)
    return updated


@router.post("/truck-inventory/{truck_id}/add-item")
async def add_truck_inventory_item(truck_id: str, data: dict):
    """Add or update a single item in truck inventory"""
    from models import TruckInventoryItem
    
    inventory = await db.truck_inventory.find_one({"truck_id": truck_id})
    
    new_item = TruckInventoryItem(
        item_id=data["item_id"],
        sku=data.get("sku"),
        name=data.get("name"),
        quantity_on_truck=data.get("quantity_on_truck", 0),
        minimum_stock=data.get("minimum_stock", 1),
        maximum_stock=data.get("maximum_stock", 10),
    )
    
    if inventory:
        items = inventory.get("items", [])
        # Check if item already exists
        item_exists = False
        for i, item in enumerate(items):
            if item["item_id"] == data["item_id"]:
                items[i] = new_item.dict()
                item_exists = True
                break
        
        if not item_exists:
            items.append(new_item.dict())
        
        await db.truck_inventory.update_one(
            {"truck_id": truck_id},
            {"$set": {"items": items, "updated_at": datetime.now(timezone.utc)}}
        )
    else:
        await db.truck_inventory.insert_one({
            "truck_id": truck_id,
            "items": [new_item.dict()],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        })
    
    return {"message": "Item added to truck inventory"}


# ==================== STOCK CHECKS ====================

@router.get("/stock-checks")
async def get_stock_checks(
    truck_id: Optional[str] = None,
    technician_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200)
):
    """Get stock check records"""
    query = {}
    if truck_id:
        query["truck_id"] = truck_id
    if technician_id:
        query["technician_id"] = technician_id
    if status:
        query["status"] = status
    
    checks = await db.stock_checks.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for check in checks:
        check.pop("_id", None)
    return checks


@router.post("/stock-checks")
async def create_stock_check(data: dict):
    """Create a stock check record"""
    from models import TruckStockCheck
    
    check = TruckStockCheck(
        truck_id=data["truck_id"],
        technician_id=data.get("technician_id"),
        check_type=data.get("check_type", "daily"),
        items_checked=data.get("items_checked", []),
        discrepancies=data.get("discrepancies", []),
        notes=sanitize_string(data.get("notes"), 1000) if data.get("notes") else None,
        status="completed" if not data.get("discrepancies") else "discrepancies_found",
    )
    await db.stock_checks.insert_one(check.dict())
    result = check.dict()
    return result


@router.get("/stock-checks/required/{technician_id}")
async def check_stock_check_required(technician_id: str):
    """Check if a stock check is required for a technician"""
    if not validate_uuid(technician_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID")
    
    # Find technician's truck
    truck = await db.trucks.find_one({"assigned_technician_id": technician_id})
    if not truck:
        return {"required": False, "reason": "No truck assigned"}
    
    # Check for today's stock check
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing_check = await db.stock_checks.find_one({
        "truck_id": truck["id"],
        "technician_id": technician_id,
        "created_at": {"$gte": datetime.fromisoformat(f"{today}T00:00:00+00:00")}
    })
    
    if existing_check:
        return {"required": False, "reason": "Already completed today", "check_id": existing_check["id"]}
    
    return {"required": True, "truck_id": truck["id"], "truck_number": truck["truck_number"]}


# ==================== RESTOCK REQUESTS ====================

@router.get("/restock-requests")
async def get_restock_requests(
    status: Optional[str] = None,
    truck_id: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    """Get restock requests"""
    query = {}
    if status:
        query["status"] = status
    if truck_id:
        query["truck_id"] = truck_id
    
    requests = await db.restock_requests.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for req in requests:
        req.pop("_id", None)
    return requests


@router.post("/restock-requests")
async def create_restock_request(data: dict):
    """Create a restock request"""
    from models import RestockRequest
    
    request = RestockRequest(
        truck_id=data["truck_id"],
        technician_id=data.get("technician_id"),
        items=data.get("items", []),
        priority=data.get("priority", "normal"),
        notes=sanitize_string(data.get("notes"), 1000) if data.get("notes") else None,
    )
    await db.restock_requests.insert_one(request.dict())
    result = request.dict()
    return result


@router.put("/restock-requests/{request_id}/status")
async def update_restock_request_status(request_id: str, data: dict):
    """Update restock request status"""
    if not validate_uuid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    request = await db.restock_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Restock request not found")
    
    status = data.get("status")
    update_data = {
        "status": status,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if status == "approved":
        update_data["approved_by_id"] = data.get("approved_by_id")
        update_data["approved_at"] = datetime.now(timezone.utc)
    elif status == "fulfilled":
        update_data["fulfilled_at"] = datetime.now(timezone.utc)
    
    await db.restock_requests.update_one({"id": request_id}, {"$set": update_data})
    return {"message": f"Restock request status updated to {status}"}


# ==================== INVENTORY TRANSFERS ====================

@router.get("/transfers")
async def get_inventory_transfers(
    status: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    """Get inventory transfers"""
    query = {}
    if status:
        query["status"] = status
    
    transfers = await db.inventory_transfers.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for transfer in transfers:
        transfer.pop("_id", None)
    return transfers


@router.post("/transfers")
async def create_inventory_transfer(data: dict):
    """Create an inventory transfer"""
    from models import InventoryTransfer
    
    transfer = InventoryTransfer(
        from_location_type=data.get("from_location_type", "warehouse"),
        from_location_id=data.get("from_location_id"),
        to_location_type=data.get("to_location_type", "truck"),
        to_location_id=data.get("to_location_id"),
        items=data.get("items", []),
        requested_by_id=data.get("requested_by_id"),
        notes=sanitize_string(data.get("notes"), 1000) if data.get("notes") else None,
    )
    await db.inventory_transfers.insert_one(transfer.dict())
    result = transfer.dict()
    return result


@router.put("/transfers/{transfer_id}/approve")
async def approve_inventory_transfer(transfer_id: str, data: dict):
    """Approve an inventory transfer"""
    if not validate_uuid(transfer_id):
        raise HTTPException(status_code=400, detail="Invalid transfer ID")
    
    transfer = await db.inventory_transfers.find_one({"id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    await db.inventory_transfers.update_one(
        {"id": transfer_id},
        {"$set": {
            "status": "approved",
            "approved_by_id": data.get("approved_by_id"),
            "approved_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    return {"message": "Transfer approved"}


@router.put("/transfers/{transfer_id}/receive")
async def receive_inventory_transfer(transfer_id: str, data: dict):
    """Mark an inventory transfer as received"""
    if not validate_uuid(transfer_id):
        raise HTTPException(status_code=400, detail="Invalid transfer ID")
    
    transfer = await db.inventory_transfers.find_one({"id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    await db.inventory_transfers.update_one(
        {"id": transfer_id},
        {"$set": {
            "status": "received",
            "received_by_id": data.get("received_by_id"),
            "received_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    return {"message": "Transfer received"}


# ==================== AUDIT LOG ====================

@router.get("/audit-log")
async def get_inventory_audit_log(
    item_id: Optional[str] = None,
    location_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    """Get inventory audit log"""
    query = {}
    if item_id:
        query["item_id"] = item_id
    if location_id:
        query["location_id"] = location_id
    if action:
        query["action"] = action
    
    logs = await db.inventory_audit_log.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for log in logs:
        log.pop("_id", None)
    return logs
