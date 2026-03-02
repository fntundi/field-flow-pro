"""
Test suite for Job Chat and Multi-Warehouse Inventory APIs
Tests: Chat messages (internal/customer channels), Inventory locations, stock, and transfers
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token via demo login"""
    # Demo admin credentials
    demo_email = "demo-admin@breezeflow.com"
    demo_password = "demo123"
    
    # Try to login first
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": demo_email,
        "password": demo_password
    })
    
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    
    # If login fails, try to register first
    register_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
        "email": demo_email,
        "password": demo_password,
        "name": "Demo Admin",
        "role": "admin"
    })
    
    if register_response.status_code == 200:
        data = register_response.json()
        return data.get("token")
    
    # Try login again after registration
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": demo_email,
        "password": demo_password
    })
    
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    
    pytest.skip("Authentication failed - skipping authenticated tests")

@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client

@pytest.fixture(scope="module")
def test_job_id(authenticated_client):
    """Get a valid job ID for testing chat"""
    response = authenticated_client.get(f"{BASE_URL}/api/jobs")
    if response.status_code == 200:
        jobs = response.json()
        if jobs and len(jobs) > 0:
            return jobs[0].get("id")
    # Create a test job if none exist
    job_data = {
        "customer_id": str(uuid.uuid4()),
        "customer_name": "TEST_Chat Customer",
        "job_type": "service",
        "status": "scheduled",
        "priority": "normal",
        "description": "Test job for chat testing"
    }
    response = authenticated_client.post(f"{BASE_URL}/api/jobs", json=job_data)
    if response.status_code in [200, 201]:
        return response.json().get("id")
    pytest.skip("Could not get or create a job for chat testing")


# ==================== CHAT API TESTS ====================

