#!/usr/bin/env python3
"""
Detailed security validation tests to identify specific issues
"""

import requests
import json

BASE_URL = "https://field-service-mgmt-2.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def test_empty_uuid_issue():
    """Test the empty UUID issue specifically"""
    print("Testing empty UUID handling...")
    
    # Test empty string UUID - this should fail but is passing
    response = requests.get(f"{BASE_URL}/technicians/", headers=HEADERS)
    print(f"Empty UUID test: Status {response.status_code}")
    print(f"Response: {response.text[:200]}")
    
    # The issue is that /technicians/ redirects to /technicians (307 redirect)
    # This is a FastAPI behavior where trailing slash gets redirected
    
def test_image_size_validation():
    """Test image size validation specifically"""
    print("\nTesting image size validation...")
    
    # Get a technician ID first
    response = requests.get(f"{BASE_URL}/technicians", headers=HEADERS)
    if response.status_code == 200:
        techs = response.json()
        if techs:
            tech_id = techs[0]['id']
            
            # Test with actual large base64 data
            # Create a string that would decode to >5MB
            large_b64 = "A" * (7 * 1024 * 1024)  # 7MB when base64 decoded is ~5.25MB
            
            image_data = {
                "image_data": f"data:image/jpeg;base64,{large_b64}"
            }
            
            response = requests.post(f"{BASE_URL}/technicians/{tech_id}/image", 
                                   headers=HEADERS, json=image_data)
            print(f"Large image test: Status {response.status_code}")
            print(f"Response: {response.text[:200]}")

def test_input_sanitization():
    """Test input sanitization specifically"""
    print("\nTesting input sanitization...")
    
    # Test XSS and SQL injection
    malicious_job = {
        "customer_name": "<script>alert('xss')</script>",
        "site_address": "'; DROP TABLE jobs; --",
        "job_type": "Test",
        "title": "Test Job"
    }
    
    response = requests.post(f"{BASE_URL}/jobs", headers=HEADERS, json=malicious_job)
    print(f"Malicious input test: Status {response.status_code}")
    
    if response.status_code == 200:
        job_data = response.json()
        print(f"Customer name stored as: '{job_data.get('customer_name', '')}'")
        print(f"Site address stored as: '{job_data.get('site_address', '')}'")
        
        # Check if dangerous content is still there
        if '<script>' in job_data.get('customer_name', ''):
            print("❌ XSS content NOT sanitized")
        else:
            print("✅ XSS content appears sanitized")
            
        if 'DROP TABLE' in job_data.get('site_address', ''):
            print("❌ SQL injection content NOT sanitized")
        else:
            print("✅ SQL injection content appears sanitized")

if __name__ == "__main__":
    test_empty_uuid_issue()
    test_image_size_validation()
    test_input_sanitization()