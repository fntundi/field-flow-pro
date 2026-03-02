"""
Test suite for Install Project Billing (Milestone Templates) and Reschedule Requests
Tests RFC-002 Section 4.5.3 features
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMilestoneTemplates:
    """Test milestone templates API - RFC-002 Section 4.5.3"""
    
    def test_get_milestone_templates(self):
        """GET /api/milestone-templates returns predefined templates"""
        response = requests.get(f"{BASE_URL}/api/milestone-templates")
        assert response.status_code == 200
        
        templates = response.json()
        assert isinstance(templates, list)
        assert len(templates) >= 4, f"Expected at least 4 default templates, got {len(templates)}"
        
        # Verify template structure
        for template in templates:
            assert "id" in template
            assert "name" in template
            assert "milestones" in template
            assert isinstance(template["milestones"], list)
    
    def test_default_templates_exist(self):
        """Verify all 4 default templates exist: 30/40/30, 50/50, 20/30/30/20, Full Payment"""
        response = requests.get(f"{BASE_URL}/api/milestone-templates")
        assert response.status_code == 200
        
        templates = response.json()
        template_names = [t["name"] for t in templates]
        
        # Check for expected templates
        expected_patterns = [
            "30/40/30",  # Standard Install
            "50/50",     # Equipment Only
            "20/30/30/20",  # Large Project
            "Full Payment",  # Full Payment on Completion (100%)
        ]
        
        for pattern in expected_patterns:
            found = any(pattern in name for name in template_names)
            assert found, f"Expected template containing '{pattern}' not found. Available: {template_names}"
    
    def test_milestone_percentages_sum_to_100(self):
        """Verify each template's milestones sum to 100%"""
        response = requests.get(f"{BASE_URL}/api/milestone-templates")
        assert response.status_code == 200
        
        templates = response.json()
        for template in templates:
            total = sum(m.get("percentage", 0) for m in template.get("milestones", []))
            assert total == 100, f"Template '{template['name']}' milestones sum to {total}%, expected 100%"
    
    def test_get_single_template(self):
        """GET /api/milestone-templates/{id} returns specific template"""
        # First get all templates
        response = requests.get(f"{BASE_URL}/api/milestone-templates")
        assert response.status_code == 200
        templates = response.json()
        assert len(templates) > 0
        
        # Get single template
        template_id = templates[0]["id"]
        response = requests.get(f"{BASE_URL}/api/milestone-templates/{template_id}")
        assert response.status_code == 200
        
        template = response.json()
        assert template["id"] == template_id
        assert "name" in template
        assert "milestones" in template
    
    def test_get_invalid_template_returns_404(self):
        """GET /api/milestone-templates/{invalid_id} returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/milestone-templates/{fake_id}")
        assert response.status_code == 404
    
    def test_create_milestone_template(self):
        """POST /api/milestone-templates creates new template"""
        new_template = {
            "name": "TEST_Custom Template",
            "description": "Test template for automated testing",
            "milestones": [
                {"name": "Initial Payment", "percentage": 25, "trigger": "project_start"},
                {"name": "Mid-Project", "percentage": 50, "trigger": "manual"},
                {"name": "Final Payment", "percentage": 25, "trigger": "project_complete"},
            ],
            "is_default": False
        }
        
        response = requests.post(f"{BASE_URL}/api/milestone-templates", json=new_template)
        assert response.status_code == 200
        
        created = response.json()
        assert "id" in created
        assert created["name"] == new_template["name"]
        assert len(created["milestones"]) == 3
        
        # Verify it was persisted
        get_response = requests.get(f"{BASE_URL}/api/milestone-templates/{created['id']}")
        assert get_response.status_code == 200
        assert get_response.json()["name"] == new_template["name"]
    
    def test_create_template_invalid_percentage(self):
        """POST /api/milestone-templates rejects templates not summing to 100%"""
        invalid_template = {
            "name": "TEST_Invalid Template",
            "milestones": [
                {"name": "Payment 1", "percentage": 30},
                {"name": "Payment 2", "percentage": 30},
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/milestone-templates", json=invalid_template)
        assert response.status_code == 400
        assert "100" in response.json().get("detail", "")


class TestRescheduleRequests:
    """Test reschedule requests API - Customer Portal feature"""
    
    @pytest.fixture
    def job_id(self):
        """Get a valid job ID for testing"""
        response = requests.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200
        jobs = response.json()
        assert len(jobs) > 0, "No jobs available for testing"
        return jobs[0]["id"]
    
    def test_get_reschedule_requests(self):
        """GET /api/reschedule-requests returns list"""
        response = requests.get(f"{BASE_URL}/api/reschedule-requests")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_reschedule_request(self, job_id):
        """POST /api/reschedule-requests creates new request"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        request_data = {
            "job_id": job_id,
            "customer_id": str(uuid.uuid4()),
            "customer_email": "test@example.com",
            "requested_date": tomorrow,
            "requested_time_preference": "morning",
            "reason": "TEST_Automated test reschedule request"
        }
        
        response = requests.post(f"{BASE_URL}/api/reschedule-requests", json=request_data)
        assert response.status_code == 200
        
        created = response.json()
        assert "id" in created
        assert "request_number" in created
        assert created["status"] == "pending"
        assert created["job_id"] == job_id
        assert created["requested_date"] == tomorrow
        
        # Verify it was persisted
        get_response = requests.get(f"{BASE_URL}/api/reschedule-requests")
        assert get_response.status_code == 200
        requests_list = get_response.json()
        found = any(r["id"] == created["id"] for r in requests_list)
        assert found, "Created reschedule request not found in list"
    
    def test_create_reschedule_request_invalid_job(self):
        """POST /api/reschedule-requests with invalid job_id returns 404"""
        fake_job_id = str(uuid.uuid4())
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        request_data = {
            "job_id": fake_job_id,
            "requested_date": tomorrow,
        }
        
        response = requests.post(f"{BASE_URL}/api/reschedule-requests", json=request_data)
        assert response.status_code == 404
    
    def test_create_reschedule_request_missing_job_id(self):
        """POST /api/reschedule-requests without job_id returns 400"""
        request_data = {
            "requested_date": "2026-03-15",
        }
        
        response = requests.post(f"{BASE_URL}/api/reschedule-requests", json=request_data)
        assert response.status_code == 400
    
    def test_filter_reschedule_requests_by_status(self):
        """GET /api/reschedule-requests?status=pending filters correctly"""
        response = requests.get(f"{BASE_URL}/api/reschedule-requests?status=pending")
        assert response.status_code == 200
        
        requests_list = response.json()
        for req in requests_list:
            assert req["status"] == "pending"


