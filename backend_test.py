#!/usr/bin/env python3
"""
Backend API Testing Suite for Field Service Management Application
Tests all backend endpoints with realistic data and security validations
"""

import requests
import json
import base64
import uuid
import sys
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://serviceflow-app-7.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class APITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = HEADERS
        self.test_results = []
        self.created_resources = {
            'technicians': [],
            'jobs': [],
            'tasks': [],
            'appointments': [],
            'board_configs': []
        }
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details,
            'response': response_data
        })
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=self.headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=self.headers, json=data, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=self.headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=self.headers, timeout=30)
            else:
                return False, f"Unsupported method: {method}", 400
                
            return response.status_code < 400, response.json() if response.content else {}, response.status_code
        except requests.exceptions.RequestException as e:
            return False, f"Request failed: {str(e)}", 0
        except json.JSONDecodeError:
            return False, "Invalid JSON response", response.status_code if 'response' in locals() else 0
    
    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n=== HEALTH CHECK TESTS ===")
        
        # Test root endpoint
        success, data, status = self.make_request("GET", "/")
        self.log_test("Root endpoint", success, f"Status: {status}", data)
        
        # Test health endpoint
        success, data, status = self.make_request("GET", "/health")
        self.log_test("Health check", success, f"Status: {status}, DB: {data.get('database', 'unknown')}", data)
    
    def test_seed_data(self):
        """Test seeding database with sample data"""
        print("\n=== SEED DATA TEST ===")
        
        success, data, status = self.make_request("POST", "/seed")
        self.log_test("Seed database", success, f"Status: {status}", data)
        
        if success:
            print(f"   Seeded: {data.get('technicians', 0)} technicians, {data.get('jobs', 0)} jobs, {data.get('tasks', 0)} tasks")
        
        return success
    
    def test_technicians_api(self):
        """Test all technician endpoints"""
        print("\n=== TECHNICIANS API TESTS ===")
        
        # Test GET /technicians (should have seeded data)
        success, data, status = self.make_request("GET", "/technicians")
        self.log_test("GET /technicians", success, f"Status: {status}, Count: {len(data) if isinstance(data, list) else 0}")
        
        if success and data:
            tech_id = data[0]['id']
            self.created_resources['technicians'].append(tech_id)
            
            # Test GET /technicians/{id}
            success, tech_data, status = self.make_request("GET", f"/technicians/{tech_id}")
            self.log_test("GET /technicians/{id}", success, f"Status: {status}, Name: {tech_data.get('name', 'N/A')}")
            
            # Test GET /technicians/{id}/public
            success, public_data, status = self.make_request("GET", f"/technicians/{tech_id}/public")
            self.log_test("GET /technicians/{id}/public", success, f"Status: {status}, Public profile for: {public_data.get('name', 'N/A')}")
        
        # Test POST /technicians (create new)
        new_tech_data = {
            "employee_number": "TECH-TEST-001",
            "name": "John Smith",
            "email": "john.smith@testcompany.com",
            "phone": "(555) 987-6543",
            "role": "Senior Technician",
            "specialty": "HVAC Systems",
            "skills": ["Air Conditioning", "Heating", "Ventilation"],
            "location": "Austin, TX",
            "years_experience": 7,
            "bio": "Experienced HVAC technician with expertise in residential and commercial systems."
        }
        
        success, created_tech, status = self.make_request("POST", "/technicians", new_tech_data)
        self.log_test("POST /technicians", success, f"Status: {status}, Created: {created_tech.get('name', 'N/A')}")
        
        if success:
            new_tech_id = created_tech['id']
            self.created_resources['technicians'].append(new_tech_id)
            
            # Test PUT /technicians/{id}
            update_data = {
                "bio": "Updated bio: Expert HVAC technician specializing in energy-efficient systems.",
                "years_experience": 8
            }
            success, updated_tech, status = self.make_request("PUT", f"/technicians/{new_tech_id}", update_data)
            self.log_test("PUT /technicians/{id}", success, f"Status: {status}, Updated experience: {updated_tech.get('years_experience', 'N/A')}")
            
            # Test image upload with valid base64
            test_image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
            image_data = {
                "image_data": f"data:image/png;base64,{test_image_b64}"
            }
            success, upload_result, status = self.make_request("POST", f"/technicians/{new_tech_id}/image", image_data)
            self.log_test("POST /technicians/{id}/image", success, f"Status: {status}, Upload: {upload_result.get('success', False)}")
        
        # Test search functionality
        success, search_data, status = self.make_request("GET", "/technicians", params={"search": "HVAC"})
        self.log_test("GET /technicians?search=HVAC", success, f"Status: {status}, Results: {len(search_data) if isinstance(search_data, list) else 0}")
        
        # Test security - invalid UUID
        success, error_data, status = self.make_request("GET", "/technicians/invalid-uuid")
        expected_fail = not success and status == 400
        self.log_test("Security: Invalid UUID rejection", expected_fail, f"Status: {status}, Properly rejected: {expected_fail}")
    
    def test_board_config_api(self):
        """Test board configuration endpoints"""
        print("\n=== BOARD CONFIG API TESTS ===")
        
        # Test GET /board-configs/default
        success, default_config, status = self.make_request("GET", "/board-configs/default")
        self.log_test("GET /board-configs/default", success, f"Status: {status}, Columns: {len(default_config.get('columns', []))}")
        
        # Test GET /board-configs
        success, configs, status = self.make_request("GET", "/board-configs")
        self.log_test("GET /board-configs", success, f"Status: {status}, Count: {len(configs) if isinstance(configs, list) else 0}")
        
        if success and configs:
            config_id = configs[0]['id']
            
            # Test GET /board-configs/{id}
            success, config_data, status = self.make_request("GET", f"/board-configs/{config_id}")
            self.log_test("GET /board-configs/{id}", success, f"Status: {status}, Name: {config_data.get('name', 'N/A')}")
        
        # Test POST /board-configs (create custom config)
        custom_config = {
            "name": "Custom Test Board",
            "description": "Test board configuration",
            "columns": [
                {
                    "name": "New Lead",
                    "key": "new_lead",
                    "color": "#ff6b6b",
                    "order": 0
                },
                {
                    "name": "In Progress",
                    "key": "in_progress",
                    "color": "#4ecdc4",
                    "order": 1
                },
                {
                    "name": "Done",
                    "key": "done",
                    "color": "#45b7d1",
                    "order": 2
                }
            ]
        }
        
        success, created_config, status = self.make_request("POST", "/board-configs", custom_config)
        self.log_test("POST /board-configs", success, f"Status: {status}, Created: {created_config.get('name', 'N/A')}")
        
        if success:
            config_id = created_config['id']
            self.created_resources['board_configs'].append(config_id)
            
            # Test PUT /board-configs/{id}
            update_config = {
                "name": "Updated Custom Board",
                "description": "Updated description for test board"
            }
            success, updated_config, status = self.make_request("PUT", f"/board-configs/{config_id}", update_config)
            self.log_test("PUT /board-configs/{id}", success, f"Status: {status}, Updated name: {updated_config.get('name', 'N/A')}")
    
    def test_jobs_api(self):
        """Test jobs endpoints"""
        print("\n=== JOBS API TESTS ===")
        
        # Test GET /jobs (should have seeded data)
        success, jobs, status = self.make_request("GET", "/jobs")
        self.log_test("GET /jobs", success, f"Status: {status}, Count: {len(jobs) if isinstance(jobs, list) else 0}")
        
        if success and jobs:
            job_id = jobs[0]['id']
            job_number = jobs[0]['job_number']
            self.created_resources['jobs'].append(job_id)
            
            # Test GET /jobs/{id} with UUID
            success, job_data, status = self.make_request("GET", f"/jobs/{job_id}")
            self.log_test("GET /jobs/{id} (UUID)", success, f"Status: {status}, Title: {job_data.get('title', 'N/A')}")
            
            # Test GET /jobs/{job_number} with job number
            success, job_data, status = self.make_request("GET", f"/jobs/{job_number}")
            self.log_test("GET /jobs/{job_number}", success, f"Status: {status}, Title: {job_data.get('title', 'N/A')}")
        
        # Test POST /jobs (create new)
        new_job_data = {
            "customer_name": "Test Customer Inc",
            "customer_phone": "(555) 123-9999",
            "customer_email": "test@customer.com",
            "site_address": "123 Test Street",
            "site_city": "Test City",
            "site_state": "TX",
            "site_zip": "12345",
            "job_type": "Maintenance",
            "title": "Annual HVAC Maintenance Check",
            "description": "Routine maintenance and inspection of HVAC system",
            "priority": "normal",
            "scheduled_date": "2026-03-15",
            "estimated_hours": 2.5
        }
        
        success, created_job, status = self.make_request("POST", "/jobs", new_job_data)
        self.log_test("POST /jobs", success, f"Status: {status}, Created: {created_job.get('title', 'N/A')}")
        
        if success:
            new_job_id = created_job['id']
            self.created_resources['jobs'].append(new_job_id)
            
            # Test PUT /jobs/{id}
            update_job = {
                "description": "Updated: Comprehensive HVAC maintenance and performance optimization",
                "estimated_hours": 3.0
            }
            success, updated_job, status = self.make_request("PUT", f"/jobs/{new_job_id}", update_job)
            self.log_test("PUT /jobs/{id}", success, f"Status: {status}, Updated hours: {updated_job.get('estimated_hours', 'N/A')}")
        
        # Test search and filtering
        success, search_results, status = self.make_request("GET", "/jobs", params={"search": "HVAC"})
        self.log_test("GET /jobs?search=HVAC", success, f"Status: {status}, Results: {len(search_results) if isinstance(search_results, list) else 0}")
        
        success, priority_results, status = self.make_request("GET", "/jobs", params={"priority": "normal"})
        self.log_test("GET /jobs?priority=normal", success, f"Status: {status}, Results: {len(priority_results) if isinstance(priority_results, list) else 0}")
    
    def test_tasks_api(self):
        """Test tasks endpoints"""
        print("\n=== TASKS API TESTS ===")
        
        # Get a job ID for task creation
        success, jobs, status = self.make_request("GET", "/jobs")
        if not success or not jobs:
            self.log_test("Tasks API prerequisite", False, "No jobs available for task testing")
            return
        
        job_id = jobs[0]['id']
        
        # Test GET /tasks?job_id={job_id}
        success, tasks, status = self.make_request("GET", "/tasks", params={"job_id": job_id})
        self.log_test("GET /tasks?job_id={job_id}", success, f"Status: {status}, Count: {len(tasks) if isinstance(tasks, list) else 0}")
        
        # Get a technician ID for task assignment
        success, techs, status = self.make_request("GET", "/technicians")
        tech_id = techs[0]['id'] if success and techs else None
        
        # Test POST /tasks (create new)
        new_task_data = {
            "job_id": job_id,
            "title": "Test Task - System Inspection",
            "description": "Comprehensive inspection of HVAC system components",
            "task_type": "service",
            "status": "lead",
            "priority": "normal",
            "assigned_technician_id": tech_id,
            "scheduled_date": "2026-03-16",
            "scheduled_time": "10:00",
            "estimated_duration": "2 hours",
            "notes": "Customer prefers morning appointments"
        }
        
        success, created_task, status = self.make_request("POST", "/tasks", new_task_data)
        self.log_test("POST /tasks", success, f"Status: {status}, Created: {created_task.get('title', 'N/A')}")
        
        if success:
            task_id = created_task['id']
            self.created_resources['tasks'].append(task_id)
            
            # Test GET /tasks/{id}
            success, task_data, status = self.make_request("GET", f"/tasks/{task_id}")
            self.log_test("GET /tasks/{id}", success, f"Status: {status}, Title: {task_data.get('title', 'N/A')}")
            
            # Test PUT /tasks/{id}
            update_task = {
                "notes": "Updated: Customer confirmed morning appointment preference",
                "priority": "high"
            }
            success, updated_task, status = self.make_request("PUT", f"/tasks/{task_id}", update_task)
            self.log_test("PUT /tasks/{id}", success, f"Status: {status}, Updated priority: {updated_task.get('priority', 'N/A')}")
            
            # Test POST /tasks/move (move task to new status)
            move_data = {
                "task_id": task_id,
                "new_status": "dispatched",
                "new_order": 0
            }
            success, moved_task, status = self.make_request("POST", "/tasks/move", move_data)
            self.log_test("POST /tasks/move", success, f"Status: {status}, New status: {moved_task.get('status', 'N/A')}")
        
        # Test filtering
        success, filtered_tasks, status = self.make_request("GET", "/tasks", params={"status": "lead"})
        self.log_test("GET /tasks?status=lead", success, f"Status: {status}, Results: {len(filtered_tasks) if isinstance(filtered_tasks, list) else 0}")
    
    def test_appointments_api(self):
        """Test appointments endpoints"""
        print("\n=== APPOINTMENTS API TESTS ===")
        
        # Get prerequisites
        success, jobs, status = self.make_request("GET", "/jobs")
        success2, techs, status2 = self.make_request("GET", "/technicians")
        
        if not (success and jobs and success2 and techs):
            self.log_test("Appointments API prerequisite", False, "Missing jobs or technicians for appointment testing")
            return
        
        job_id = jobs[0]['id']
        tech_id = techs[0]['id']
        
        # Test POST /appointments (create new)
        new_appointment_data = {
            "job_id": job_id,
            "technician_id": tech_id,
            "customer_name": "Jane Doe",
            "customer_phone": "(555) 888-7777",
            "customer_email": "jane.doe@email.com",
            "site_address": "456 Oak Avenue, Dallas, TX 75201",
            "scheduled_date": "2026-03-17",
            "scheduled_time": "14:00",
            "estimated_duration": "3 hours",
            "job_type": "Repair Service",
            "notes": "Customer will be available all afternoon"
        }
        
        success, created_appt, status = self.make_request("POST", "/appointments", new_appointment_data)
        self.log_test("POST /appointments", success, f"Status: {status}, Created for: {created_appt.get('customer_name', 'N/A')}")
        
        if success:
            appt_id = created_appt['id']
            confirmation_token = created_appt['confirmation_token']
            self.created_resources['appointments'].append(appt_id)
            
            # Test GET /appointments/{id}
            success, appt_data, status = self.make_request("GET", f"/appointments/{appt_id}")
            self.log_test("GET /appointments/{id}", success, f"Status: {status}, Customer: {appt_data.get('customer_name', 'N/A')}")
            
            # Test GET /appointments/confirmation/{token}
            success, confirmation_data, status = self.make_request("GET", f"/appointments/confirmation/{confirmation_token}")
            self.log_test("GET /appointments/confirmation/{token}", success, f"Status: {status}, Job: {confirmation_data.get('job_number', 'N/A')}")
            
            if success:
                tech_info = confirmation_data.get('technician', {})
                print(f"   Technician: {tech_info.get('name', 'N/A')} - {tech_info.get('specialty', 'N/A')}")
        
        # Test GET /appointments (list all)
        success, appointments, status = self.make_request("GET", "/appointments")
        self.log_test("GET /appointments", success, f"Status: {status}, Count: {len(appointments) if isinstance(appointments, list) else 0}")
        
        # Test filtering by job_id
        success, job_appts, status = self.make_request("GET", "/appointments", params={"job_id": job_id})
        self.log_test("GET /appointments?job_id={job_id}", success, f"Status: {status}, Results: {len(job_appts) if isinstance(job_appts, list) else 0}")
    
    def test_security_validations(self):
        """Test security features"""
        print("\n=== SECURITY VALIDATION TESTS ===")
        
        # Test UUID validation
        invalid_uuids = ["invalid", "123", "not-a-uuid", ""]
        for invalid_uuid in invalid_uuids:
            success, error_data, status = self.make_request("GET", f"/technicians/{invalid_uuid}")
            expected_fail = not success and status == 400
            self.log_test(f"UUID validation: '{invalid_uuid}'", expected_fail, f"Status: {status}, Properly rejected: {expected_fail}")
        
        # Test image size validation (simulate large image)
        if self.created_resources['technicians']:
            tech_id = self.created_resources['technicians'][0]
            
            # Create a large base64 string (simulate >5MB)
            large_data = "A" * (6 * 1024 * 1024)  # 6MB of 'A' characters
            large_image_data = {
                "image_data": f"data:image/jpeg;base64,{large_data}"
            }
            
            success, error_data, status = self.make_request("POST", f"/technicians/{tech_id}/image", large_image_data)
            expected_fail = not success and status == 400
            self.log_test("Image size validation (>5MB)", expected_fail, f"Status: {status}, Properly rejected: {expected_fail}")
        
        # Test input sanitization with special characters
        malicious_input = {
            "customer_name": "<script>alert('xss')</script>",
            "site_address": "'; DROP TABLE jobs; --",
            "job_type": "Test\x00\x01\x02",
            "title": "Normal Title",
            "description": "Test with special chars: <>\"'&"
        }
        
        success, created_job, status = self.make_request("POST", "/jobs", malicious_input)
        if success:
            # Check if dangerous content was sanitized
            sanitized_name = created_job.get('customer_name', '')
            sanitized_address = created_job.get('site_address', '')
            
            xss_blocked = '<script>' not in sanitized_name
            sql_blocked = 'DROP TABLE' not in sanitized_address
            
            self.log_test("Input sanitization (XSS)", xss_blocked, f"XSS content blocked: {xss_blocked}")
            self.log_test("Input sanitization (SQL)", sql_blocked, f"SQL injection blocked: {sql_blocked}")
        else:
            self.log_test("Input sanitization test", False, f"Could not create job for sanitization test: {status}")
    
    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Field Service Management Backend API Tests")
        print(f"Testing against: {self.base_url}")
        
        # Health check first
        self.test_health_check()
        
        # Seed data (required for other tests)
        if not self.test_seed_data():
            print("❌ CRITICAL: Seed data failed - some tests may not work properly")
        
        # Run all API tests
        self.test_technicians_api()
        self.test_board_config_api()
        self.test_jobs_api()
        self.test_tasks_api()
        self.test_appointments_api()
        self.test_security_validations()
        
        # Summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("🏁 TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   ❌ {result['test']}: {result['details']}")
        
        print(f"\n📊 CREATED RESOURCES:")
        for resource_type, resources in self.created_resources.items():
            if resources:
                print(f"   {resource_type}: {len(resources)} items")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    
    if not success:
        print("\n⚠️  Some tests failed. Check the details above.")
        sys.exit(1)
    else:
        print("\n🎉 All tests passed successfully!")
        sys.exit(0)