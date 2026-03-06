"""
Test Sites and Projects API endpoints
Tests for BreezeFlow HVAC Sites and Projects pages implementation
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://climate-control-pro-3.preview.emergentagent.com')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self, api_client):
        """Test API health endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ API health check passed: {data}")


class TestCustomersAPI:
    """Test /api/customers endpoints"""
    
    def test_get_customers_list(self, api_client):
        """Test GET /api/customers returns customer list"""
        response = api_client.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/customers returned {len(data)} customers")
        
        # Verify customer structure if any exist
        if len(data) > 0:
            customer = data[0]
            assert "id" in customer
            assert "name" in customer
            print(f"  Sample customer: {customer.get('name')}")
    
    def test_get_customers_with_search(self, api_client):
        """Test GET /api/customers with search parameter"""
        response = api_client.get(f"{BASE_URL}/api/customers?search=test")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/customers?search=test returned {len(data)} results")


class TestSitesAPI:
    """Test /api/sites endpoints"""
    
    def test_get_sites_list(self, api_client):
        """Test GET /api/sites returns site list"""
        response = api_client.get(f"{BASE_URL}/api/sites")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/sites returned {len(data)} sites")
        
        # Verify site structure if any exist
        if len(data) > 0:
            site = data[0]
            assert "id" in site
            assert "name" in site
            assert "address" in site
            assert "site_type" in site
            assert "customer_id" in site
            print(f"  Sample site: {site.get('name')} - {site.get('address')}")
            return site
        return None
    
    def test_get_sites_with_type_filter(self, api_client):
        """Test GET /api/sites with site_type filter"""
        response = api_client.get(f"{BASE_URL}/api/sites?site_type=residential")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/sites?site_type=residential returned {len(data)} sites")
        
        # Verify all returned sites are residential
        for site in data:
            assert site.get("site_type") == "residential"
    
    def test_get_sites_with_search(self, api_client):
        """Test GET /api/sites with search parameter"""
        response = api_client.get(f"{BASE_URL}/api/sites?search=test")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/sites?search=test returned {len(data)} results")
    
    def test_get_site_by_id(self, api_client):
        """Test GET /api/sites/{site_id} returns site details"""
        # First get list of sites
        list_response = api_client.get(f"{BASE_URL}/api/sites")
        assert list_response.status_code == 200
        sites = list_response.json()
        
        if len(sites) == 0:
            pytest.skip("No sites available to test")
        
        site_id = sites[0]["id"]
        response = api_client.get(f"{BASE_URL}/api/sites/{site_id}")
        assert response.status_code == 200
        site = response.json()
        assert site["id"] == site_id
        print(f"✓ GET /api/sites/{site_id} returned site: {site.get('name')}")
    
    def test_get_site_jobs(self, api_client):
        """Test GET /api/sites/{site_id}/jobs returns job history"""
        # First get list of sites
        list_response = api_client.get(f"{BASE_URL}/api/sites")
        assert list_response.status_code == 200
        sites = list_response.json()
        
        if len(sites) == 0:
            pytest.skip("No sites available to test")
        
        site_id = sites[0]["id"]
        response = api_client.get(f"{BASE_URL}/api/sites/{site_id}/jobs")
        assert response.status_code == 200
        jobs = response.json()
        assert isinstance(jobs, list)
        print(f"✓ GET /api/sites/{site_id}/jobs returned {len(jobs)} jobs")
    
    def test_get_site_equipment(self, api_client):
        """Test GET /api/sites/{site_id}/equipment returns equipment list"""
        # First get list of sites
        list_response = api_client.get(f"{BASE_URL}/api/sites")
        assert list_response.status_code == 200
        sites = list_response.json()
        
        if len(sites) == 0:
            pytest.skip("No sites available to test")
        
        site_id = sites[0]["id"]
        response = api_client.get(f"{BASE_URL}/api/sites/{site_id}/equipment")
        assert response.status_code == 200
        equipment = response.json()
        assert isinstance(equipment, list)
        print(f"✓ GET /api/sites/{site_id}/equipment returned {len(equipment)} items")
    
    def test_migrate_sites_from_jobs(self, api_client):
        """Test POST /api/sites/migrate-from-jobs endpoint"""
        response = api_client.post(f"{BASE_URL}/api/sites/migrate-from-jobs")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "sites_created" in data
        print(f"✓ POST /api/sites/migrate-from-jobs: {data}")
    
    def test_get_site_invalid_id(self, api_client):
        """Test GET /api/sites/{invalid_id} returns 400"""
        response = api_client.get(f"{BASE_URL}/api/sites/invalid-id")
        assert response.status_code == 400
        print("✓ GET /api/sites/invalid-id correctly returned 400")
    
    def test_get_site_not_found(self, api_client):
        """Test GET /api/sites/{non_existent_id} returns 404"""
        fake_id = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/sites/{fake_id}")
        assert response.status_code == 404
        print(f"✓ GET /api/sites/{fake_id} correctly returned 404")


