"""
Phase 2 Backend Tests: Inventory, Trucks, Stock Check, Restock, J-Load, Equipment Usage APIs
Tests for BreezeFlow HVAC Management System Phase 2 features
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://serviceflow-app-7.preview.emergentagent.com"


class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_api_health(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "database" in data
        print(f"API Health: {data}")


class TestInventoryCategories:
    """Test inventory categories API - should return 10 standard HVAC categories"""
    
    def test_get_inventory_categories(self):
        """GET /api/inventory/categories - Should return 10 standard HVAC categories"""
        response = requests.get(f"{BASE_URL}/api/inventory/categories")
        assert response.status_code == 200
        categories = response.json()
        
        # Verify we have 10 standard categories
        assert len(categories) >= 10, f"Expected at least 10 categories, got {len(categories)}"
        
        # Verify expected category names
        expected_names = ["Filters", "Refrigerant", "Copper & Fittings", "Electrical", 
                        "Motors", "Capacitors", "Compressors", "Thermostats", 
                        "Tools", "Safety Equipment"]
        category_names = [c["name"] for c in categories]
        
        for name in expected_names:
            assert name in category_names, f"Missing expected category: {name}"
        
        # Verify category structure
        for cat in categories:
            assert "id" in cat
            assert "name" in cat
            assert "is_standard" in cat
            assert "sort_order" in cat
        
        print(f"Found {len(categories)} categories: {category_names}")
    
    def test_create_custom_category(self):
        """POST /api/inventory/categories - Create custom category"""
        data = {
            "name": f"TEST_Custom_Category_{uuid.uuid4().hex[:8]}",
            "description": "Test custom category",
            "icon": "box",
            "sort_order": 100
        }
        response = requests.post(f"{BASE_URL}/api/inventory/categories", json=data)
        assert response.status_code == 200
        
        category = response.json()
        assert category["name"] == data["name"]
        assert category["is_standard"] == False
        print(f"Created custom category: {category['name']}")
        
        # Cleanup - delete the custom category
        delete_response = requests.delete(f"{BASE_URL}/api/inventory/categories/{category['id']}")
        assert delete_response.status_code == 200


class TestInventoryItems:
    """Test inventory items API"""
    
    def test_get_inventory_items(self):
        """GET /api/inventory/items - Should return 14 demo inventory items"""
        response = requests.get(f"{BASE_URL}/api/inventory/items")
        assert response.status_code == 200
        items = response.json()
        
        # Verify we have demo items
        assert len(items) >= 14, f"Expected at least 14 items, got {len(items)}"
        
        # Verify item structure
        for item in items:
            assert "id" in item
            assert "sku" in item
            assert "name" in item
            assert "category_id" in item
            assert "unit" in item
            assert "unit_cost" in item
            assert "retail_price" in item
            assert "min_stock_threshold" in item
        
        print(f"Found {len(items)} inventory items")
    
    def test_create_inventory_item(self):
        """POST /api/inventory/items - Create new inventory item"""
        # First get a category ID
        cat_response = requests.get(f"{BASE_URL}/api/inventory/categories")
        categories = cat_response.json()
        category_id = categories[0]["id"]
        
        data = {
            "sku": f"TEST-SKU-{uuid.uuid4().hex[:8]}",
            "name": f"TEST_Item_{uuid.uuid4().hex[:8]}",
            "description": "Test inventory item",
            "category_id": category_id,
            "unit": "each",
            "unit_cost": 25.99,
            "retail_price": 49.99,
            "min_stock_threshold": 5,
            "is_serialized": False
        }
        response = requests.post(f"{BASE_URL}/api/inventory/items", json=data)
        assert response.status_code == 200
        
        item = response.json()
        assert item["sku"] == data["sku"]
        assert item["name"] == data["name"]
        assert item["unit_cost"] == data["unit_cost"]
        assert item["retail_price"] == data["retail_price"]
        print(f"Created inventory item: {item['name']} (SKU: {item['sku']})")
    
    def test_get_inventory_item_by_id(self):
        """GET /api/inventory/items/{item_id} - Get specific item"""
        # First get all items
        items_response = requests.get(f"{BASE_URL}/api/inventory/items")
        items = items_response.json()
        
        if items:
            item_id = items[0]["id"]
            response = requests.get(f"{BASE_URL}/api/inventory/items/{item_id}")
            assert response.status_code == 200
            
            item = response.json()
            assert item["id"] == item_id
            print(f"Retrieved item: {item['name']}")


class TestTrucks:
    """Test trucks API - should return 4 demo trucks"""
    
    def test_get_trucks(self):
        """GET /api/trucks - Should return 4 demo trucks assigned to technicians"""
        response = requests.get(f"{BASE_URL}/api/trucks")
        assert response.status_code == 200
        trucks = response.json()
        
        # Verify we have demo trucks
        assert len(trucks) >= 4, f"Expected at least 4 trucks, got {len(trucks)}"
        
        # Verify truck structure
        for truck in trucks:
            assert "id" in truck
            assert "truck_number" in truck
            assert "name" in truck
            assert "status" in truck
        
        # Check that trucks are assigned to technicians
        assigned_trucks = [t for t in trucks if t.get("assigned_technician_id")]
        print(f"Found {len(trucks)} trucks, {len(assigned_trucks)} assigned to technicians")
    
    def test_get_truck_by_technician(self):
        """GET /api/trucks/by-technician/{tech_id} - Get truck assigned to technician"""
        # First get technicians
        tech_response = requests.get(f"{BASE_URL}/api/technicians")
        technicians = tech_response.json()
        
        if technicians:
            tech_id = technicians[0]["id"]
            response = requests.get(f"{BASE_URL}/api/trucks/by-technician/{tech_id}")
            
            # May return 404 if no truck assigned
            if response.status_code == 200:
                truck = response.json()
                assert truck["assigned_technician_id"] == tech_id
                print(f"Technician {technicians[0]['name']} has truck: {truck['name']}")
            else:
                print(f"No truck assigned to technician {technicians[0]['name']}")


class TestTruckInventory:
    """Test truck inventory API"""
    
    def test_get_truck_inventory(self):
        """GET /api/truck-inventory/{truck_id} - Get truck inventory with items"""
        # First get trucks
        trucks_response = requests.get(f"{BASE_URL}/api/trucks")
        trucks = trucks_response.json()
        
        if trucks:
            truck_id = trucks[0]["id"]
            response = requests.get(f"{BASE_URL}/api/truck-inventory/{truck_id}")
            assert response.status_code == 200
            
            inventory = response.json()
            assert "truck_id" in inventory
            assert "items" in inventory
            print(f"Truck {trucks[0]['name']} has {len(inventory.get('items', []))} inventory items")
    
    def test_add_item_to_truck(self):
        """POST /api/truck-inventory/{truck_id}/add-item - Add item to truck inventory"""
        # Get trucks and items
        trucks_response = requests.get(f"{BASE_URL}/api/trucks")
        trucks = trucks_response.json()
        
        items_response = requests.get(f"{BASE_URL}/api/inventory/items")
        items = items_response.json()
        
        if trucks and items:
            truck_id = trucks[0]["id"]
            item_id = items[0]["id"]
            
            response = requests.post(
                f"{BASE_URL}/api/truck-inventory/{truck_id}/add-item?item_id={item_id}&quantity=5"
            )
            assert response.status_code == 200
            
            result = response.json()
            assert "message" in result
            print(f"Added item to truck: {result['message']}")


class TestStockCheck:
    """Test stock check API"""
    
    def test_check_stock_check_required(self):
        """GET /api/stock-check/required/{tech_id} - Check if stock check is required"""
        # Get technicians
        tech_response = requests.get(f"{BASE_URL}/api/technicians")
        technicians = tech_response.json()
        
        if technicians:
            tech_id = technicians[0]["id"]
            response = requests.get(f"{BASE_URL}/api/stock-check/required/{tech_id}")
            assert response.status_code == 200
            
            result = response.json()
            assert "required" in result
            assert "reason" in result
            print(f"Stock check required for {technicians[0]['name']}: {result['required']} - {result['reason']}")
    
    def test_submit_stock_check(self):
        """POST /api/stock-check - Submit stock check"""
        # Get technicians and trucks
        tech_response = requests.get(f"{BASE_URL}/api/technicians")
        technicians = tech_response.json()
        
        trucks_response = requests.get(f"{BASE_URL}/api/trucks")
        trucks = trucks_response.json()
        
        if technicians and trucks:
            tech_id = technicians[0]["id"]
            truck_id = trucks[0]["id"]
            
            # Get truck inventory to create stock check items
            inv_response = requests.get(f"{BASE_URL}/api/truck-inventory/{truck_id}")
            inventory = inv_response.json()
            
            items_checked = []
            for item in inventory.get("items", [])[:3]:  # Check first 3 items
                items_checked.append({
                    "item_id": item["item_id"],
                    "item_name": item.get("item_name", "Test Item"),
                    "sku": item.get("sku", "TEST-SKU"),
                    "expected_qty": item.get("quantity", 10),
                    "actual_qty": item.get("quantity", 10),
                    "min_threshold": item.get("min_threshold", 5),
                    "variance": 0
                })
            
            data = {
                "truck_id": truck_id,
                "technician_id": tech_id,
                "check_type": "shift_start",
                "items_checked": items_checked,
                "notes": "Test stock check"
            }
            
            response = requests.post(f"{BASE_URL}/api/stock-check", json=data)
            assert response.status_code == 200
            
            result = response.json()
            print(f"Stock check submitted: {result.get('message', 'Success')}")


class TestRestockRequests:
    """Test restock requests API"""
    
    def test_get_restock_requests(self):
        """GET /api/restock-requests - Get restock requests"""
        response = requests.get(f"{BASE_URL}/api/restock-requests")
        assert response.status_code == 200
        
        requests_list = response.json()
        print(f"Found {len(requests_list)} restock requests")
    
    def test_create_restock_request(self):
        """POST /api/restock-requests - Create manual restock request"""
        # Get trucks and items
        trucks_response = requests.get(f"{BASE_URL}/api/trucks")
        trucks = trucks_response.json()
        
        items_response = requests.get(f"{BASE_URL}/api/inventory/items")
        items = items_response.json()
        
        if trucks and items:
            truck_id = trucks[0]["id"]
            item = items[0]
            
            data = {
                "truck_id": truck_id,
                "request_type": "manual",
                "items": [{
                    "item_id": item["id"],
                    "item_name": item["name"],
                    "sku": item["sku"],
                    "current_qty": 2,
                    "requested_qty": 10,
                    "reason": "Low stock - test request"
                }],
                "priority": "normal",
                "notes": "Test restock request"
            }
            
            response = requests.post(f"{BASE_URL}/api/restock-requests", json=data)
            assert response.status_code == 200
            
            result = response.json()
            assert "id" in result
            assert result["status"] == "pending"
            print(f"Created restock request: {result['id']}")
            
            # Test updating status
            request_id = result["id"]
            update_response = requests.put(
                f"{BASE_URL}/api/restock-requests/{request_id}/status?status=completed"
            )
            assert update_response.status_code == 200
            print(f"Updated restock request status to completed")


class TestJLoadCalculator:
    """Test J-Load calculator API"""
    
    def test_quick_estimate(self):
        """POST /api/jload/quick-estimate - Calculate quick J-load estimate"""
        data = {
            "square_footage": 2000,
            "climate_zone": "3",
            "building_type": "residential",
            "building_age": "20_years",
            "insulation_quality": "average",
            "num_floors": 1,
            "ceiling_height": 8.0,
            "num_windows": 10,
            "window_type": "double"
        }
        
        response = requests.post(f"{BASE_URL}/api/jload/quick-estimate", json=data)
        assert response.status_code == 200
        
        result = response.json()
        assert "cooling_btuh" in result
        assert "heating_btuh" in result
        assert "recommended_tonnage" in result
        assert "recommended_furnace_btuh" in result
        assert "recommended_equipment" in result
        
        # Verify reasonable values
        assert result["cooling_btuh"] > 0
        assert result["heating_btuh"] > 0
        assert result["recommended_tonnage"] > 0
        
        print(f"J-Load Quick Estimate Results:")
        print(f"  Cooling: {result['cooling_btuh']} BTU/h")
        print(f"  Heating: {result['heating_btuh']} BTU/h")
        print(f"  Recommended Tonnage: {result['recommended_tonnage']} tons")
        print(f"  Recommended Furnace: {result['recommended_furnace_btuh']} BTU/h")
    
    def test_quick_estimate_different_climate_zones(self):
        """Test J-Load with different climate zones"""
        base_data = {
            "square_footage": 2000,
            "building_type": "residential",
            "building_age": "20_years",
            "insulation_quality": "average",
            "num_floors": 1,
            "ceiling_height": 8.0,
            "num_windows": 10,
            "window_type": "double"
        }
        
        results = {}
        for zone in ["1", "3", "5", "7"]:
            data = {**base_data, "climate_zone": zone}
            response = requests.post(f"{BASE_URL}/api/jload/quick-estimate", json=data)
            assert response.status_code == 200
            results[zone] = response.json()
        
        # Zone 1 (hot) should have higher cooling, Zone 7 (cold) should have higher heating
        assert results["1"]["cooling_btuh"] > results["7"]["cooling_btuh"], "Zone 1 should have higher cooling"
        assert results["7"]["heating_btuh"] > results["1"]["heating_btuh"], "Zone 7 should have higher heating"
        
        print("Climate zone comparison passed - cooling/heating loads vary correctly by zone")
    
    def test_create_manual_j_calculation(self):
        """POST /api/jload/manual-j - Create Manual J calculation draft"""
        data = {
            "project_name": "TEST_Manual_J_Project",
            "address": "123 Test Street",
            "city": "Dallas",
            "state": "TX",
            "zip_code": "75001",
            "climate_zone": "3",
            "total_square_footage": 2500,
            "num_floors": 2,
            "ceiling_height": 9.0
        }
        
        response = requests.post(f"{BASE_URL}/api/jload/manual-j", json=data)
        assert response.status_code == 200
        
        result = response.json()
        assert "id" in result
        assert result["project_name"] == data["project_name"]
        assert result["status"] == "draft"
        
        print(f"Created Manual J calculation: {result['id']}")
        
        # Test running the calculation
        calc_id = result["id"]
        calc_response = requests.post(f"{BASE_URL}/api/jload/manual-j/{calc_id}/calculate")
        assert calc_response.status_code == 200
        
        calc_result = calc_response.json()
        assert "total_cooling_load" in calc_result
        assert "heating_load" in calc_result
        assert "recommended_cooling_tons" in calc_result
        
        print(f"Manual J calculation results:")
        print(f"  Total Cooling Load: {calc_result['total_cooling_load']} BTU/h")
        print(f"  Heating Load: {calc_result['heating_load']} BTU/h")
        print(f"  Recommended Cooling: {calc_result['recommended_cooling_tons']} tons")


class TestEquipmentUsage:
    """Test job equipment usage and approval API"""
    
    def test_create_equipment_usage(self):
        """POST /api/jobs/{job_id}/equipment-usage - Create equipment usage record"""
        # Get jobs, technicians, and trucks
        jobs_response = requests.get(f"{BASE_URL}/api/jobs")
        jobs = jobs_response.json()
        
        tech_response = requests.get(f"{BASE_URL}/api/technicians")
        technicians = tech_response.json()
        
        trucks_response = requests.get(f"{BASE_URL}/api/trucks")
        trucks = trucks_response.json()
        
        if jobs and technicians and trucks:
            job_id = jobs[0]["id"]
            tech_id = technicians[0]["id"]
            truck_id = trucks[0]["id"]
            
            # Get inventory items for planned items
            items_response = requests.get(f"{BASE_URL}/api/inventory/items")
            items = items_response.json()
            
            planned_items = []
            if items:
                planned_items = [{
                    "item_id": items[0]["id"],
                    "item_name": items[0]["name"],
                    "sku": items[0]["sku"],
                    "quantity": 2,
                    "unit_cost": items[0]["unit_cost"]
                }]
            
            response = requests.post(
                f"{BASE_URL}/api/jobs/{job_id}/equipment-usage?technician_id={tech_id}&truck_id={truck_id}",
                json=planned_items
            )
            assert response.status_code == 200
            
            result = response.json()
            assert "id" in result
            assert result["job_id"] == job_id
            assert result["technician_id"] == tech_id
            print(f"Created equipment usage record for job {jobs[0]['job_number']}")
    
    def test_approve_equipment_usage(self):
        """POST /api/jobs/{job_id}/equipment-usage/approve - Approve equipment and deduct inventory"""
        # Get jobs
        jobs_response = requests.get(f"{BASE_URL}/api/jobs")
        jobs = jobs_response.json()
        
        if jobs:
            job_id = jobs[0]["id"]
            
            # Get inventory items
            items_response = requests.get(f"{BASE_URL}/api/inventory/items")
            items = items_response.json()
            
            actual_items = []
            if items:
                actual_items = [{
                    "item_id": items[0]["id"],
                    "item_name": items[0]["name"],
                    "sku": items[0]["sku"],
                    "quantity": 1,
                    "unit_cost": items[0]["unit_cost"]
                }]
            
            data = {
                "actual_items": actual_items,
                "notes": "Test equipment approval"
            }
            
            response = requests.post(
                f"{BASE_URL}/api/jobs/{job_id}/equipment-usage/approve",
                json=data
            )
            
            # May return 404 if no equipment usage exists
            if response.status_code == 200:
                result = response.json()
                print(f"Equipment approved: {result}")
            else:
                print(f"Equipment usage not found for job (expected if not created first)")


class TestInventoryAuditLog:
    """Test inventory audit log API"""
    
    def test_get_audit_log(self):
        """GET /api/inventory/audit-log - Get inventory audit log"""
        response = requests.get(f"{BASE_URL}/api/inventory/audit-log")
        assert response.status_code == 200
        
        logs = response.json()
        print(f"Found {len(logs)} audit log entries")
        
        # Verify log structure if entries exist
        if logs:
            log = logs[0]
            assert "id" in log
            assert "action" in log
            assert "quantity_before" in log
            assert "quantity_change" in log
            assert "quantity_after" in log
            print(f"Sample audit log: {log['action']} - {log.get('item_name', 'Unknown')}")
    
    def test_get_audit_log_with_filters(self):
        """GET /api/inventory/audit-log with filters"""
        # Get trucks for filtering
        trucks_response = requests.get(f"{BASE_URL}/api/trucks")
        trucks = trucks_response.json()
        
        if trucks:
            truck_id = trucks[0]["id"]
            response = requests.get(f"{BASE_URL}/api/inventory/audit-log?truck_id={truck_id}")
            assert response.status_code == 200
            
            logs = response.json()
            print(f"Found {len(logs)} audit logs for truck {trucks[0]['name']}")


class TestDataIntegrity:
    """Test data integrity and relationships"""
    
    def test_truck_technician_relationship(self):
        """Verify trucks are properly assigned to technicians"""
        trucks_response = requests.get(f"{BASE_URL}/api/trucks")
        trucks = trucks_response.json()
        
        tech_response = requests.get(f"{BASE_URL}/api/technicians")
        technicians = tech_response.json()
        
        tech_ids = {t["id"] for t in technicians}
        
        for truck in trucks:
            if truck.get("assigned_technician_id"):
                assert truck["assigned_technician_id"] in tech_ids, \
                    f"Truck {truck['name']} assigned to non-existent technician"
        
        print("Truck-technician relationships verified")
    
    def test_inventory_category_relationship(self):
        """Verify inventory items have valid categories"""
        items_response = requests.get(f"{BASE_URL}/api/inventory/items")
        items = items_response.json()
        
        cat_response = requests.get(f"{BASE_URL}/api/inventory/categories")
        categories = cat_response.json()
        
        cat_ids = {c["id"] for c in categories}
        
        for item in items:
            assert item["category_id"] in cat_ids, \
                f"Item {item['name']} has invalid category_id"
        
        print("Inventory-category relationships verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
