"""
Time Tracking API Tests for BreezeFlow HVAC Management System
Tests the dual clock-in system for technicians:
- Shift clock-in/out with location capture
- Job dispatch, arrival, and completion tracking
- Travel time calculation and variance tracking
- Technician metrics
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data - use first technician from demo data
TEST_TECHNICIAN_ID = None
TEST_JOB_ID = None
TEST_JOB_NUMBER = None


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def test_data(api_client):
    """Get test data from existing demo data"""
    global TEST_TECHNICIAN_ID, TEST_JOB_ID, TEST_JOB_NUMBER
    
    # Get technicians
    techs_response = api_client.get(f"{BASE_URL}/api/technicians")
    assert techs_response.status_code == 200, f"Failed to get technicians: {techs_response.text}"
    techs = techs_response.json()
    assert len(techs) > 0, "No technicians found - load demo data first"
    TEST_TECHNICIAN_ID = techs[0]["id"]
    
    # Get jobs
    jobs_response = api_client.get(f"{BASE_URL}/api/jobs")
    assert jobs_response.status_code == 200, f"Failed to get jobs: {jobs_response.text}"
    jobs = jobs_response.json()
    assert len(jobs) > 0, "No jobs found - load demo data first"
    TEST_JOB_ID = jobs[0]["id"]
    TEST_JOB_NUMBER = jobs[0]["job_number"]
    
    return {
        "technician_id": TEST_TECHNICIAN_ID,
        "job_id": TEST_JOB_ID,
        "job_number": TEST_JOB_NUMBER
    }


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self, api_client):
        """Test API health endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"


