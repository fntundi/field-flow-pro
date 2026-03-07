// API Service for BreezeFlow Mobile
// Shares same backend as web app

import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'https://hvac-ops-platform.preview.emergentagent.com/api';

let authToken: string | null = null;

export const setAuthToken = async (token: string | null) => {
  authToken = token;
  if (token) {
    await SecureStore.setItemAsync('authToken', token);
  } else {
    await SecureStore.deleteItemAsync('authToken');
  }
};

export const getAuthToken = async () => {
  if (!authToken) {
    authToken = await SecureStore.getItemAsync('authToken');
  }
  return authToken;
};

const fetchApi = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
  const token = await getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options?.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'API request failed');
  }

  return response.json();
};

// ==================== AUTH API ====================
export const authApi = {
  login: (email: string, password: string) =>
    fetchApi<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { email: string; password: string; name: string }) =>
    fetchApi<{ access_token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: () => fetchApi<any>('/auth/me'),
};

// ==================== JOBS API ====================
export interface Job {
  id: string;
  job_number: string;
  status: string;
  job_type: string;
  customer_name: string;
  customer_phone?: string;
  site_address: string;
  scheduled_date?: string;
  assigned_technician_ids?: string[];
}

export const jobsApi = {
  getAll: () => fetchApi<Job[]>('/jobs'),
  getById: (id: string) => fetchApi<Job>(`/jobs/${id}`),
  updateStatus: (id: string, status: string) =>
    fetchApi<Job>(`/jobs/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
};

// ==================== TECHNICIANS API ====================
export interface Technician {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  status: string;
}

export const techniciansApi = {
  getAll: () => fetchApi<Technician[]>('/technicians'),
  getById: (id: string) => fetchApi<Technician>(`/technicians/${id}`),
};

// ==================== TIME TRACKING API ====================
export interface TimeEntry {
  id: string;
  technician_id: string;
  job_id?: string;
  clock_in: string;
  clock_out?: string;
  duration_seconds?: number;
}

export const timeTrackingApi = {
  clockIn: (data: { technician_id: string; job_id?: string; location?: any }) =>
    fetchApi<TimeEntry>('/time-tracking/clock-in', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  clockOut: (entryId: string, data?: { location?: any }) =>
    fetchApi<TimeEntry>(`/time-tracking/clock-out/${entryId}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  getCurrentShift: (technicianId: string) =>
    fetchApi<TimeEntry | null>(`/time-tracking/current/${technicianId}`),
};

// ==================== VOIP API ====================
export const voipApi = {
  initiateCall: (data: { to_number: string; customer_id?: string; job_id?: string }) =>
    fetchApi<{ success: boolean; call_id: string }>('/voip/calls/initiate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  sendSMS: (data: { to_number: string; message: string; customer_id?: string }) =>
    fetchApi<{ success: boolean; message_id: string }>('/voip/sms/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ==================== CUSTOMERS API ====================
export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  customer_type?: string;
}

export const customersApi = {
  getAll: (search?: string) => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return fetchApi<Customer[]>(`/customers${query}`);
  },
  getById: (id: string) => fetchApi<Customer>(`/customers/${id}`),
};
