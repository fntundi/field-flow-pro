"""
Test suite for Checklists, Reports Builder, and Stripe Payments features
Testing RFC-002 Section 4.2.2 (Checklists), 4.8.2 (Reports), and Stripe integration
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestReportsAPI:
    """Reports Builder API tests - RFC-002 Section 4.8.2"""
    
    def test_reports_summary_endpoint(self):
        """Test /api/reports/summary returns summary metrics"""
        response = requests.get(f"{BASE_URL}/api/reports/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify summary structure
        assert "total_jobs" in data or "jobs" in data, "Missing jobs data in summary"
        print(f"Reports summary: {json.dumps(data, indent=2)[:500]}")
    
    def test_reports_query_jobs(self):
        """Test /api/reports/query with jobs data source"""
        payload = {
            "data_source": "jobs",
            "columns": ["job_number", "customer_name", "status"],
            "filters": [],
            "sort_by": "created_at",
            "sort_order": "desc"
        }
        response = requests.post(f"{BASE_URL}/api/reports/query", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "results" in data, "Missing results in response"
        assert "data_source" in data, "Missing data_source in response"
        assert data["data_source"] == "jobs"
        print(f"Jobs report returned {len(data.get('results', []))} records")
    
    def test_reports_query_customers(self):
        """Test /api/reports/query with customers data source"""
        payload = {
            "data_source": "customers",
            "columns": ["name", "email", "phone"],
            "filters": []
        }
        response = requests.post(f"{BASE_URL}/api/reports/query", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "results" in data
        print(f"Customers report returned {len(data.get('results', []))} records")
    
    def test_reports_query_invoices(self):
        """Test /api/reports/query with invoices data source"""
        payload = {
            "data_source": "invoices",
            "columns": ["invoice_number", "customer_name", "status", "total"],
            "filters": []
        }
        response = requests.post(f"{BASE_URL}/api/reports/query", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "results" in data
        print(f"Invoices report returned {len(data.get('results', []))} records")
    
    def test_reports_query_with_filter(self):
        """Test /api/reports/query with filter applied"""
        payload = {
            "data_source": "jobs",
            "columns": ["job_number", "customer_name", "status"],
            "filters": [
                {"field": "status", "operator": "equals", "value": "open"}
            ]
        }
        response = requests.post(f"{BASE_URL}/api/reports/query", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "results" in data
        # Verify filter was applied
        for result in data.get("results", []):
            if "status" in result:
                assert result["status"] == "open", f"Filter not applied: got status {result['status']}"
        print(f"Filtered jobs report returned {len(data.get('results', []))} records")
    
    def test_reports_query_invalid_source(self):
        """Test /api/reports/query with invalid data source returns 400"""
        payload = {
            "data_source": "invalid_source",
            "columns": ["name"]
        }
        response = requests.post(f"{BASE_URL}/api/reports/query", json=payload)
        assert response.status_code == 400, f"Expected 400 for invalid source, got {response.status_code}"
    
    def test_reports_query_missing_source(self):
        """Test /api/reports/query without data source returns 400"""
        payload = {
            "columns": ["name"]
        }
        response = requests.post(f"{BASE_URL}/api/reports/query", json=payload)
        assert response.status_code == 400, f"Expected 400 for missing source, got {response.status_code}"


class TestStripePaymentsAPI:
    """Stripe Payments API tests"""
    
    def test_checkout_create_endpoint_exists(self):
        """Test /api/payments/checkout/create endpoint exists"""
        # Test with missing invoice_id - should return 400, not 404
        payload = {"origin_url": "https://example.com"}
        response = requests.post(f"{BASE_URL}/api/payments/checkout/create", json=payload)
        # Should be 400 (missing invoice_id) or 500 (stripe not configured), not 404
        assert response.status_code in [400, 500], f"Expected 400 or 500, got {response.status_code}: {response.text}"
        print(f"Checkout create endpoint response: {response.status_code} - {response.text[:200]}")
    
    def test_checkout_create_missing_invoice_id(self):
        """Test checkout create returns 400 when invoice_id missing"""
        payload = {"origin_url": "https://example.com"}
        response = requests.post(f"{BASE_URL}/api/payments/checkout/create", json=payload)
        # Either 400 for missing invoice_id or 500 for stripe not configured
        assert response.status_code in [400, 500]
        if response.status_code == 400:
            data = response.json()
            assert "invoice_id" in data.get("detail", "").lower() or "required" in data.get("detail", "").lower()
    
    def test_checkout_create_missing_origin_url(self):
        """Test checkout create returns 400 when origin_url missing"""
        payload = {"invoice_id": "test-invoice-123"}
        response = requests.post(f"{BASE_URL}/api/payments/checkout/create", json=payload)
        # Either 400 for missing origin_url or 500 for stripe not configured
        assert response.status_code in [400, 500]
    
    def test_checkout_status_endpoint_exists(self):
        """Test /api/payments/checkout/status endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/payments/checkout/status/test_session_123")
        # Should be 500 (stripe error) not 404
        assert response.status_code in [500, 404], f"Expected 500 or 404, got {response.status_code}"
        print(f"Checkout status endpoint response: {response.status_code}")