class TestShiftClockInOut:
    """Tests for shift clock-in/out functionality"""
    
    def test_start_shift_without_location(self, api_client, test_data):
        """Test starting a shift without location data"""
        tech_id = test_data["technician_id"]
        
        # First, ensure no active shift exists by trying to end any existing shift
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
        
        # Start shift without location
        response = api_client.post(f"{BASE_URL}/api/time-tracking/shift/start?technician_id={tech_id}")
        assert response.status_code == 200, f"Failed to start shift: {response.text}"
        
        data = response.json()
        assert data["message"] == "Shift started"
        assert "session_id" in data
        assert "shift_start" in data
        assert data["location_captured"] == False
        
        # Clean up - end the shift
        end_response = api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
        assert end_response.status_code == 200
    
    def test_start_shift_with_location(self, api_client, test_data):
        """Test starting a shift with location data"""
        tech_id = test_data["technician_id"]
        
        # Ensure no active shift
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
        
        location = {
            "latitude": 32.7767,
            "longitude": -96.7970,
            "address": "Dallas, TX",
            "accuracy": 10.0
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/time-tracking/shift/start?technician_id={tech_id}",
            json=location
        )
        assert response.status_code == 200, f"Failed to start shift with location: {response.text}"
        
        data = response.json()
        assert data["message"] == "Shift started"
        assert data["location_captured"] == True
        
        # Clean up
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
    
    def test_start_shift_duplicate_error(self, api_client, test_data):
        """Test that starting a shift when one is active returns error"""
        tech_id = test_data["technician_id"]
        
        # Ensure no active shift first
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
        
        # Start first shift
        response1 = api_client.post(f"{BASE_URL}/api/time-tracking/shift/start?technician_id={tech_id}")
        assert response1.status_code == 200
        
        # Try to start second shift - should fail
        response2 = api_client.post(f"{BASE_URL}/api/time-tracking/shift/start?technician_id={tech_id}")
        assert response2.status_code == 400
        assert "Active shift already exists" in response2.json()["detail"]
        
        # Clean up
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
    
    def test_end_shift_no_active(self, api_client, test_data):
        """Test ending shift when no active shift exists"""
        tech_id = test_data["technician_id"]
        
        # Ensure no active shift
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
        
        # Try to end again - should fail
        response = api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
        assert response.status_code == 400
        assert "No active shift found" in response.json()["detail"]
    
    def test_end_shift_success(self, api_client, test_data):
        """Test successfully ending a shift"""
        tech_id = test_data["technician_id"]
        
        # Ensure no active shift
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
        
        # Start shift
        start_response = api_client.post(f"{BASE_URL}/api/time-tracking/shift/start?technician_id={tech_id}")
        assert start_response.status_code == 200
        
        # End shift
        response = api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["message"] == "Shift ended"
        assert "session_id" in data
        assert "total_shift_hours" in data
        assert "jobs_completed" in data
        assert isinstance(data["total_shift_hours"], (int, float))
    
    def test_get_active_shift_none(self, api_client, test_data):
        """Test getting active shift when none exists"""
        tech_id = test_data["technician_id"]
        
        # Ensure no active shift
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
        
        response = api_client.get(f"{BASE_URL}/api/time-tracking/shift/active/{tech_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["active"] == False
        assert data["session"] is None
    
    def test_get_active_shift_exists(self, api_client, test_data):
        """Test getting active shift when one exists"""
        tech_id = test_data["technician_id"]
        
        # Ensure no active shift
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
        
        # Start shift
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/start?technician_id={tech_id}")
        
        response = api_client.get(f"{BASE_URL}/api/time-tracking/shift/active/{tech_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["active"] == True
        assert data["session"] is not None
        assert data["session"]["technician_id"] == tech_id
        assert data["session"]["status"] == "active"
        
        # Clean up
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
    
    def test_invalid_technician_id(self, api_client):
        """Test with invalid technician ID"""
        response = api_client.post(f"{BASE_URL}/api/time-tracking/shift/start?technician_id=invalid-id")
        assert response.status_code == 400
        assert "Invalid technician ID" in response.json()["detail"]
    
    def test_nonexistent_technician(self, api_client):
        """Test with non-existent technician ID"""
        fake_id = str(uuid.uuid4())
        response = api_client.post(f"{BASE_URL}/api/time-tracking/shift/start?technician_id={fake_id}")
        assert response.status_code == 404
        assert "Technician not found" in response.json()["detail"]


class TestJobTimeTracking:
    """Tests for job dispatch, arrival, and completion"""
    
    def test_dispatch_to_job_without_shift(self, api_client, test_data):
        """Test dispatching to job without active shift - should still work"""
        tech_id = test_data["technician_id"]
        job_id = test_data["job_id"]
        
        # Ensure no active shift
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
        
        dispatch_data = {
            "technician_id": tech_id,
            "job_id": job_id,
            "dispatch_location": {
                "latitude": 32.7767,
                "longitude": -96.7970
            }
        }
        
        response = api_client.post(f"{BASE_URL}/api/time-tracking/job/dispatch", json=dispatch_data)
        assert response.status_code == 200, f"Failed to dispatch: {response.text}"
        
        data = response.json()
        assert data["message"] == "Dispatched to job"
        assert "entry_id" in data
        assert "job_number" in data
    
    def test_dispatch_to_job_with_location(self, api_client, test_data):
        """Test dispatching to job with location - should calculate travel estimate"""
        tech_id = test_data["technician_id"]
        job_id = test_data["job_id"]
        
        # Start shift first
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/start?technician_id={tech_id}")
        
        dispatch_data = {
            "technician_id": tech_id,
            "job_id": job_id,
            "dispatch_location": {
                "latitude": 32.7767,
                "longitude": -96.7970,
                "address": "Dallas, TX"
            }
        }
        
        response = api_client.post(f"{BASE_URL}/api/time-tracking/job/dispatch", json=dispatch_data)
        assert response.status_code == 200, f"Failed to dispatch: {response.text}"
        
        data = response.json()
        assert data["message"] == "Dispatched to job"
        assert "entry_id" in data
        assert "estimated_travel_minutes" in data
        assert "estimated_distance_miles" in data
        
        # Store entry_id for next tests
        return data["entry_id"]
    
    def test_full_job_flow(self, api_client, test_data):
        """Test complete job flow: dispatch -> arrive -> complete"""
        tech_id = test_data["technician_id"]
        job_id = test_data["job_id"]
        
        # Clean up any existing state
        api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
        
        # Start shift
        shift_response = api_client.post(
            f"{BASE_URL}/api/time-tracking/shift/start?technician_id={tech_id}",
            json={"latitude": 32.7767, "longitude": -96.7970}
        )
        assert shift_response.status_code == 200
        
        # Dispatch to job
        dispatch_data = {
            "technician_id": tech_id,
            "job_id": job_id,
            "dispatch_location": {"latitude": 32.7767, "longitude": -96.7970}
        }
        dispatch_response = api_client.post(f"{BASE_URL}/api/time-tracking/job/dispatch", json=dispatch_data)
        assert dispatch_response.status_code == 200, f"Dispatch failed: {dispatch_response.text}"
        entry_id = dispatch_response.json()["entry_id"]
        
        # Verify active job entry
        active_response = api_client.get(f"{BASE_URL}/api/time-tracking/job/active/{tech_id}")
        assert active_response.status_code == 200
        active_data = active_response.json()
        assert active_data["active"] == True
        assert active_data["entry"]["status"] == "traveling"
        
        # Arrive at job
        arrive_response = api_client.post(
            f"{BASE_URL}/api/time-tracking/job/arrive/{entry_id}",
            json={"latitude": 32.7800, "longitude": -96.8000}
        )
        assert arrive_response.status_code == 200, f"Arrive failed: {arrive_response.text}"
        arrive_data = arrive_response.json()
        assert arrive_data["message"] == "Arrived at job site"
        assert "actual_travel_minutes" in arrive_data
        
        # Verify status changed to on_site
        active_response2 = api_client.get(f"{BASE_URL}/api/time-tracking/job/active/{tech_id}")
        assert active_response2.json()["entry"]["status"] == "on_site"
        
        # Complete job
        complete_response = api_client.post(
            f"{BASE_URL}/api/time-tracking/job/complete/{entry_id}",
            json={"latitude": 32.7800, "longitude": -96.8000}
        )
        assert complete_response.status_code == 200, f"Complete failed: {complete_response.text}"
        complete_data = complete_response.json()
        assert complete_data["message"] == "Job completed"
        assert "actual_job_minutes" in complete_data
        assert "actual_job_hours" in complete_data
        
        # Verify no active job entry
        active_response3 = api_client.get(f"{BASE_URL}/api/time-tracking/job/active/{tech_id}")
        assert active_response3.json()["active"] == False
        
        # End shift
        end_response = api_client.post(f"{BASE_URL}/api/time-tracking/shift/end?technician_id={tech_id}")
        assert end_response.status_code == 200
        assert end_response.json()["jobs_completed"] >= 1
    
    def test_arrive_invalid_status(self, api_client, test_data):
        """Test arriving at job with invalid status"""
        fake_entry_id = str(uuid.uuid4())
        response = api_client.post(f"{BASE_URL}/api/time-tracking/job/arrive/{fake_entry_id}")
        assert response.status_code == 404
    
    def test_complete_invalid_status(self, api_client, test_data):
        """Test completing job with invalid status"""
        fake_entry_id = str(uuid.uuid4())
        response = api_client.post(f"{BASE_URL}/api/time-tracking/job/complete/{fake_entry_id}")
        assert response.status_code == 404
    
    def test_dispatch_invalid_job(self, api_client, test_data):
        """Test dispatching to non-existent job"""
        tech_id = test_data["technician_id"]
        fake_job_id = str(uuid.uuid4())
        
        dispatch_data = {
            "technician_id": tech_id,
            "job_id": fake_job_id
        }
        
        response = api_client.post(f"{BASE_URL}/api/time-tracking/job/dispatch", json=dispatch_data)
        assert response.status_code == 404
        assert "Job not found" in response.json()["detail"]


class TestTechnicianMetrics:
    """Tests for technician metrics endpoint"""
    
    def test_get_metrics_empty(self, api_client, test_data):
        """Test getting metrics for technician with no history"""
        tech_id = test_data["technician_id"]
        
        response = api_client.get(f"{BASE_URL}/api/time-tracking/metrics/{tech_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["technician_id"] == tech_id
        assert "technician_name" in data
        assert "avg_travel_minutes" in data
        assert "total_jobs_tracked" in data
    
    def test_get_metrics_invalid_id(self, api_client):
        """Test getting metrics with invalid technician ID"""
        response = api_client.get(f"{BASE_URL}/api/time-tracking/metrics/invalid-id")
        assert response.status_code == 400
    
    def test_get_metrics_nonexistent(self, api_client):
        """Test getting metrics for non-existent technician"""
        fake_id = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/time-tracking/metrics/{fake_id}")
        assert response.status_code == 404


class TestRouteEstimation:
    """Tests for route estimation endpoint"""
    
    def test_route_estimate(self, api_client):
        """Test route estimation between two points"""
        origin = {"latitude": 32.7767, "longitude": -96.7970}
        destination = {"latitude": 32.9483, "longitude": -96.7299}
        
        response = api_client.post(
            f"{BASE_URL}/api/time-tracking/route-estimate",
            json={"origin": origin, "destination": destination}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "estimated_minutes" in data
        assert "estimated_miles" in data
        assert "route_count" in data
        assert data["route_count"] == 3
        assert "confidence" in data
        assert data["estimated_miles"] > 0
        assert data["estimated_minutes"] > 0


class TestTimeTrackingHistory:
    """Tests for time tracking history endpoint"""
    
    def test_get_history(self, api_client, test_data):
        """Test getting time tracking history"""
        tech_id = test_data["technician_id"]
        
        response = api_client.get(f"{BASE_URL}/api/time-tracking/history/{tech_id}?days=30")
        assert response.status_code == 200
        
        data = response.json()
        assert "job_entries" in data
        assert "shifts" in data
        assert isinstance(data["job_entries"], list)
        assert isinstance(data["shifts"], list)
    
    def test_get_history_invalid_id(self, api_client):
        """Test getting history with invalid technician ID"""
        response = api_client.get(f"{BASE_URL}/api/time-tracking/history/invalid-id")
        assert response.status_code == 400


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
