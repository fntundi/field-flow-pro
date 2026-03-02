# Phone.com VoIP Service
# Handles all communication with Phone.com API

import os
import httpx
import hmac
import hashlib
import logging
from typing import Optional, Dict, List
from datetime import datetime

logger = logging.getLogger(__name__)

class PhoneComService:
    """Service class for Phone.com API interactions"""
    
    def __init__(self):
        self.api_key = os.environ.get("PHONE_COM_API_KEY")
        self.account_id = os.environ.get("PHONE_COM_ACCOUNT_ID")
        self.base_url = "https://api.phone.com/v4"
        self.webhook_secret = os.environ.get("PHONE_COM_WEBHOOK_SECRET", "")
        
    @property
    def is_configured(self) -> bool:
        """Check if Phone.com credentials are configured"""
        return bool(self.api_key and self.account_id)
    
    @property
    def headers(self) -> Dict[str, str]:
        """Get authorization headers"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    async def make_call(self, from_number: str, to_number: str, extension_id: Optional[str] = None) -> Dict:
        """
        Initiate an outbound call from Phone.com
        
        Args:
            from_number: The caller ID number (must be a Phone.com number)
            to_number: The destination phone number
            extension_id: Optional extension ID to route through
            
        Returns:
            Phone.com API response with call details
        """
        if not self.is_configured:
            raise ValueError("Phone.com API credentials not configured")
        
        if extension_id:
            url = f"{self.base_url}/accounts/{self.account_id}/extensions/{extension_id}/calls"
        else:
            url = f"{self.base_url}/accounts/{self.account_id}/calls"
        
        payload = {
            "from": from_number,
            "to": to_number
        }
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(url, json=payload, headers=self.headers)
                response.raise_for_status()
                logger.info(f"Call initiated: {from_number} -> {to_number}")
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"Phone.com API error: {e.response.status_code} - {e.response.text}")
                raise
            except httpx.RequestError as e:
                logger.error(f"Request error making call: {e}")
                raise
    
    async def get_call_logs(self, limit: int = 50, offset: int = 0, 
                           start_date: Optional[str] = None, 
                           end_date: Optional[str] = None) -> List[Dict]:
        """
        Retrieve call logs from Phone.com account
        
        Args:
            limit: Maximum number of records to return
            offset: Pagination offset
            start_date: Filter by start date (ISO format)
            end_date: Filter by end date (ISO format)
            
        Returns:
            List of call log records
        """
        if not self.is_configured:
            raise ValueError("Phone.com API credentials not configured")
        
        url = f"{self.base_url}/accounts/{self.account_id}/call-logs"
        params = {"limit": limit, "offset": offset}
        
        if start_date:
            params["filters[start_time][gte]"] = start_date
        if end_date:
            params["filters[start_time][lte]"] = end_date
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()
                return data.get("items", [])
            except httpx.HTTPError as e:
                logger.error(f"Error retrieving call logs: {e}")
                raise
    
    async def get_call_log(self, call_id: str) -> Dict:
        """Get a specific call log by ID"""
        if not self.is_configured:
            raise ValueError("Phone.com API credentials not configured")
        
        url = f"{self.base_url}/accounts/{self.account_id}/call-logs/{call_id}"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"Error retrieving call log {call_id}: {e}")
                raise
    
    async def get_call_recording(self, call_id: str) -> Optional[bytes]:
        """
        Download call recording file from Phone.com
        
        Args:
            call_id: The call ID to download recording for
            
        Returns:
            Recording file content as bytes, or None if no recording
        """
        if not self.is_configured:
            raise ValueError("Phone.com API credentials not configured")
        
        url = f"{self.base_url}/accounts/{self.account_id}/call-logs/{call_id}/recording/download"
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                return response.content
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    logger.info(f"No recording found for call {call_id}")
                    return None
                logger.error(f"Error downloading recording: {e}")
                raise
    
    async def send_sms(self, from_number: str, to_number: str, message: str) -> Dict:
        """
        Send SMS message through Phone.com
        
        Args:
            from_number: The sender number (must be SMS-enabled Phone.com number)
            to_number: The recipient phone number
            message: The message text
            
        Returns:
            Phone.com API response with message details
        """
        if not self.is_configured:
            raise ValueError("Phone.com API credentials not configured")
        
        url = f"{self.base_url}/accounts/{self.account_id}/sms"
        payload = {
            "from": from_number,
            "to": to_number,
            "text": message
        }
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(url, json=payload, headers=self.headers)
                response.raise_for_status()
                logger.info(f"SMS sent: {from_number} -> {to_number}")
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"Error sending SMS: {e}")
                raise
    
    async def get_sms_messages(self, limit: int = 50, offset: int = 0) -> List[Dict]:
        """Retrieve SMS messages from Phone.com"""
        if not self.is_configured:
            raise ValueError("Phone.com API credentials not configured")
        
        url = f"{self.base_url}/accounts/{self.account_id}/sms"
        params = {"limit": limit, "offset": offset}
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()
                return data.get("items", [])
            except httpx.HTTPError as e:
                logger.error(f"Error retrieving SMS messages: {e}")
                raise
    
    async def get_phone_numbers(self) -> List[Dict]:
        """Retrieve all phone numbers associated with account"""
        if not self.is_configured:
            raise ValueError("Phone.com API credentials not configured")
        
        url = f"{self.base_url}/accounts/{self.account_id}/phone-numbers"
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                data = response.json()
                return data.get("items", [])
            except httpx.HTTPError as e:
                logger.error(f"Error retrieving phone numbers: {e}")
                raise
    
    async def get_extensions(self) -> List[Dict]:
        """Retrieve all extensions for the account"""
        if not self.is_configured:
            raise ValueError("Phone.com API credentials not configured")
        
        url = f"{self.base_url}/accounts/{self.account_id}/extensions"
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                data = response.json()
                return data.get("items", [])
            except httpx.HTTPError as e:
                logger.error(f"Error retrieving extensions: {e}")
                raise
    
    def verify_webhook_signature(self, body: bytes, signature: str) -> bool:
        """
        Verify Phone.com webhook signature using HMAC
        
        Args:
            body: Raw request body bytes
            signature: Signature header value from Phone.com
            
        Returns:
            True if signature is valid, False otherwise
        """
        if not self.webhook_secret:
            logger.warning("Webhook secret not configured, skipping verification")
            return True  # Allow in development
        
        calculated = hmac.new(
            self.webhook_secret.encode(),
            body,
            hashlib.sha256
        ).hexdigest()
        
        expected = f"sha256={calculated}"
        return hmac.compare_digest(expected, signature)


# Singleton instance
phone_com_service = PhoneComService()