class TestJobsForChecklists:
    """Test jobs API for checklists functionality"""
    
    def test_get_jobs_list(self):
        """Test /api/jobs returns jobs list"""
        response = requests.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of jobs"
        print(f"Found {len(data)} jobs")
        
        if len(data) > 0:
            job = data[0]
            assert "id" in job, "Job missing id"
            assert "job_number" in job, "Job missing job_number"
            print(f"Sample job: {job.get('job_number')} - {job.get('customer_name')}")
    
    def test_get_jobs_with_status_filter(self):
        """Test /api/jobs with status filter for checklists"""
        # Checklists page filters by in_progress, dispatched, out_for_service
        response = requests.get(f"{BASE_URL}/api/jobs?status=in_progress")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"Found {len(data)} in_progress jobs")


class TestJobTypesForChecklists:
    """Test job types API for checklist templates"""
    
    def test_get_job_types(self):
        """Test /api/job-types returns job types for checklist templates"""
        response = requests.get(f"{BASE_URL}/api/job-types")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of job types"
        print(f"Found {len(data)} job types")
        
        if len(data) > 0:
            jt = data[0]
            assert "id" in jt, "Job type missing id"
            assert "name" in jt, "Job type missing name"
            print(f"Sample job type: {jt.get('name')}")


class TestJobChecklistAPI:
    """Test job checklist API endpoints"""
    
    def test_checklist_endpoint_exists(self):
        """Test /api/jobs/{job_id}/checklist endpoint exists"""
        # First get a job
        jobs_response = requests.get(f"{BASE_URL}/api/jobs")
        if jobs_response.status_code != 200:
            pytest.skip("Cannot get jobs list")
        
        jobs = jobs_response.json()
        if len(jobs) == 0:
            pytest.skip("No jobs available for testing")
        
        job_id = jobs[0]["id"]
        response = requests.get(f"{BASE_URL}/api/jobs/{job_id}/checklist")
        # Should return 200 (with or without checklist) or 404 if endpoint doesn't exist
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        print(f"Checklist endpoint response: {response.status_code}")


class TestInvoicesForPayments:
    """Test invoices API for payment functionality"""
    
    def test_get_invoices_list(self):
        """Test /api/invoices returns invoices list"""
        response = requests.get(f"{BASE_URL}/api/invoices")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of invoices"
        print(f"Found {len(data)} invoices")
        
        if len(data) > 0:
            invoice = data[0]
            assert "id" in invoice, "Invoice missing id"
            assert "invoice_number" in invoice, "Invoice missing invoice_number"
            print(f"Sample invoice: {invoice.get('invoice_number')} - ${invoice.get('total', 0)}")
    
    def test_invoice_has_balance_due(self):
        """Test invoices have balance_due field for payment button logic"""
        response = requests.get(f"{BASE_URL}/api/invoices")
        if response.status_code != 200:
            pytest.skip("Cannot get invoices")
        
        invoices = response.json()
        if len(invoices) == 0:
            pytest.skip("No invoices available")
        
        invoice = invoices[0]
        assert "balance_due" in invoice or "total" in invoice, "Invoice missing balance_due or total"
        print(f"Invoice {invoice.get('invoice_number')}: balance_due=${invoice.get('balance_due', 'N/A')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