class TestProjectsAPI:
    """Test /api/projects endpoints"""
    
    def test_get_projects_list(self, api_client):
        """Test GET /api/projects returns project list"""
        response = api_client.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/projects returned {len(data)} projects")
        
        # Verify project structure if any exist
        if len(data) > 0:
            project = data[0]
            assert "id" in project
            assert "project_number" in project
            assert "name" in project
            assert "status" in project
            assert "planned_start_date" in project
            assert "planned_end_date" in project
            print(f"  Sample project: {project.get('project_number')} - {project.get('name')}")
            return project
        return None
    
    def test_get_projects_with_status_filter(self, api_client):
        """Test GET /api/projects with status filter"""
        response = api_client.get(f"{BASE_URL}/api/projects?status=in_progress")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/projects?status=in_progress returned {len(data)} projects")
    
    def test_get_project_by_id(self, api_client):
        """Test GET /api/projects/{project_id} returns project details"""
        # First get list of projects
        list_response = api_client.get(f"{BASE_URL}/api/projects")
        assert list_response.status_code == 200
        projects = list_response.json()
        
        if len(projects) == 0:
            pytest.skip("No projects available to test")
        
        project_id = projects[0]["id"]
        response = api_client.get(f"{BASE_URL}/api/projects/{project_id}")
        assert response.status_code == 200
        project = response.json()
        assert project["id"] == project_id
        print(f"✓ GET /api/projects/{project_id} returned project: {project.get('name')}")
    
    def test_get_project_gantt_data(self, api_client):
        """Test GET /api/projects/gantt-data/{project_id} returns Gantt chart data"""
        # First get list of projects
        list_response = api_client.get(f"{BASE_URL}/api/projects")
        assert list_response.status_code == 200
        projects = list_response.json()
        
        if len(projects) == 0:
            pytest.skip("No projects available to test")
        
        project_id = projects[0]["id"]
        response = api_client.get(f"{BASE_URL}/api/projects/gantt-data/{project_id}")
        assert response.status_code == 200
        gantt_data = response.json()
        assert "project" in gantt_data
        assert "phases" in gantt_data
        assert "resources" in gantt_data
        print(f"✓ GET /api/projects/gantt-data/{project_id} returned Gantt data")
        print(f"  Project: {gantt_data['project'].get('name')}")
        print(f"  Phases: {len(gantt_data['phases'])}")
        print(f"  Resources: {len(gantt_data['resources'])}")
    
    def test_get_project_invalid_id(self, api_client):
        """Test GET /api/projects/{invalid_id} returns 400"""
        response = api_client.get(f"{BASE_URL}/api/projects/invalid-id")
        assert response.status_code == 400
        print("✓ GET /api/projects/invalid-id correctly returned 400")
    
    def test_get_project_not_found(self, api_client):
        """Test GET /api/projects/{non_existent_id} returns 404"""
        fake_id = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/projects/{fake_id}")
        assert response.status_code == 404
        print(f"✓ GET /api/projects/{fake_id} correctly returned 404")


class TestSitesCRUD:
    """Test Sites CRUD operations"""
    
    def test_create_site_requires_customer(self, api_client):
        """Test POST /api/sites requires valid customer_id"""
        # Try to create site with non-existent customer
        fake_customer_id = str(uuid.uuid4())
        site_data = {
            "customer_id": fake_customer_id,
            "name": "TEST_Site",
            "address": "123 Test St",
            "site_type": "residential"
        }
        response = api_client.post(f"{BASE_URL}/api/sites", json=site_data)
        assert response.status_code == 404  # Customer not found
        print("✓ POST /api/sites correctly requires valid customer_id")
    
    def test_create_and_delete_site(self, api_client):
        """Test full CRUD cycle for sites"""
        # First get a customer to use
        customers_response = api_client.get(f"{BASE_URL}/api/customers")
        assert customers_response.status_code == 200
        customers = customers_response.json()
        
        if len(customers) == 0:
            pytest.skip("No customers available to test site creation")
        
        customer_id = customers[0]["id"]
        
        # Create site
        site_data = {
            "customer_id": customer_id,
            "name": "TEST_Automated Test Site",
            "address": "999 Test Boulevard",
            "city": "Test City",
            "state": "TX",
            "zip_code": "75001",
            "site_type": "residential",
            "has_pets": True,
            "pet_notes": "Friendly dog"
        }
        create_response = api_client.post(f"{BASE_URL}/api/sites", json=site_data)
        assert create_response.status_code == 200
        created_site = create_response.json()
        assert created_site["name"] == site_data["name"]
        assert created_site["address"] == site_data["address"]
        site_id = created_site["id"]
        print(f"✓ Created site: {site_id}")
        
        # Verify site exists
        get_response = api_client.get(f"{BASE_URL}/api/sites/{site_id}")
        assert get_response.status_code == 200
        fetched_site = get_response.json()
        assert fetched_site["id"] == site_id
        print(f"✓ Verified site exists: {fetched_site['name']}")
        
        # Delete (soft delete) site
        delete_response = api_client.delete(f"{BASE_URL}/api/sites/{site_id}")
        assert delete_response.status_code == 200
        print(f"✓ Deleted site: {site_id}")


class TestJobsAPI:
    """Test /api/jobs endpoints for site integration"""
    
    def test_get_jobs_list(self, api_client):
        """Test GET /api/jobs returns job list"""
        response = api_client.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/jobs returned {len(data)} jobs")
        
        # Check if jobs have site_address for migration
        jobs_with_address = [j for j in data if j.get("site_address")]
        print(f"  Jobs with site_address: {len(jobs_with_address)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
