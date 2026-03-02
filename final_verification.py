#!/usr/bin/env python3
"""
Final verification test for all key backend endpoints
"""

import requests
import json

BASE_URL = "https://hvac-dispatch-hub.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def test_key_endpoints():
    """Test all key endpoints mentioned in the review request"""
    print("🔍 Final Backend API Verification")
    print("=" * 50)
    
    results = []
    
    # 1. Seed API
    print("1. Testing Seed API...")
    response = requests.post(f"{BASE_URL}/seed", headers=HEADERS)
    results.append(("POST /api/seed", response.status_code == 200))
    print(f"   Status: {response.status_code}")
    
    # 2. Technicians API
    print("\n2. Testing Technicians API...")
    
    # GET /technicians
    response = requests.get(f"{BASE_URL}/technicians", headers=HEADERS)
    results.append(("GET /api/technicians", response.status_code == 200))
    
    if response.status_code == 200:
        techs = response.json()
        if techs:
            tech_id = techs[0]['id']
            
            # GET /technicians/{id}
            response = requests.get(f"{BASE_URL}/technicians/{tech_id}", headers=HEADERS)
            results.append(("GET /api/technicians/{id}", response.status_code == 200))
            
            # GET /technicians/{id}/public
            response = requests.get(f"{BASE_URL}/technicians/{tech_id}/public", headers=HEADERS)
            results.append(("GET /api/technicians/{id}/public", response.status_code == 200))
            
            # POST /technicians/{id}/image
            image_data = {"image_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="}
            response = requests.post(f"{BASE_URL}/technicians/{tech_id}/image", headers=HEADERS, json=image_data)
            results.append(("POST /api/technicians/{id}/image", response.status_code == 200))
    
    # POST /technicians
    tech_data = {
        "employee_number": "TECH-FINAL-001",
        "name": "Final Test Tech",
        "email": "final@test.com",
        "phone": "(555) 999-0000",
        "role": "Technician",
        "specialty": "Testing",
        "location": "Test City, TX"
    }
    response = requests.post(f"{BASE_URL}/technicians", headers=HEADERS, json=tech_data)
    results.append(("POST /api/technicians", response.status_code == 200))
    
    if response.status_code == 200:
        new_tech_id = response.json()['id']
        
        # PUT /technicians/{id}
        update_data = {"bio": "Updated bio for final test"}
        response = requests.put(f"{BASE_URL}/technicians/{new_tech_id}", headers=HEADERS, json=update_data)
        results.append(("PUT /api/technicians/{id}", response.status_code == 200))
    
    # 3. Board Config API
    print("\n3. Testing Board Config API...")
    
    # GET /board-configs/default
    response = requests.get(f"{BASE_URL}/board-configs/default", headers=HEADERS)
    results.append(("GET /api/board-configs/default", response.status_code == 200))
    
    # GET /board-configs
    response = requests.get(f"{BASE_URL}/board-configs", headers=HEADERS)
    results.append(("GET /api/board-configs", response.status_code == 200))
    
    # POST /board-configs
    config_data = {
        "name": "Final Test Config",
        "columns": [
            {"name": "Test", "key": "test", "color": "#ff0000", "order": 0}
        ]
    }
    response = requests.post(f"{BASE_URL}/board-configs", headers=HEADERS, json=config_data)
    results.append(("POST /api/board-configs", response.status_code == 200))
    
    if response.status_code == 200:
        config_id = response.json()['id']
        
        # PUT /board-configs/{id}
        update_config = {"name": "Updated Final Test Config"}
        response = requests.put(f"{BASE_URL}/board-configs/{config_id}", headers=HEADERS, json=update_config)
        results.append(("PUT /api/board-configs/{id}", response.status_code == 200))
    
    # 4. Jobs API
    print("\n4. Testing Jobs API...")
    
    # GET /jobs
    response = requests.get(f"{BASE_URL}/jobs", headers=HEADERS)
    results.append(("GET /api/jobs", response.status_code == 200))
    
    if response.status_code == 200:
        jobs = response.json()
        if jobs:
            job_id = jobs[0]['id']
            job_number = jobs[0]['job_number']
            
            # GET /jobs/{id}
            response = requests.get(f"{BASE_URL}/jobs/{job_id}", headers=HEADERS)
            results.append(("GET /api/jobs/{id}", response.status_code == 200))
            
            # GET /jobs/{job_number}
            response = requests.get(f"{BASE_URL}/jobs/{job_number}", headers=HEADERS)
            results.append(("GET /api/jobs/{job_number}", response.status_code == 200))
    
    # POST /jobs
    job_data = {
        "customer_name": "Final Test Customer",
        "site_address": "123 Final Test St",
        "job_type": "Test Job",
        "title": "Final Test Job"
    }
    response = requests.post(f"{BASE_URL}/jobs", headers=HEADERS, json=job_data)
    results.append(("POST /api/jobs", response.status_code == 200))
    
    if response.status_code == 200:
        new_job_id = response.json()['id']
        
        # PUT /jobs/{id}
        update_job = {"description": "Updated description"}
        response = requests.put(f"{BASE_URL}/jobs/{new_job_id}", headers=HEADERS, json=update_job)
        results.append(("PUT /api/jobs/{id}", response.status_code == 200))
    
    # 5. Tasks API
    print("\n5. Testing Tasks API...")
    
    # Get job for tasks
    response = requests.get(f"{BASE_URL}/jobs", headers=HEADERS)
    if response.status_code == 200:
        jobs = response.json()
        if jobs:
            job_id = jobs[0]['id']
            
            # GET /tasks?job_id={job_id}
            response = requests.get(f"{BASE_URL}/tasks", headers=HEADERS, params={"job_id": job_id})
            results.append(("GET /api/tasks?job_id={job_id}", response.status_code == 200))
            
            # POST /tasks
            task_data = {
                "job_id": job_id,
                "title": "Final Test Task",
                "task_type": "service",
                "status": "lead"
            }
            response = requests.post(f"{BASE_URL}/tasks", headers=HEADERS, json=task_data)
            results.append(("POST /api/tasks", response.status_code == 200))
            
            if response.status_code == 200:
                task_id = response.json()['id']
                
                # PUT /tasks/{id}
                update_task = {"notes": "Updated notes"}
                response = requests.put(f"{BASE_URL}/tasks/{task_id}", headers=HEADERS, json=update_task)
                results.append(("PUT /api/tasks/{id}", response.status_code == 200))
                
                # POST /tasks/move
                move_data = {
                    "task_id": task_id,
                    "new_status": "dispatched",
                    "new_order": 0
                }
                response = requests.post(f"{BASE_URL}/tasks/move", headers=HEADERS, json=move_data)
                results.append(("POST /api/tasks/move", response.status_code == 200))
    
    # 6. Appointments API
    print("\n6. Testing Appointments API...")
    
    # Get prerequisites
    response = requests.get(f"{BASE_URL}/jobs", headers=HEADERS)
    jobs = response.json() if response.status_code == 200 else []
    
    response = requests.get(f"{BASE_URL}/technicians", headers=HEADERS)
    techs = response.json() if response.status_code == 200 else []
    
    if jobs and techs:
        # POST /appointments
        appt_data = {
            "job_id": jobs[0]['id'],
            "technician_id": techs[0]['id'],
            "customer_name": "Final Test Customer",
            "site_address": "123 Test St",
            "scheduled_date": "2026-03-20",
            "scheduled_time": "10:00",
            "job_type": "Test Appointment"
        }
        response = requests.post(f"{BASE_URL}/appointments", headers=HEADERS, json=appt_data)
        results.append(("POST /api/appointments", response.status_code == 200))
        
        if response.status_code == 200:
            appt = response.json()
            appt_id = appt['id']
            token = appt['confirmation_token']
            
            # GET /appointments/{id}
            response = requests.get(f"{BASE_URL}/appointments/{appt_id}", headers=HEADERS)
            results.append(("GET /api/appointments/{id}", response.status_code == 200))
            
            # GET /appointments/confirmation/{token}
            response = requests.get(f"{BASE_URL}/appointments/confirmation/{token}", headers=HEADERS)
            results.append(("GET /api/appointments/confirmation/{token}", response.status_code == 200))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 FINAL VERIFICATION RESULTS")
    print("=" * 50)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for endpoint, success in results:
        status = "✅" if success else "❌"
        print(f"{status} {endpoint}")
    
    print(f"\nSUMMARY: {passed}/{total} endpoints working ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL KEY ENDPOINTS WORKING CORRECTLY!")
    else:
        print("⚠️  Some endpoints have issues")
    
    return passed == total

if __name__ == "__main__":
    test_key_endpoints()