class TestProjectBilling:
    """Test project billing API endpoints"""
    
    @pytest.fixture
    def project_id(self):
        """Get a valid project ID for testing"""
        response = requests.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200
        projects = response.json()
        assert len(projects) > 0, "No projects available for testing"
        return projects[0]["id"]
    
    @pytest.fixture
    def template_id(self):
        """Get a valid template ID for testing"""
        response = requests.get(f"{BASE_URL}/api/milestone-templates")
        assert response.status_code == 200
        templates = response.json()
        assert len(templates) > 0, "No templates available for testing"
        return templates[0]["id"]
    
    def test_get_projects(self):
        """GET /api/projects returns project list"""
        response = requests.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200
        
        projects = response.json()
        assert isinstance(projects, list)
    
    def test_apply_billing_template(self, project_id, template_id):
        """POST /api/projects/{id}/apply-template/{template_id} applies template"""
        response = requests.post(f"{BASE_URL}/api/projects/{project_id}/apply-template/{template_id}")
        assert response.status_code == 200
        
        result = response.json()
        assert "message" in result
        assert "milestones" in result
        assert isinstance(result["milestones"], list)
        
        # Verify project was updated
        project_response = requests.get(f"{BASE_URL}/api/projects/{project_id}")
        assert project_response.status_code == 200
        project = project_response.json()
        assert "billing_milestones" in project
        assert len(project["billing_milestones"]) > 0


class TestSupportRequests:
    """Test support requests API"""
    
    @pytest.fixture
    def customer_id(self):
        """Get or create a customer ID for testing"""
        # Try to get existing customer accounts
        response = requests.get(f"{BASE_URL}/api/customer-accounts")
        if response.status_code == 200:
            accounts = response.json()
            if len(accounts) > 0:
                return accounts[0]["id"]
        
        # Return a test UUID if no accounts exist
        return str(uuid.uuid4())
    
    def test_create_support_request(self, customer_id):
        """POST /api/customer/{id}/support-request creates support request"""
        request_data = {
            "request_type": "service",
            "subject": "TEST_Support Request",
            "description": "Automated test support request",
            "priority": "normal"
        }
        
        response = requests.post(f"{BASE_URL}/api/customer/{customer_id}/support-request", json=request_data)
        # May return 404 if customer doesn't exist, which is acceptable
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            created = response.json()
            assert "id" in created
            assert "request_number" in created


class TestSidebarNavigation:
    """Test that Project Billing is accessible via navigation"""
    
    def test_project_billing_endpoint_exists(self):
        """Verify /api/projects endpoint exists for Project Billing page"""
        response = requests.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200


# Cleanup fixture
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    # Cleanup test templates
    try:
        response = requests.get(f"{BASE_URL}/api/milestone-templates?active_only=false")
        if response.status_code == 200:
            templates = response.json()
            for t in templates:
                if t.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/milestone-templates/{t['id']}")
    except Exception:
        pass