class TestChatMessages:
    """Job Chat message endpoint tests"""
    
    def test_get_internal_messages_empty(self, authenticated_client, test_job_id):
        """GET /api/jobs/{job_id}/chat/internal/messages - should return empty or messages list"""
        response = authenticated_client.get(f"{BASE_URL}/api/jobs/{test_job_id}/chat/internal/messages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Internal messages count: {len(data)}")
    
    def test_get_customer_messages_empty(self, authenticated_client, test_job_id):
        """GET /api/jobs/{job_id}/chat/customer/messages - should return empty or messages list"""
        response = authenticated_client.get(f"{BASE_URL}/api/jobs/{test_job_id}/chat/customer/messages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Customer messages count: {len(data)}")
    
    def test_post_internal_message(self, authenticated_client, test_job_id):
        """POST /api/jobs/{job_id}/chat/internal/message - should create message"""
        message_content = f"TEST_Internal message {uuid.uuid4()}"
        response = authenticated_client.post(
            f"{BASE_URL}/api/jobs/{test_job_id}/chat/internal/message",
            json={"content": message_content}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain message id"
        assert data.get("content") == message_content, "Message content should match"
        assert data.get("channel") == "internal", "Channel should be internal"
        print(f"Created internal message: {data.get('id')}")
    
    def test_post_customer_message(self, authenticated_client, test_job_id):
        """POST /api/jobs/{job_id}/chat/customer/message - should create message"""
        message_content = f"TEST_Customer message {uuid.uuid4()}"
        response = authenticated_client.post(
            f"{BASE_URL}/api/jobs/{test_job_id}/chat/customer/message",
            json={"content": message_content}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain message id"
        assert data.get("content") == message_content, "Message content should match"
        assert data.get("channel") == "customer", "Channel should be customer"
        print(f"Created customer message: {data.get('id')}")
    
    def test_get_internal_messages_after_post(self, authenticated_client, test_job_id):
        """GET /api/jobs/{job_id}/chat/internal/messages - should return posted messages"""
        response = authenticated_client.get(f"{BASE_URL}/api/jobs/{test_job_id}/chat/internal/messages")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least one message from previous test
        test_messages = [m for m in data if "TEST_Internal" in m.get("content", "")]
        assert len(test_messages) >= 1, "Should have at least one test message"
        print(f"Found {len(test_messages)} test internal messages")
    
    def test_invalid_channel_returns_400(self, authenticated_client, test_job_id):
        """POST with invalid channel should return 400"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/jobs/{test_job_id}/chat/invalid/message",
            json={"content": "Test message"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid channel, got {response.status_code}"
    
    def test_invalid_job_id_returns_400(self, authenticated_client):
        """POST with invalid job ID should return 400"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/jobs/invalid-uuid/chat/internal/message",
            json={"content": "Test message"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid job ID, got {response.status_code}"
    
    def test_get_chat_threads(self, authenticated_client, test_job_id):
        """GET /api/jobs/{job_id}/chat/threads - should return threads"""
        response = authenticated_client.get(f"{BASE_URL}/api/jobs/{test_job_id}/chat/threads")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Chat threads count: {len(data)}")
    
    def test_get_unread_counts(self, authenticated_client):
        """GET /api/chat/unread-counts - should return unread counts"""
        response = authenticated_client.get(f"{BASE_URL}/api/chat/unread-counts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, dict), "Response should be a dict"
        print(f"Unread counts: {data}")


# ==================== INVENTORY LOCATION TESTS ====================

class TestInventoryLocations:
    """Multi-warehouse inventory location tests"""
    
    def test_get_locations_empty_or_list(self, api_client):
        """GET /api/inventory/locations - should return list"""
        response = api_client.get(f"{BASE_URL}/api/inventory/locations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Inventory locations count: {len(data)}")
    
    def test_create_warehouse_location(self, api_client):
        """POST /api/inventory/locations - create warehouse"""
        location_data = {
            "name": f"TEST_Warehouse_{uuid.uuid4().hex[:8]}",
            "location_type": "warehouse",
            "address": "123 Test St",
            "city": "Test City",
            "state": "TX",
            "zip_code": "12345",
            "manager_name": "Test Manager",
            "phone": "555-1234",
            "is_primary": False
        }
        response = api_client.post(f"{BASE_URL}/api/inventory/locations", json=location_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain location id"
        assert data.get("name") == location_data["name"], "Name should match"
        assert data.get("location_type") == "warehouse", "Type should be warehouse"
        print(f"Created warehouse location: {data.get('id')}")
        return data.get("id")
    
    def test_create_truck_location(self, api_client):
        """POST /api/inventory/locations - create truck"""
        location_data = {
            "name": f"TEST_Truck_{uuid.uuid4().hex[:8]}",
            "location_type": "truck",
            "is_primary": False
        }
        response = api_client.post(f"{BASE_URL}/api/inventory/locations", json=location_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain location id"
        assert data.get("location_type") == "truck", "Type should be truck"
        print(f"Created truck location: {data.get('id')}")
        return data.get("id")
    
    def test_get_locations_after_create(self, api_client):
        """GET /api/inventory/locations - should include created locations"""
        response = api_client.get(f"{BASE_URL}/api/inventory/locations")
        assert response.status_code == 200
        data = response.json()
        test_locations = [l for l in data if l.get("name", "").startswith("TEST_")]
        assert len(test_locations) >= 2, "Should have at least 2 test locations"
        print(f"Found {len(test_locations)} test locations")
    
    def test_update_location(self, api_client):
        """PUT /api/inventory/locations/{id} - update location"""
        # First create a location
        create_response = api_client.post(f"{BASE_URL}/api/inventory/locations", json={
            "name": f"TEST_Update_{uuid.uuid4().hex[:8]}",
            "location_type": "warehouse"
        })
        assert create_response.status_code == 200
        location_id = create_response.json().get("id")
        
        # Update it
        update_data = {
            "name": f"TEST_Updated_{uuid.uuid4().hex[:8]}",
            "manager_name": "Updated Manager"
        }
        response = api_client.put(f"{BASE_URL}/api/inventory/locations/{location_id}", json=update_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("manager_name") == "Updated Manager", "Manager name should be updated"
        print(f"Updated location: {location_id}")
    
    def test_invalid_location_id_returns_400(self, api_client):
        """PUT with invalid location ID should return 400"""
        response = api_client.put(f"{BASE_URL}/api/inventory/locations/invalid-uuid", json={"name": "Test"})
        assert response.status_code == 400, f"Expected 400 for invalid ID, got {response.status_code}"


# ==================== INVENTORY STOCK TESTS ====================

class TestInventoryStock:
    """Location stock tests"""
    
    @pytest.fixture
    def test_location_id(self, api_client):
        """Create a test location for stock tests"""
        response = api_client.post(f"{BASE_URL}/api/inventory/locations", json={
            "name": f"TEST_Stock_Location_{uuid.uuid4().hex[:8]}",
            "location_type": "warehouse"
        })
        if response.status_code == 200:
            return response.json().get("id")
        pytest.skip("Could not create test location")
    
    def test_get_location_stock_empty(self, api_client, test_location_id):
        """GET /api/inventory/locations/{id}/stock - should return empty list for new location"""
        response = api_client.get(f"{BASE_URL}/api/inventory/locations/{test_location_id}/stock")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Stock items count: {len(data)}")
    
    def test_invalid_location_stock_returns_400(self, api_client):
        """GET stock with invalid location ID should return 400"""
        response = api_client.get(f"{BASE_URL}/api/inventory/locations/invalid-uuid/stock")
        assert response.status_code == 400, f"Expected 400 for invalid ID, got {response.status_code}"


# ==================== INVENTORY TRANSFER TESTS ====================

class TestInventoryTransfers:
    """Inventory transfer tests"""
    
    def test_get_transfers_empty_or_list(self, api_client):
        """GET /api/inventory/transfers - should return list"""
        response = api_client.get(f"{BASE_URL}/api/inventory/transfers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Transfers count: {len(data)}")
    
    def test_create_transfer(self, authenticated_client, api_client):
        """POST /api/inventory/transfers - create transfer between locations"""
        # Create two locations for transfer
        loc1_response = api_client.post(f"{BASE_URL}/api/inventory/locations", json={
            "name": f"TEST_From_Location_{uuid.uuid4().hex[:8]}",
            "location_type": "warehouse"
        })
        loc2_response = api_client.post(f"{BASE_URL}/api/inventory/locations", json={
            "name": f"TEST_To_Location_{uuid.uuid4().hex[:8]}",
            "location_type": "truck"
        })
        
        if loc1_response.status_code != 200 or loc2_response.status_code != 200:
            pytest.skip("Could not create test locations for transfer")
        
        from_location_id = loc1_response.json().get("id")
        to_location_id = loc2_response.json().get("id")
        
        # Create transfer
        transfer_data = {
            "from_location_id": from_location_id,
            "to_location_id": to_location_id,
            "items": [{"item_id": str(uuid.uuid4()), "item_name": "Test Item", "quantity": 5}],
            "notes": "TEST_Transfer for testing"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/inventory/transfers", json=transfer_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain transfer id"
        assert "transfer_number" in data, "Response should contain transfer number"
        assert data.get("status") == "pending", "Initial status should be pending"
        print(f"Created transfer: {data.get('transfer_number')}")
    
    def test_get_transfers_after_create(self, api_client):
        """GET /api/inventory/transfers - should include created transfer"""
        response = api_client.get(f"{BASE_URL}/api/inventory/transfers")
        assert response.status_code == 200
        data = response.json()
        test_transfers = [t for t in data if "TEST_Transfer" in (t.get("notes") or "")]
        assert len(test_transfers) >= 1, "Should have at least 1 test transfer"
        print(f"Found {len(test_transfers)} test transfers")
    
    def test_get_transfers_by_status(self, api_client):
        """GET /api/inventory/transfers?status=pending - filter by status"""
        response = api_client.get(f"{BASE_URL}/api/inventory/transfers?status=pending")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # All returned transfers should be pending
        for transfer in data:
            assert transfer.get("status") == "pending", f"Expected pending status, got {transfer.get('status')}"
        print(f"Pending transfers count: {len(data)}")
    
    def test_invalid_transfer_id_returns_400(self, authenticated_client):
        """PUT approve with invalid transfer ID should return 400"""
        response = authenticated_client.put(f"{BASE_URL}/api/inventory/transfers/invalid-uuid/approve")
        assert response.status_code == 400, f"Expected 400 for invalid ID, got {response.status_code}"


# ==================== CLEANUP ====================

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_info(self, api_client):
        """Info about test data created"""
        # Get all test locations
        response = api_client.get(f"{BASE_URL}/api/inventory/locations?active_only=false")
        if response.status_code == 200:
            data = response.json()
            test_locations = [l for l in data if l.get("name", "").startswith("TEST_")]
            print(f"Test locations created: {len(test_locations)}")
        
        # Get all test transfers
        response = api_client.get(f"{BASE_URL}/api/inventory/transfers")
        if response.status_code == 200:
            data = response.json()
            test_transfers = [t for t in data if "TEST_Transfer" in (t.get("notes") or "")]
            print(f"Test transfers created: {len(test_transfers)}")
        
        print("Note: Test data prefixed with TEST_ can be cleaned up manually if needed")
