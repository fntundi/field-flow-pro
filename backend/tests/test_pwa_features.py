"""
PWA Features Backend Tests
Tests for Service Worker, Push Notifications, and PWA manifest endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPWAManifestAndServiceWorker:
    """Tests for PWA static assets"""
    
    def test_manifest_json_served(self):
        """Verify manifest.json is served correctly"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["name"] == "BreezeFlow"
        assert data["short_name"] == "BreezeFlow"
        assert data["display"] == "standalone"
        assert "icons" in data
        assert len(data["icons"]) >= 8, "Should have at least 8 icon sizes"
        
    def test_manifest_icons_exist(self):
        """Verify all manifest icons are accessible"""
        manifest_response = requests.get(f"{BASE_URL}/manifest.json")
        manifest = manifest_response.json()
        
        for icon in manifest["icons"]:
            icon_url = f"{BASE_URL}{icon['src']}"
            response = requests.head(icon_url)
            assert response.status_code == 200, f"Icon {icon['src']} not found (status {response.status_code})"
    
    def test_service_worker_served(self):
        """Verify sw.js is served correctly"""
        response = requests.get(f"{BASE_URL}/sw.js")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content = response.text
        assert "BreezeFlow Service Worker" in content
        assert "CACHE_NAME" in content
        assert "push" in content.lower()


class TestPushNotificationEndpoints:
    """Tests for push notification API endpoints (require auth)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token via demo login"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login", json={
            "role": "admin"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Demo login failed - skipping authenticated tests")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_vapid_key_endpoint(self, auth_headers):
        """GET /api/push/vapid-key - returns VAPID public key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-key", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "publicKey" in data, "Response should contain publicKey"
        assert isinstance(data["publicKey"], str)
        assert len(data["publicKey"]) > 20, "VAPID key should be a substantial string"
    
    def test_push_subscribe_endpoint(self, auth_headers):
        """POST /api/push/subscribe - accepts subscription data"""
        # Mock subscription data (similar to what browser would send)
        subscription_data = {
            "user_id": "TEST_pwa_user_123",
            "subscription": {
                "endpoint": "https://fcm.googleapis.com/fcm/send/TEST_endpoint_123",
                "keys": {
                    "p256dh": "TEST_p256dh_key_value",
                    "auth": "TEST_auth_key_value"
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            headers=auth_headers,
            json=subscription_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data or "message" in data or "success" in data, "Response should confirm subscription"
    
    def test_push_subscriptions_list(self, auth_headers):
        """GET /api/push/subscriptions - returns user's subscriptions"""
        response = requests.get(f"{BASE_URL}/api/push/subscriptions", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Should return a list of subscriptions"
    
    def test_push_unsubscribe_endpoint(self, auth_headers):
        """POST /api/push/unsubscribe - removes subscription"""
        unsubscribe_data = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/TEST_endpoint_123"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/push/unsubscribe",
            headers=auth_headers,
            json=unsubscribe_data
        )
        # Should succeed even if endpoint doesn't exist
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}: {response.text}"


class TestSystemSettingsPushConfig:
    """Tests for push notification system settings"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token via demo login"""
        response = requests.post(f"{BASE_URL}/api/auth/demo-login", json={
            "role": "admin"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Demo login failed - skipping authenticated tests")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_system_settings_has_push_config(self, auth_headers):
        """GET /api/system/settings - includes push notification settings"""
        response = requests.get(f"{BASE_URL}/api/system/settings", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Check push notification related settings exist
        assert "push_notifications_enabled" in data, "Should have push_notifications_enabled setting"
    
    def test_update_push_notification_settings(self, auth_headers):
        """PUT /api/system/settings - can update push notification settings"""
        update_data = {
            "push_notifications_enabled": True,
            "notify_on_chat_message": True,
            "notify_on_job_assignment": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/system/settings",
            headers=auth_headers,
            json=update_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"


class TestPWAHealthCheck:
    """Basic health checks for PWA functionality"""
    
    def test_api_health(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_frontend_loads(self):
        """Verify frontend HTML is served"""
        response = requests.get(BASE_URL)
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after tests"""
    yield
    # Cleanup would happen here if needed
    # For now, test data with TEST_ prefix can remain
