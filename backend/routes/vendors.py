# Vendors Routes - Migrated from server.py
# Handles Vendors and Purchase Orders per RFC-002

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone

from .shared import (
    get_database, sanitize_string, sanitize_search_query, validate_uuid, logger
)

# Create router for vendors
router = APIRouter(prefix="/vendors", tags=["Vendors"])

# Get database instance
db = get_database()


# ==================== VENDORS ====================

@router.get("")
async def get_vendors(active_only: bool = True, search: Optional[str] = None):
    """Get all vendors"""
    query = {}
    if active_only:
        query["is_active"] = True
    if search:
        safe_search = sanitize_search_query(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"vendor_number": {"$regex": safe_search, "$options": "i"}},
        ]
    
    vendors = await db.vendors.find(query).sort("name", 1).to_list(500)
    for v in vendors:
        v.pop("_id", None)
    return vendors


@router.get("/{vendor_id}")
async def get_vendor(vendor_id: str):
    """Get a specific vendor"""
    vendor = await db.vendors.find_one({"$or": [{"id": vendor_id}, {"vendor_number": vendor_id}]})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    vendor.pop("_id", None)
    return vendor


@router.post("")
async def create_vendor(data: dict):
    """Create a new vendor"""
    from models import Vendor
    
    vendor = Vendor(
        name=sanitize_string(data.get("name", ""), 200),
        contact_name=sanitize_string(data.get("contact_name"), 100) if data.get("contact_name") else None,
        email=sanitize_string(data.get("email"), 255) if data.get("email") else None,
        phone=sanitize_string(data.get("phone"), 20) if data.get("phone") else None,
        address=sanitize_string(data.get("address"), 500) if data.get("address") else None,
        city=sanitize_string(data.get("city"), 100) if data.get("city") else None,
        state=sanitize_string(data.get("state"), 50) if data.get("state") else None,
        zip_code=sanitize_string(data.get("zip_code"), 20) if data.get("zip_code") else None,
        payment_terms=data.get("payment_terms", "net30"),
        account_number=sanitize_string(data.get("account_number"), 50) if data.get("account_number") else None,
        notes=sanitize_string(data.get("notes"), 2000) if data.get("notes") else None,
    )
    await db.vendors.insert_one(vendor.dict())
    result = vendor.dict()
    return result


@router.put("/{vendor_id}")
async def update_vendor(vendor_id: str, data: dict):
    """Update a vendor"""
    vendor = await db.vendors.find_one({"$or": [{"id": vendor_id}, {"vendor_number": vendor_id}]})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    update_data = {k: v for k, v in data.items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.vendors.update_one({"id": vendor["id"]}, {"$set": update_data})
    updated = await db.vendors.find_one({"id": vendor["id"]})
    updated.pop("_id", None)
    return updated


@router.delete("/{vendor_id}")
async def delete_vendor(vendor_id: str):
    """Soft delete a vendor"""
    vendor = await db.vendors.find_one({"$or": [{"id": vendor_id}, {"vendor_number": vendor_id}]})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    await db.vendors.update_one(
        {"id": vendor["id"]},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Vendor deleted"}


# ==================== PURCHASE ORDERS ====================

@router.get("/purchase-orders/list")
async def get_purchase_orders(
    status: Optional[str] = None,
    vendor_id: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    """Get all purchase orders"""
    query = {}
    if status:
        query["status"] = status
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    pos = await db.purchase_orders.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for po in pos:
        po.pop("_id", None)
    return pos


@router.get("/purchase-orders/{po_id}")
async def get_purchase_order(po_id: str):
    """Get a specific purchase order"""
    po = await db.purchase_orders.find_one({"$or": [{"id": po_id}, {"po_number": po_id}]})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    po.pop("_id", None)
    return po


@router.post("/purchase-orders")
async def create_purchase_order(data: dict):
    """Create a new purchase order"""
    from models import PurchaseOrder, PurchaseOrderLineItem
    
    vendor = await db.vendors.find_one({"id": data.get("vendor_id")})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Build line items
    line_items = []
    subtotal = 0
    for item_data in data.get("line_items", []):
        item = await db.inventory_items.find_one({"id": item_data.get("item_id")})
        if item:
            line_item = PurchaseOrderLineItem(
                item_id=item["id"],
                item_name=item["name"],
                sku=item["sku"],
                quantity_ordered=item_data.get("quantity_ordered", 1),
                unit=item.get("unit_of_measure", "each"),
                unit_cost=item_data.get("unit_cost", item.get("cost", 0)),
            )
            line_item.extended_cost = line_item.quantity_ordered * line_item.unit_cost
            subtotal += line_item.extended_cost
            line_items.append(line_item)
    
    # Get location name
    location_name = None
    if data.get("receive_to_location_id"):
        location = await db.warehouses.find_one({"id": data["receive_to_location_id"]})
        if not location:
            truck = await db.trucks.find_one({"id": data["receive_to_location_id"]})
            location = truck
        location_name = location.get("name") if location else None
    
    po = PurchaseOrder(
        vendor_id=data.get("vendor_id"),
        vendor_name=vendor["name"],
        line_items=[li.dict() for li in line_items],
        subtotal=subtotal,
        total=subtotal,
        expected_date=data.get("expected_date"),
        receive_to_location_id=data.get("receive_to_location_id"),
        receive_to_location_name=location_name,
        job_id=data.get("job_id"),
        notes=sanitize_string(data.get("notes"), 2000) if data.get("notes") else None,
    )
    await db.purchase_orders.insert_one(po.dict())
    result = po.dict()
    return result


@router.put("/purchase-orders/{po_id}/status")
async def update_po_status(po_id: str, data: dict):
    """Update purchase order status"""
    po = await db.purchase_orders.find_one({"$or": [{"id": po_id}, {"po_number": po_id}]})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    status = data.get("status")
    update_data = {
        "status": status,
        "status_changed_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    if status == "submitted":
        update_data["order_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    elif status == "received":
        update_data["received_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    await db.purchase_orders.update_one({"id": po["id"]}, {"$set": update_data})
    return {"message": f"PO status updated to {status}"}
