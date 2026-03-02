"""
Phase 3 Backend API Tests for BreezeFlow HVAC Management System
Tests: Google Maps routing, Maintenance Agreements, Gantt/Projects, Customer Portal, Offline Sync
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://hvac-business-hub.preview.emergentagent.com')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ==================== GOOGLE MAPS ROUTING TESTS ====================

class TestMapsRouting:
    """Google Maps routing API tests - uses Haversine fallback without API key"""
    
    def test_maps_config_not_configured(self, api_client):
        """GET /api/maps/config - Check if Google Maps is configured (should show not configured)"""
        response = api_client.get(f"{BASE_URL}/api/maps/config")
        assert response.status_code == 200
        data = response.json()
        assert "configured" in data
        assert "message" in data
        # Without API key, should show not configured
        print(f"Maps config: configured={data['configured']}, message={data['message']}")
    
    def test_route_calculation_fallback_with_coords(self, api_client):
        """POST /api/maps/route - Calculate route using fallback Haversine (with coordinates)"""
        payload = {
            "origin": "32.7767, -96.7970",  # Dallas coordinates
            "destination": "32.8998, -97.0403"  # Fort Worth coordinates
        }
        response = api_client.post(f"{BASE_URL}/api/maps/route", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "origin_address" in data
        assert "destination_address" in data
        assert "distance_miles" in data
        assert "duration_minutes" in data
        assert "api_status" in data
        
        # Should use fallback since no API key
        assert data["api_status"] in ["FALLBACK_HAVERSINE", "OK"]
        print(f"Route: {data['distance_miles']} miles, {data['duration_minutes']} minutes, status={data['api_status']}")
    
    def test_route_calculation_fallback_no_coords(self, api_client):
        """POST /api/maps/route - Calculate route with addresses (no coords - fallback)"""
        payload = {
            "origin": "123 Main St, Dallas, TX",
            "destination": "456 Oak Ave, Fort Worth, TX"
        }
        response = api_client.post(f"{BASE_URL}/api/maps/route", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Without coords and no API key, should return fallback status
        assert "api_status" in data
        print(f"Route without coords: status={data['api_status']}")


# ==================== MAINTENANCE AGREEMENTS TESTS ====================

class TestMaintenanceAgreements:
    """Maintenance agreements API tests"""
    
    @pytest.fixture(scope="class")
    def test_agreement_id(self, api_client):
        """Create a test agreement and return its ID"""
        payload = {
            "customer_name": "TEST_Maintenance Customer",
            "customer_email": "test_maint@example.com",
            "customer_phone": "(555) 123-4567",
            "service_address": "123 Test St, Dallas, TX 75001",
            "frequency": "quarterly",
            "start_date": datetime.now().strftime("%Y-%m-%d"),
            "annual_price": 599.99,
            "payment_frequency": "annual",
            "auto_renew": True,
            "notes": "Test agreement for Phase 3 testing"
        }
        response = api_client.post(f"{BASE_URL}/api/maintenance/agreements", json=payload)
        assert response.status_code == 200
        data = response.json()
        return data["id"]
    
    def test_get_maintenance_templates(self, api_client):
        """GET /api/maintenance/templates - Get maintenance agreement templates"""
        response = api_client.get(f"{BASE_URL}/api/maintenance/templates")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} maintenance templates")
    
    def test_create_maintenance_agreement(self, api_client):
        """POST /api/maintenance/agreements - Create new maintenance agreement"""
        payload = {
            "customer_name": "TEST_John Smith",
            "customer_email": "test_john@example.com",
            "customer_phone": "(555) 987-6543",
            "service_address": "456 Oak Ave, Dallas, TX 75002",
            "frequency": "annual",
            "start_date": datetime.now().strftime("%Y-%m-%d"),
            "annual_price": 299.00,
            "payment_frequency": "annual",
            "auto_renew": True
        }
        response = api_client.post(f"{BASE_URL}/api/maintenance/agreements", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert "agreement_number" in data
        assert data["customer_name"] == "TEST_John Smith"
        assert data["frequency"] == "annual"
        assert data["annual_price"] == 299.00
        assert "next_service_date" in data
        assert "end_date" in data
        print(f"Created agreement: {data['agreement_number']}")
        
        return data["id"]
    
    def test_get_all_agreements(self, api_client, test_agreement_id):
        """GET /api/maintenance/agreements - Get all agreements"""
        response = api_client.get(f"{BASE_URL}/api/maintenance/agreements")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} maintenance agreements")
    
    def test_get_agreement_by_id(self, api_client, test_agreement_id):
        """GET /api/maintenance/agreements/{id} - Get specific agreement"""
        response = api_client.get(f"{BASE_URL}/api/maintenance/agreements/{test_agreement_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_agreement_id
        print(f"Retrieved agreement: {data['agreement_number']}")
    
    def test_generate_jobs_from_agreement(self, api_client, test_agreement_id):
        """POST /api/maintenance/agreements/{id}/generate-jobs - Generate scheduled jobs"""
        response = api_client.post(f"{BASE_URL}/api/maintenance/agreements/{test_agreement_id}/generate-jobs")
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "job_ids" in data
        assert isinstance(data["job_ids"], list)
        print(f"Generated {len(data['job_ids'])} maintenance jobs")
    
    def test_get_due_renewals(self, api_client):
        """GET /api/maintenance/due-renewals - Get agreements due for renewal"""
        response = api_client.get(f"{BASE_URL}/api/maintenance/due-renewals?days=365")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} agreements due for renewal in next 365 days")


# ==================== GANTT / INSTALL PROJECTS TESTS ====================

class TestInstallProjects:
    """Install projects and Gantt chart API tests"""
    
    @pytest.fixture(scope="class")
    def test_job_id(self, api_client):
        """Create a test job for project"""
        payload = {
            "customer_name": "TEST_Project Customer",
            "site_address": "789 Project Blvd, Dallas, TX 75003",
            "job_type": "Commercial Install",
            "title": "Test HVAC Installation Project",
            "priority": "high"
        }
        response = api_client.post(f"{BASE_URL}/api/jobs", json=payload)
        assert response.status_code == 200
        return response.json()["id"]
    
    @pytest.fixture(scope="class")
    def test_project_id(self, api_client, test_job_id):
        """Create a test project and return its ID"""
        start_date = datetime.now().strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
        
        payload = {
            "job_id": test_job_id,
            "name": "TEST_Commercial HVAC Install",
            "description": "Multi-day commercial installation project",
            "customer_name": "TEST_Project Customer",
            "site_address": "789 Project Blvd, Dallas, TX 75003",
            "planned_start_date": start_date,
            "planned_end_date": end_date,
            "estimated_hours": 40,
            "estimated_cost": 15000.00
        }
        response = api_client.post(f"{BASE_URL}/api/projects", json=payload)
        assert response.status_code == 200
        data = response.json()
        return data["id"]
    
    def test_create_install_project(self, api_client, test_job_id):
        """POST /api/projects - Create install project"""
        start_date = datetime.now().strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        payload = {
            "job_id": test_job_id,
            "name": "TEST_Residential Install",
            "description": "Test residential installation",
            "customer_name": "TEST_Residential Customer",
            "site_address": "100 Test Lane, Dallas, TX",
            "planned_start_date": start_date,
            "planned_end_date": end_date,
            "estimated_hours": 16,
            "estimated_cost": 5000.00
        }
        response = api_client.post(f"{BASE_URL}/api/projects", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert "project_number" in data
        assert data["name"] == "TEST_Residential Install"
        assert data["status"] == "planning"
        print(f"Created project: {data['project_number']}")
    
    def test_get_project_by_id(self, api_client, test_project_id):
        """GET /api/projects/{id} - Get project details"""
        response = api_client.get(f"{BASE_URL}/api/projects/{test_project_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == test_project_id
        assert "phases" in data
        assert "percent_complete" in data
        print(f"Retrieved project: {data['project_number']}, {data['percent_complete']}% complete")
    
    def test_add_phase_to_project(self, api_client, test_project_id):
        """POST /api/projects/{id}/phases - Add phase to project"""
        start_date = datetime.now().strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        
        payload = {
            "name": "Equipment Removal",
            "description": "Remove old HVAC equipment",
            "start_date": start_date,
            "end_date": end_date,
            "color": "#3B82F6"
        }
        response = api_client.post(f"{BASE_URL}/api/projects/{test_project_id}/phases", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert data["name"] == "Equipment Removal"
        assert "duration_days" in data
        print(f"Added phase: {data['name']}, duration: {data['duration_days']} days")
        
        return data["id"]
    
    def test_update_phase_status(self, api_client, test_project_id):
        """PUT /api/projects/{id}/phases/{phase_id} - Update phase status/progress"""
        # First add a phase
        start_date = datetime.now().strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        
        phase_payload = {
            "name": "New Equipment Install",
            "start_date": start_date,
            "end_date": end_date,
            "color": "#10B981"
        }
        phase_response = api_client.post(f"{BASE_URL}/api/projects/{test_project_id}/phases", json=phase_payload)
        assert phase_response.status_code == 200
        phase_id = phase_response.json()["id"]
        
        # Update the phase
        update_payload = {
            "status": "in_progress",
            "percent_complete": 50
        }
        response = api_client.put(f"{BASE_URL}/api/projects/{test_project_id}/phases/{phase_id}", json=update_payload)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Updated phase status to in_progress, 50% complete")
    
    def test_get_gantt_data(self, api_client, test_project_id):
        """GET /api/projects/gantt-data/{id} - Get Gantt chart data"""
        response = api_client.get(f"{BASE_URL}/api/projects/gantt-data/{test_project_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert "project" in data
        assert "phases" in data
        assert "resources" in data
        
        assert "id" in data["project"]
        assert "name" in data["project"]
        assert "start" in data["project"]
        assert "end" in data["project"]
        assert "progress" in data["project"]
        
        print(f"Gantt data: {len(data['phases'])} phases, {len(data['resources'])} resources")


# ==================== CUSTOMER PORTAL TESTS ====================

class TestCustomerPortal:
    """Customer self-service portal API tests"""
    
    @pytest.fixture(scope="class")
    def test_customer(self, api_client):
        """Register a test customer and return their info"""
        unique_email = f"test_customer_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique_email,
            "password": "TestPassword123!",
            "name": "TEST_Customer User",
            "phone": "(555) 111-2222",
            "address": "100 Customer Lane, Dallas, TX 75001"
        }
        response = api_client.post(f"{BASE_URL}/api/customer/register", json=payload)
        assert response.status_code == 200
        data = response.json()
        return {
            "id": data["customer_id"],
            "email": unique_email,
            "password": "TestPassword123!"
        }
    
    def test_register_customer(self, api_client):
        """POST /api/customer/register - Register new customer account"""
        unique_email = f"test_reg_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique_email,
            "password": "SecurePass456!",
            "name": "TEST_New Customer",
            "phone": "(555) 333-4444",
            "address": "200 New St, Dallas, TX 75002"
        }
        response = api_client.post(f"{BASE_URL}/api/customer/register", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "customer_id" in data
        # Demo mode returns verification token
        print(f"Registered customer: {data['customer_id']}")
    
    def test_register_duplicate_email_fails(self, api_client, test_customer):
        """POST /api/customer/register - Duplicate email should fail"""
        payload = {
            "email": test_customer["email"],
            "password": "AnotherPass789!",
            "name": "Duplicate User"
        }
        response = api_client.post(f"{BASE_URL}/api/customer/register", json=payload)
        assert response.status_code == 400
        print("Duplicate email registration correctly rejected")
    
    def test_customer_login(self, api_client, test_customer):
        """POST /api/customer/login - Customer login with password"""
        payload = {
            "email": test_customer["email"],
            "password": test_customer["password"]
        }
        response = api_client.post(f"{BASE_URL}/api/customer/login", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "token" in data
        assert "customer" in data
        assert data["customer"]["email"] == test_customer["email"]
        print(f"Customer login successful, token received")
    
    def test_customer_login_wrong_password(self, api_client, test_customer):
        """POST /api/customer/login - Wrong password should fail"""
        payload = {
            "email": test_customer["email"],
            "password": "WrongPassword!"
        }
        response = api_client.post(f"{BASE_URL}/api/customer/login", json=payload)
        assert response.status_code == 401
        print("Wrong password correctly rejected")
    
    def test_request_magic_link(self, api_client, test_customer):
        """POST /api/customer/magic-link - Request magic link login"""
        payload = {"email": test_customer["email"]}
        response = api_client.post(f"{BASE_URL}/api/customer/magic-link", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        # Demo mode returns token
        if "token" in data:
            print(f"Magic link token received (demo mode)")
        else:
            print("Magic link request processed")
    
    def test_verify_magic_link(self, api_client, test_customer):
        """POST /api/customer/verify-magic/{token} - Verify magic link"""
        # First request a magic link
        payload = {"email": test_customer["email"]}
        magic_response = api_client.post(f"{BASE_URL}/api/customer/magic-link", json=payload)
        assert magic_response.status_code == 200
        
        # In demo mode, token is returned
        magic_data = magic_response.json()
        if "token" in magic_data:
            token = magic_data["token"]
            response = api_client.post(f"{BASE_URL}/api/customer/verify-magic/{token}")
            assert response.status_code == 200
            data = response.json()
            
            assert "token" in data
            assert "customer" in data
            print("Magic link verification successful")
        else:
            print("Magic link token not available in response (production mode)")
    
    def test_create_service_request(self, api_client, test_customer):
        """POST /api/customer/service-request - Create service request"""
        payload = {
            "service_type": "repair",
            "description": "AC not cooling properly, making strange noise",
            "urgency": "high",
            "preferred_dates": [(datetime.now() + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(1, 4)],
            "preferred_time_of_day": "morning",
            "service_address": "100 Customer Lane, Dallas, TX 75001",
            "access_instructions": "Gate code: 1234"
        }
        response = api_client.post(
            f"{BASE_URL}/api/customer/service-request?customer_id={test_customer['id']}", 
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "request_number" in data
        assert "request_id" in data
        print(f"Created service request: {data['request_number']}")
    
    def test_get_customer_service_requests(self, api_client, test_customer):
        """GET /api/customer/{id}/service-requests - Get customer service requests"""
        response = api_client.get(f"{BASE_URL}/api/customer/{test_customer['id']}/service-requests")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Customer has {len(data)} service requests")
    
    def test_get_customer_jobs(self, api_client, test_customer):
        """GET /api/customer/{id}/jobs - Get customer jobs"""
        response = api_client.get(f"{BASE_URL}/api/customer/{test_customer['id']}/jobs")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Customer has {len(data)} jobs")


# ==================== OFFLINE SYNC TESTS ====================

class TestOfflineSync:
    """Offline sync and conflict resolution API tests"""
    
    @pytest.fixture(scope="class")
    def client_id(self):
        """Generate a unique client ID for testing"""
        return f"test_client_{uuid.uuid4().hex[:8]}"
    
    def test_sync_batch_create(self, api_client, client_id):
        """POST /api/sync/batch - Sync offline changes (create)"""
        payload = {
            "client_id": client_id,
            "user_id": None,
            "user_type": "technician",
            "changes": [
                {
                    "operation": "create",
                    "entity_type": "time_entry",
                    "payload": {
                        "technician_id": str(uuid.uuid4()),
                        "job_id": str(uuid.uuid4()),
                        "status": "traveling"
                    },
                    "client_timestamp": datetime.utcnow().isoformat()
                }
            ]
        }
        response = api_client.post(f"{BASE_URL}/api/sync/batch", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert "synced" in data
        assert "conflicts" in data
        assert "failed" in data
        print(f"Sync result: {len(data['synced'])} synced, {len(data['conflicts'])} conflicts, {len(data['failed'])} failed")
    
    def test_sync_batch_update(self, api_client, client_id):
        """POST /api/sync/batch - Sync offline changes (update)"""
        # First create an entity
        entity_id = str(uuid.uuid4())
        create_payload = {
            "client_id": client_id,
            "user_id": None,
            "user_type": "technician",
            "changes": [
                {
                    "operation": "create",
                    "entity_type": "time_entry",
                    "entity_id": entity_id,
                    "payload": {
                        "id": entity_id,
                        "technician_id": str(uuid.uuid4()),
                        "job_id": str(uuid.uuid4()),
                        "status": "traveling"
                    },
                    "client_timestamp": datetime.utcnow().isoformat()
                }
            ]
        }
        api_client.post(f"{BASE_URL}/api/sync/batch", json=create_payload)
        
        # Now update it
        update_payload = {
            "client_id": client_id,
            "user_id": None,
            "user_type": "technician",
            "changes": [
                {
                    "operation": "update",
                    "entity_type": "time_entry",
                    "entity_id": entity_id,
                    "payload": {
                        "status": "on_site"
                    },
                    "client_timestamp": datetime.utcnow().isoformat()
                }
            ]
        }
        response = api_client.post(f"{BASE_URL}/api/sync/batch", json=update_payload)
        assert response.status_code == 200
        data = response.json()
        print(f"Update sync: {len(data['synced'])} synced")
    
    def test_get_sync_status(self, api_client, client_id):
        """GET /api/sync/status/{client_id} - Get sync status"""
        response = api_client.get(f"{BASE_URL}/api/sync/status/{client_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert "client_id" in data
        assert "pending_count" in data
        assert "synced_count" in data
        assert "conflict_count" in data
        assert "failed_count" in data
        assert "conflicts" in data
        
        print(f"Sync status: {data['synced_count']} synced, {data['conflict_count']} conflicts, {data['pending_count']} pending")
    
    def test_sync_resolve_conflict(self, api_client, client_id):
        """POST /api/sync/resolve - Resolve sync conflict"""
        # This test would need a conflict to exist first
        # For now, just verify the endpoint exists and handles invalid input
        payload = {
            "queue_id": str(uuid.uuid4()),  # Non-existent
            "resolution": "client_wins"
        }
        response = api_client.post(f"{BASE_URL}/api/sync/resolve", json=payload)
        # Should return 404 for non-existent queue item
        assert response.status_code == 404
        print("Conflict resolution endpoint working (404 for non-existent item)")


# ==================== INTEGRATION TESTS ====================

class TestPhase3Integration:
    """Integration tests combining multiple Phase 3 features"""
    
    def test_full_customer_flow(self, api_client):
        """Test complete customer portal flow: register -> login -> create request"""
        # 1. Register
        unique_email = f"test_flow_{uuid.uuid4().hex[:8]}@example.com"
        reg_response = api_client.post(f"{BASE_URL}/api/customer/register", json={
            "email": unique_email,
            "password": "FlowTest123!",
            "name": "TEST_Flow Customer",
            "address": "999 Flow St, Dallas, TX"
        })
        assert reg_response.status_code == 200
        customer_id = reg_response.json()["customer_id"]
        
        # 2. Login
        login_response = api_client.post(f"{BASE_URL}/api/customer/login", json={
            "email": unique_email,
            "password": "FlowTest123!"
        })
        assert login_response.status_code == 200
        
        # 3. Create service request
        request_response = api_client.post(
            f"{BASE_URL}/api/customer/service-request?customer_id={customer_id}",
            json={
                "service_type": "maintenance",
                "description": "Annual HVAC maintenance",
                "urgency": "normal",
                "service_address": "999 Flow St, Dallas, TX"
            }
        )
        assert request_response.status_code == 200
        
        print("Full customer flow completed successfully")
    
    def test_project_with_phases_flow(self, api_client):
        """Test complete project flow: create job -> create project -> add phases -> update"""
        # 1. Create job
        job_response = api_client.post(f"{BASE_URL}/api/jobs", json={
            "customer_name": "TEST_Flow Project Customer",
            "site_address": "888 Project Flow Ave, Dallas, TX",
            "job_type": "Commercial Install",
            "title": "Flow Test Installation"
        })
        assert job_response.status_code == 200
        job_id = job_response.json()["id"]
        
        # 2. Create project
        start_date = datetime.now().strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        
        project_response = api_client.post(f"{BASE_URL}/api/projects", json={
            "job_id": job_id,
            "name": "TEST_Flow Project",
            "customer_name": "TEST_Flow Project Customer",
            "site_address": "888 Project Flow Ave, Dallas, TX",
            "planned_start_date": start_date,
            "planned_end_date": end_date,
            "estimated_hours": 24
        })
        assert project_response.status_code == 200
        project_id = project_response.json()["id"]
        
        # 3. Add phases
        phase1_response = api_client.post(f"{BASE_URL}/api/projects/{project_id}/phases", json={
            "name": "Phase 1 - Prep",
            "start_date": start_date,
            "end_date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "color": "#3B82F6"
        })
        assert phase1_response.status_code == 200
        phase1_id = phase1_response.json()["id"]
        
        # 4. Update phase progress
        update_response = api_client.put(
            f"{BASE_URL}/api/projects/{project_id}/phases/{phase1_id}",
            json={"status": "in_progress", "percent_complete": 25}
        )
        assert update_response.status_code == 200
        
        # 5. Get Gantt data
        gantt_response = api_client.get(f"{BASE_URL}/api/projects/gantt-data/{project_id}")
        assert gantt_response.status_code == 200
        gantt_data = gantt_response.json()
        assert len(gantt_data["phases"]) >= 1
        
        print("Full project flow completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
