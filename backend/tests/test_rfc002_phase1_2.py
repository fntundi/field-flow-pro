"""
RFC-002 Phase 1 & 2 Backend API Tests
- Phase 1: Core Data Models & Backend Foundation (RBAC, System Settings, Google Maps toggle)
- Phase 2: Leads, PCBs & Sales Pipeline (CRUD, metrics, status workflows)
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ==================== PHASE 1: SYSTEM SETTINGS & RBAC ====================

class TestSystemSettings:
    """System Settings API tests (RFC-002 Phase 1)"""
    
    def test_get_system_settings(self, api_client):
        """GET /api/system/settings - returns settings with google_maps_enabled flag"""
        response = api_client.get(f"{BASE_URL}/api/system/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify required fields exist
        assert "google_maps_enabled" in data, "Missing google_maps_enabled field"
        assert "google_maps_api_key_set" in data, "Missing google_maps_api_key_set field"
        assert "default_tax_rate" in data, "Missing default_tax_rate field"
        assert "default_labor_rate" in data, "Missing default_labor_rate field"
        
        # Per agent context: no API key configured
        assert data["google_maps_enabled"] == False, "google_maps_enabled should be False"
        assert data["google_maps_api_key_set"] == False, "google_maps_api_key_set should be False"
        print(f"System settings retrieved: google_maps_enabled={data['google_maps_enabled']}")
    
    def test_update_system_settings_tax_rate(self, api_client):
        """PUT /api/system/settings - can update tax rate"""
        # Get current settings
        get_response = api_client.get(f"{BASE_URL}/api/system/settings")
        original_tax_rate = get_response.json().get("default_tax_rate", 8.25)
        
        # Update tax rate
        new_tax_rate = 9.5
        response = api_client.put(
            f"{BASE_URL}/api/system/settings",
            json={"default_tax_rate": new_tax_rate}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["default_tax_rate"] == new_tax_rate, f"Tax rate not updated: {data['default_tax_rate']}"
        
        # Verify persistence with GET
        verify_response = api_client.get(f"{BASE_URL}/api/system/settings")
        assert verify_response.json()["default_tax_rate"] == new_tax_rate
        
        # Restore original
        api_client.put(f"{BASE_URL}/api/system/settings", json={"default_tax_rate": original_tax_rate})
        print(f"Tax rate updated to {new_tax_rate} and restored to {original_tax_rate}")
    
    def test_update_system_settings_labor_rate(self, api_client):
        """PUT /api/system/settings - can update labor rate"""
        get_response = api_client.get(f"{BASE_URL}/api/system/settings")
        original_labor_rate = get_response.json().get("default_labor_rate", 95.0)
        
        new_labor_rate = 125.0
        response = api_client.put(
            f"{BASE_URL}/api/system/settings",
            json={"default_labor_rate": new_labor_rate}
        )
        assert response.status_code == 200
        assert response.json()["default_labor_rate"] == new_labor_rate
        
        # Restore
        api_client.put(f"{BASE_URL}/api/system/settings", json={"default_labor_rate": original_labor_rate})
        print(f"Labor rate updated to {new_labor_rate} and restored")


class TestRoles:
    """RBAC Roles API tests (RFC-002 Phase 1)"""
    
    def test_get_roles_returns_predefined_roles(self, api_client):
        """GET /api/roles - returns 8 predefined system roles"""
        response = api_client.get(f"{BASE_URL}/api/roles")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        roles = response.json()
        assert isinstance(roles, list), "Expected list of roles"
        
        # Check for expected system roles per RFC-002 DEFAULT_ROLES
        role_names = [r["name"] for r in roles]
        expected_roles = ["admin", "owner", "manager", "dispatcher", "technician", "lead_tech", "accountant", "sales"]
        
        for expected in expected_roles:
            assert expected in role_names, f"Missing expected role: {expected}"
        
        # Verify system roles have is_system=True
        system_roles = [r for r in roles if r.get("is_system")]
        assert len(system_roles) >= 8, f"Expected at least 8 system roles, got {len(system_roles)}"
        
        print(f"Found {len(roles)} roles, {len(system_roles)} are system roles")
        print(f"Role names: {role_names}")
    
    def test_roles_have_required_fields(self, api_client):
        """Verify roles have required fields"""
        response = api_client.get(f"{BASE_URL}/api/roles")
        roles = response.json()
        
        for role in roles:
            assert "id" in role, "Role missing id"
            assert "name" in role, "Role missing name"
            assert "display_name" in role, "Role missing display_name"
            assert "is_system" in role, "Role missing is_system"


# ==================== PHASE 2: LEADS API ====================

class TestLeads:
    """Leads API tests (RFC-002 Section 4.1.1)"""
    
    @pytest.fixture(autouse=True)
    def setup_test_lead_id(self):
        """Store test lead ID for cleanup"""
        self.test_lead_ids = []
        yield
        # Cleanup handled in individual tests
    
    def test_get_leads_list(self, api_client):
        """GET /api/leads - returns leads list"""
        response = api_client.get(f"{BASE_URL}/api/leads")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of leads"
        print(f"Found {len(data)} leads")
    
    def test_get_leads_with_filtering(self, api_client):
        """GET /api/leads - supports filtering by status"""
        response = api_client.get(f"{BASE_URL}/api/leads?status=new")
        assert response.status_code == 200
        
        response = api_client.get(f"{BASE_URL}/api/leads?source=website")
        assert response.status_code == 200
        print("Lead filtering works")
    
    def test_create_lead(self, api_client):
        """POST /api/leads - creates new lead with workflow status"""
        lead_data = {
            "contact_name": "TEST_John Smith",
            "contact_email": "test_john@example.com",
            "contact_phone": "555-123-4567",
            "company_name": "TEST Company Inc",
            "address": "123 Test Street",
            "city": "Test City",
            "state": "TX",
            "zip_code": "75001",
            "source": "website",
            "source_detail": "Contact form",
            "notes": "Test lead for RFC-002 testing",
            "estimated_value": 5000.0,
            "priority": "high"
        }
        
        response = api_client.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["contact_name"] == "TEST_John Smith"
        assert data["status"] == "new", f"Expected status 'new', got {data['status']}"
        assert "lead_number" in data, "Missing lead_number"
        assert "id" in data, "Missing id"
        
        # Verify with GET
        lead_id = data["id"]
        get_response = api_client.get(f"{BASE_URL}/api/leads/{lead_id}")
        assert get_response.status_code == 200
        assert get_response.json()["contact_name"] == "TEST_John Smith"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/leads/{lead_id}")
        print(f"Created lead {data['lead_number']} with status 'new'")
    
    def test_lead_status_workflow(self, api_client):
        """PUT /api/leads/{id} - updates lead status through workflow"""
        # Create test lead
        create_response = api_client.post(f"{BASE_URL}/api/leads", json={
            "contact_name": "TEST_Workflow Lead",
            "contact_email": "workflow@test.com",
            "source": "referral"
        })
        assert create_response.status_code == 200
        lead = create_response.json()
        lead_id = lead["id"]
        
        try:
            # Workflow: new -> contacted -> qualified -> quoted -> won
            statuses = ["contacted", "qualified", "quoted", "won"]
            
            for status in statuses:
                response = api_client.put(
                    f"{BASE_URL}/api/leads/{lead_id}",
                    json={"status": status}
                )
                assert response.status_code == 200, f"Failed to update to {status}: {response.text}"
                
                data = response.json()
                assert data["status"] == status, f"Expected {status}, got {data['status']}"
                
                # Verify timestamp tracking
                if status == "contacted":
                    assert data.get("first_contact_at") is not None, "first_contact_at not set"
                elif status == "qualified":
                    assert data.get("qualified_at") is not None, "qualified_at not set"
                elif status == "quoted":
                    assert data.get("quoted_at") is not None, "quoted_at not set"
                elif status == "won":
                    assert data.get("closed_at") is not None, "closed_at not set"
            
            print(f"Lead workflow completed: new -> contacted -> qualified -> quoted -> won")
        finally:
            api_client.delete(f"{BASE_URL}/api/leads/{lead_id}")
    
    def test_lead_lost_status(self, api_client):
        """Test lead can be marked as lost"""
        create_response = api_client.post(f"{BASE_URL}/api/leads", json={
            "contact_name": "TEST_Lost Lead",
            "source": "cold_call"
        })
        lead_id = create_response.json()["id"]
        
        try:
            response = api_client.put(
                f"{BASE_URL}/api/leads/{lead_id}",
                json={"status": "lost"}
            )
            assert response.status_code == 200
            assert response.json()["status"] == "lost"
            assert response.json().get("closed_at") is not None
            print("Lead marked as lost successfully")
        finally:
            api_client.delete(f"{BASE_URL}/api/leads/{lead_id}")
    
    def test_convert_lead_to_customer(self, api_client):
        """POST /api/leads/{id}/convert - converts lead to customer"""
        # Create test lead
        create_response = api_client.post(f"{BASE_URL}/api/leads", json={
            "contact_name": "TEST_Convert Lead",
            "contact_email": "convert@test.com",
            "source": "website"
        })
        lead_id = create_response.json()["id"]
        
        try:
            response = api_client.post(f"{BASE_URL}/api/leads/{lead_id}/convert")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert "customer_id" in data, "Missing customer_id in response"
            assert "lead_id" in data, "Missing lead_id in response"
            assert data["message"] == "Lead converted successfully"
            
            # Verify lead status changed to won
            get_response = api_client.get(f"{BASE_URL}/api/leads/{lead_id}")
            assert get_response.json()["status"] == "won"
            assert get_response.json().get("converted_customer_id") is not None
            
            print(f"Lead converted to customer {data['customer_id']}")
        finally:
            api_client.delete(f"{BASE_URL}/api/leads/{lead_id}")
    
    def test_get_lead_metrics(self, api_client):
        """GET /api/leads/metrics - returns lead metrics"""
        response = api_client.get(f"{BASE_URL}/api/leads/metrics")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_leads" in data, "Missing total_leads"
        assert "by_status" in data, "Missing by_status"
        assert "by_source" in data, "Missing by_source"
        assert "lead_to_close_ratio" in data, "Missing lead_to_close_ratio (conversion rate)"
        
        print(f"Lead metrics: total={data['total_leads']}, by_status={data['by_status']}")


# ==================== PHASE 2: PCB API ====================

class TestPCBs:
    """PCB (Potential Callbacks) API tests (RFC-002 Section 4.1.2)"""
    
    def test_get_pcbs_list(self, api_client):
        """GET /api/pcbs - returns PCB list"""
        response = api_client.get(f"{BASE_URL}/api/pcbs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of PCBs"
        print(f"Found {len(data)} PCBs")
    
    def test_create_pcb(self, api_client):
        """POST /api/pcbs - creates new PCB with reason and follow-up date"""
        follow_up_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        
        pcb_data = {
            "customer_name": "TEST_PCB Customer",
            "reason": "Customer interested in AC upgrade after service call",
            "reason_category": "upsell",
            "follow_up_date": follow_up_date,
            "follow_up_time": "10:00",
            "priority": "high",
            "notes": "Test PCB for RFC-002 testing"
        }
        
        response = api_client.post(f"{BASE_URL}/api/pcbs", json=pcb_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["customer_name"] == "TEST_PCB Customer"
        assert data["reason"] == "Customer interested in AC upgrade after service call"
        assert data["follow_up_date"] == follow_up_date
        assert data["status"] == "created", f"Expected status 'created', got {data['status']}"
        assert "pcb_number" in data, "Missing pcb_number"
        
        # Verify with GET
        pcb_id = data["id"]
        get_response = api_client.get(f"{BASE_URL}/api/pcbs/{pcb_id}")
        assert get_response.status_code == 200
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/pcbs/{pcb_id}")
        print(f"Created PCB {data['pcb_number']} with follow-up date {follow_up_date}")
    
    def test_pcb_status_workflow(self, api_client):
        """PUT /api/pcbs/{id} - updates PCB status through workflow"""
        # Create test PCB with valid reason_category
        create_response = api_client.post(f"{BASE_URL}/api/pcbs", json={
            "customer_name": "TEST_PCB Workflow",
            "reason": "Test workflow",
            "reason_category": "follow_up"  # Valid category: follow_up, upsell, warranty, complaint, question, other
        })
        assert create_response.status_code == 200, f"Failed to create PCB: {create_response.text}"
        pcb = create_response.json()
        pcb_id = pcb["id"]
        
        try:
            # Workflow: created -> assigned -> follow_up -> converted
            statuses = ["assigned", "follow_up", "converted"]
            
            for status in statuses:
                response = api_client.put(
                    f"{BASE_URL}/api/pcbs/{pcb_id}",
                    json={"status": status}
                )
                assert response.status_code == 200, f"Failed to update to {status}: {response.text}"
                assert response.json()["status"] == status
                
                if status in ["converted", "closed"]:
                    assert response.json().get("resolved_at") is not None
            
            print("PCB workflow completed: created -> assigned -> follow_up -> converted")
        finally:
            api_client.delete(f"{BASE_URL}/api/pcbs/{pcb_id}")
    
    def test_convert_pcb_to_job(self, api_client):
        """POST /api/pcbs/{id}/convert - converts PCB to job"""
        # Create test PCB
        create_response = api_client.post(f"{BASE_URL}/api/pcbs", json={
            "customer_name": "TEST_PCB Convert",
            "reason": "Needs new AC unit",
            "reason_category": "upsell"
        })
        pcb_id = create_response.json()["id"]
        
        try:
            response = api_client.post(f"{BASE_URL}/api/pcbs/{pcb_id}/convert")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert "job_id" in data, "Missing job_id in response"
            assert "job_number" in data, "Missing job_number in response"
            assert data["message"] == "PCB converted to job"
            
            # Verify PCB status changed
            get_response = api_client.get(f"{BASE_URL}/api/pcbs/{pcb_id}")
            assert get_response.json()["status"] == "converted"
            assert get_response.json().get("converted_to_job_id") is not None
            
            print(f"PCB converted to job {data['job_number']}")
        finally:
            api_client.delete(f"{BASE_URL}/api/pcbs/{pcb_id}")
    
    def test_get_pcb_metrics(self, api_client):
        """GET /api/pcbs/metrics - returns PCB metrics"""
        response = api_client.get(f"{BASE_URL}/api/pcbs/metrics")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_pcbs" in data, "Missing total_pcbs"
        assert "open_pcbs" in data, "Missing open_pcbs"
        assert "by_status" in data, "Missing by_status"
        assert "conversion_rate" in data, "Missing conversion_rate"
        assert "overdue_count" in data, "Missing overdue_count"
        
        print(f"PCB metrics: total={data['total_pcbs']}, open={data['open_pcbs']}, conversion_rate={data['conversion_rate']}%")


# ==================== PHASE 2: PROPOSALS API ====================

class TestProposals:
    """Proposals API tests (RFC-002 Section 4.1.3)"""
    
    def test_get_proposals_list(self, api_client):
        """GET /api/proposals - returns proposals list"""
        response = api_client.get(f"{BASE_URL}/api/proposals")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of proposals"
        print(f"Found {len(data)} proposals")
    
    def test_create_proposal(self, api_client):
        """POST /api/proposals - creates new proposal"""
        valid_until = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        proposal_data = {
            "customer_name": "TEST_Proposal Customer",
            "customer_email": "proposal@test.com",
            "customer_phone": "555-987-6543",
            "site_address": "456 Proposal Street, Test City, TX 75002",
            "title": "AC System Replacement Proposal",
            "description": "Complete replacement of existing 3-ton AC system",
            "valid_until": valid_until,
            "notes": "Test proposal for RFC-002 testing"
        }
        
        response = api_client.post(f"{BASE_URL}/api/proposals", json=proposal_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["customer_name"] == "TEST_Proposal Customer"
        assert data["title"] == "AC System Replacement Proposal"
        assert data["status"] == "draft", f"Expected status 'draft', got {data['status']}"
        assert "proposal_number" in data, "Missing proposal_number"
        
        # Verify with GET
        proposal_id = data["id"]
        get_response = api_client.get(f"{BASE_URL}/api/proposals/{proposal_id}")
        assert get_response.status_code == 200
        
        # Store for option test
        self.test_proposal_id = proposal_id
        print(f"Created proposal {data['proposal_number']}")
        
        # Don't cleanup yet - used by next test
        return proposal_id
    
    def test_add_proposal_option(self, api_client):
        """POST /api/proposals/{id}/options - adds Good/Better/Best option"""
        # Create a proposal first
        proposal_response = api_client.post(f"{BASE_URL}/api/proposals", json={
            "customer_name": "TEST_Option Customer",
            "site_address": "789 Option Ave",
            "title": "Test Proposal for Options"
        })
        proposal_id = proposal_response.json()["id"]
        
        try:
            # Add Good option
            good_option = {
                "tier": "good",
                "name": "Basic AC System",
                "description": "Entry-level 14 SEER system",
                "line_items": [
                    {"item_type": "equipment", "description": "14 SEER AC Unit", "quantity": 1, "unit_price": 3500},
                    {"item_type": "labor", "description": "Installation Labor", "quantity": 8, "unit_price": 95}
                ],
                "is_recommended": False
            }
            
            response = api_client.post(
                f"{BASE_URL}/api/proposals/{proposal_id}/options",
                json=good_option
            )
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            assert "option_id" in response.json()
            
            # Add Better option
            better_option = {
                "tier": "better",
                "name": "Mid-Range AC System",
                "description": "16 SEER system with better efficiency",
                "line_items": [
                    {"item_type": "equipment", "description": "16 SEER AC Unit", "quantity": 1, "unit_price": 4500},
                    {"item_type": "labor", "description": "Installation Labor", "quantity": 8, "unit_price": 95}
                ],
                "is_recommended": True
            }
            
            response = api_client.post(
                f"{BASE_URL}/api/proposals/{proposal_id}/options",
                json=better_option
            )
            assert response.status_code == 200
            
            # Add Best option
            best_option = {
                "tier": "best",
                "name": "Premium AC System",
                "description": "20 SEER high-efficiency system",
                "line_items": [
                    {"item_type": "equipment", "description": "20 SEER AC Unit", "quantity": 1, "unit_price": 6500},
                    {"item_type": "labor", "description": "Installation Labor", "quantity": 10, "unit_price": 95}
                ],
                "is_recommended": False
            }
            
            response = api_client.post(
                f"{BASE_URL}/api/proposals/{proposal_id}/options",
                json=best_option
            )
            assert response.status_code == 200
            
            # Verify options were added
            get_response = api_client.get(f"{BASE_URL}/api/proposals/{proposal_id}")
            proposal = get_response.json()
            assert len(proposal.get("options", [])) == 3, f"Expected 3 options, got {len(proposal.get('options', []))}"
            
            print("Added Good/Better/Best options to proposal")
        finally:
            # Cleanup - delete proposal (options are embedded)
            pass  # Proposals don't have delete endpoint in the code shown


# ==================== PHASE 2: JOB TYPES API ====================

class TestJobTypes:
    """Job Types API tests (RFC-002 Section 4.2.1)"""
    
    def test_get_job_types_returns_defaults(self, api_client):
        """GET /api/job-types - returns 4 default job type templates with checklists"""
        response = api_client.get(f"{BASE_URL}/api/job-types")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of job types"
        assert len(data) >= 4, f"Expected at least 4 default job types, got {len(data)}"
        
        # Check for expected default types
        type_names = [t["name"] for t in data]
        expected_types = [
            "Residential AC Service",
            "Residential AC Install",
            "Commercial RTU Service",
            "Commercial Install"
        ]
        
        for expected in expected_types:
            assert expected in type_names, f"Missing expected job type: {expected}"
        
        # Verify checklists exist
        for job_type in data:
            if job_type["name"] in ["Residential AC Service", "Residential AC Install", "Commercial RTU Service"]:
                assert "checklist_items" in job_type, f"Missing checklist_items for {job_type['name']}"
                assert len(job_type["checklist_items"]) > 0, f"Empty checklist for {job_type['name']}"
        
        print(f"Found {len(data)} job types: {type_names}")
    
    def test_job_type_has_required_fields(self, api_client):
        """Verify job types have required fields"""
        response = api_client.get(f"{BASE_URL}/api/job-types")
        job_types = response.json()
        
        for jt in job_types:
            assert "id" in jt, "Missing id"
            assert "name" in jt, "Missing name"
            assert "category" in jt, "Missing category"
            assert "is_active" in jt, "Missing is_active"


# ==================== PHASE 2: VENDORS API ====================

class TestVendors:
    """Vendors API tests (RFC-002 Section 4.7.2)"""
    
    def test_get_vendors_list(self, api_client):
        """GET /api/vendors - returns vendors list"""
        response = api_client.get(f"{BASE_URL}/api/vendors")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of vendors"
        print(f"Found {len(data)} vendors")
    
    def test_create_vendor(self, api_client):
        """POST /api/vendors - creates new vendor"""
        vendor_data = {
            "name": "TEST_HVAC Supply Co",
            "contact_name": "John Vendor",
            "email": "vendor@test.com",
            "phone": "555-111-2222",
            "address": "100 Vendor Way",
            "city": "Supply City",
            "state": "TX",
            "zip_code": "75003",
            "payment_terms": "net_30",
            "account_number": "ACCT-12345",
            "notes": "Test vendor for RFC-002 testing"
        }
        
        response = api_client.post(f"{BASE_URL}/api/vendors", json=vendor_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_HVAC Supply Co"
        assert data["payment_terms"] == "net_30"
        assert "vendor_number" in data, "Missing vendor_number"
        assert data["is_active"] == True
        
        # Verify with GET
        vendor_id = data["id"]
        get_response = api_client.get(f"{BASE_URL}/api/vendors/{vendor_id}")
        assert get_response.status_code == 200
        assert get_response.json()["name"] == "TEST_HVAC Supply Co"
        
        print(f"Created vendor {data['vendor_number']}")
        
        # Note: No delete endpoint shown, so vendor remains


# ==================== ADDITIONAL METRICS TESTS ====================

class TestProposalMetrics:
    """Proposal metrics tests"""
    
    def test_get_proposal_metrics(self, api_client):
        """GET /api/proposals/metrics - returns proposal metrics"""
        response = api_client.get(f"{BASE_URL}/api/proposals/metrics")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_proposals" in data, "Missing total_proposals"
        assert "by_status" in data, "Missing by_status"
        assert "open_quotes" in data, "Missing open_quotes"
        assert "win_rate" in data, "Missing win_rate"
        
        print(f"Proposal metrics: total={data['total_proposals']}, win_rate={data['win_rate']}%")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
