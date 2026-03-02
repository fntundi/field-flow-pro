"""
Test P0 Integration Endpoints - Push Notifications, QuickBooks, System Settings
Tests the endpoints that were fixed by moving app.include_router after route definitions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "test123"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "test123"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@test.com"
        assert data["user"]["role"] == "admin"


class TestPushNotifications:
    """Push Notifications API tests - P0 fix verification"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "test123"},
            headers={"Content-Type": "application/json"}
        )
        return response.json()["access_token"]
    
    def test_get_vapid_key(self, auth_token):
        """Test /api/push/vapid-key returns VAPID public key"""
        response = requests.get(
            f"{BASE_URL}/api/push/vapid-key",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "publicKey" in data
        assert isinstance(data["publicKey"], str)
        assert len(data["publicKey"]) > 0
    
    def test_subscribe_to_push(self, auth_token):
        """Test /api/push/subscribe accepts subscription data"""
        subscription_data = {
            "subscription": {
                "endpoint": f"https://test.example.com/push/test-{os.urandom(4).hex()}",
                "keys": {
                    "p256dh": "test-p256dh-key",
                    "auth": "test-auth-key"
                }
            }
        }
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json=subscription_data,
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        assert "id" in data
        assert data["message"] in ["Subscribed successfully", "Subscription updated"]
    
    def test_get_subscriptions(self, auth_token):
        """Test /api/push/subscriptions returns user subscriptions"""
        response = requests.get(
            f"{BASE_URL}/api/push/subscriptions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestQuickBooksIntegration:
    """QuickBooks Integration API tests - P0 fix verification"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "test123"},
            headers={"Content-Type": "application/json"}
        )
        return response.json()["access_token"]
    
    def test_get_quickbooks_status(self, auth_token):
        """Test /api/integrations/quickbooks/status returns status object"""
        response = requests.get(
            f"{BASE_URL}/api/integrations/quickbooks/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "enabled" in data
        assert "configured" in data
        assert "connected" in data
        assert "sync_settings" in data
        
        # Verify sync_settings structure
        sync_settings = data["sync_settings"]
        assert "invoices" in sync_settings
        assert "payments" in sync_settings
        assert "customers" in sync_settings
    
    def test_get_sync_logs(self, auth_token):
        """Test /api/integrations/quickbooks/sync-logs returns logs"""
        response = requests.get(
            f"{BASE_URL}/api/integrations/quickbooks/sync-logs",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestSystemSettings:
    """System Settings API tests - P0 fix verification"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "test123"},
            headers={"Content-Type": "application/json"}
        )
        return response.json()["access_token"]
    
    def test_get_system_settings(self, auth_token):
        """Test /api/system/settings returns all settings fields"""
        response = requests.get(
            f"{BASE_URL}/api/system/settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify AI settings fields
        assert "ai_features_enabled" in data
        assert "ai_provider" in data
        assert "ai_model" in data
        assert "ai_failover_enabled" in data
        
        # Verify QuickBooks settings fields
        assert "quickbooks_enabled" in data
        assert "quickbooks_configured" in data
        assert "quickbooks_sync_invoices" in data
        assert "quickbooks_sync_payments" in data
        assert "quickbooks_sync_customers" in data
        
        # Verify Push Notifications settings fields
        assert "push_notifications_enabled" in data
        assert "notify_on_chat_message" in data
        assert "notify_on_job_assignment" in data
        assert "notify_on_schedule_change" in data
        assert "notify_on_payment_received" in data
        
        # Verify pricing settings
        assert "default_tax_rate" in data
        assert "default_labor_rate" in data
        assert "overtime_multiplier" in data
        assert "default_trip_charge" in data
        assert "default_parts_markup" in data
    
    def test_update_ai_settings(self, auth_token):
        """Test PUT /api/system/settings updates AI provider and model"""
        # Get current settings
        get_response = requests.get(
            f"{BASE_URL}/api/system/settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        original_settings = get_response.json()
        
        # Update AI settings
        update_data = {
            "ai_provider": "openai",
            "ai_model": "gpt-4-turbo"
        }
        response = requests.put(
            f"{BASE_URL}/api/system/settings",
            json=update_data,
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify update
        assert data["ai_provider"] == "openai"
        assert data["ai_model"] == "gpt-4-turbo"
        
        # Verify persistence with GET
        verify_response = requests.get(
            f"{BASE_URL}/api/system/settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        verify_data = verify_response.json()
        assert verify_data["ai_provider"] == "openai"
        assert verify_data["ai_model"] == "gpt-4-turbo"
        
        # Revert to original settings
        revert_data = {
            "ai_provider": original_settings.get("ai_provider", "gemini"),
            "ai_model": original_settings.get("ai_model", "gemini-2.0-flash")
        }
        requests.put(
            f"{BASE_URL}/api/system/settings",
            json=revert_data,
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
    
    def test_update_push_notification_settings(self, auth_token):
        """Test updating push notification settings"""
        update_data = {
            "notify_on_chat_message": False
        }
        response = requests.put(
            f"{BASE_URL}/api/system/settings",
            json=update_data,
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        assert response.status_code == 200
        
        # Revert
        requests.put(
            f"{BASE_URL}/api/system/settings",
            json={"notify_on_chat_message": True},
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )


class TestRoles:
    """Roles API tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "test123"},
            headers={"Content-Type": "application/json"}
        )
        return response.json()["access_token"]
    
    def test_get_roles(self, auth_token):
        """Test /api/roles returns role list"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify role structure
        if len(data) > 0:
            role = data[0]
            assert "id" in role
            assert "name" in role
            assert "display_name" in role


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
