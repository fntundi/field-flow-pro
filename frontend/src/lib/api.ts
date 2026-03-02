// API service for communicating with backend
const API_BASE_URL = import.meta.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// ==================== TYPES ====================

export interface StatusColumn {
  id: string;
  name: string;
  key: string;
  color: string;
  order: number;
  is_default: boolean;
}

export interface BoardConfig {
  id: string;
  name: string;
  description?: string;
  columns: StatusColumn[];
  created_by?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Certification {
  name: string;
  issuer: string;
  issue_date?: string;
  expiry_date?: string;
  certificate_number?: string;
}

export interface License {
  name: string;
  license_number: string;
  state: string;
  issue_date?: string;
  expiry_date?: string;
}

export interface Technician {
  id: string;
  user_id?: string;
  employee_number: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  specialty: string;
  skills: string[];
  certifications: Certification[];
  licenses: License[];
  profile_image?: string;
  status: 'available' | 'on_job' | 'en_route' | 'off_duty' | 'emergency';
  status_label: string;
  location: string;
  rating: number;
  total_jobs: number;
  years_experience: number;
  bio?: string;
  availability_notes?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface TechnicianPublicProfile {
  id: string;
  name: string;
  role: string;
  specialty: string;
  profile_image?: string;
  rating: number;
  years_experience: number;
  bio?: string;
}

export interface Task {
  id: string;
  job_id: string;
  task_number: string;
  title: string;
  description?: string;
  task_type: 'tech_call' | 'sales_call' | 'service' | 'follow_up' | 'other';
  status: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assigned_technician_id?: string;
  assigned_technician_name?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  estimated_duration?: string;
  actual_duration?: string;
  notes?: string;
  discovery_notes?: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  job_number: string;
  customer_name: string;
  customer_id?: string;
  customer_phone?: string;
  customer_email?: string;
  site_address: string;
  site_city?: string;
  site_state?: string;
  site_zip?: string;
  job_type: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'complete' | 'cancelled' | 'urgent' | 'pending';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduled_date?: string;
  completed_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  board_config_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentConfirmation {
  appointment_id: string;
  job_number: string;
  scheduled_date: string;
  scheduled_time: string;
  estimated_duration?: string;
  job_type: string;
  site_address: string;
  technician: TechnicianPublicProfile;
  notes?: string;
  status: string;
}

// ==================== API HELPERS ====================

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}/api${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ==================== BOARD CONFIG API ====================

export const boardConfigApi = {
  getAll: () => fetchApi<BoardConfig[]>('/board-configs'),
  
  getDefault: () => fetchApi<BoardConfig>('/board-configs/default'),
  
  getById: (id: string) => fetchApi<BoardConfig>(`/board-configs/${id}`),
  
  create: (data: Partial<BoardConfig>) => 
    fetchApi<BoardConfig>('/board-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<BoardConfig>) =>
    fetchApi<BoardConfig>(`/board-configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) =>
    fetchApi<{ message: string }>(`/board-configs/${id}`, {
      method: 'DELETE',
    }),
};

// ==================== TECHNICIANS API ====================

export const techniciansApi = {
  getAll: (params?: { status?: string; specialty?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.specialty) searchParams.append('specialty', params.specialty);
    if (params?.search) searchParams.append('search', params.search);
    const query = searchParams.toString();
    return fetchApi<Technician[]>(`/technicians${query ? `?${query}` : ''}`);
  },
  
  getById: (id: string) => fetchApi<Technician>(`/technicians/${id}`),
  
  getPublicProfile: (id: string) => fetchApi<TechnicianPublicProfile>(`/technicians/${id}/public`),
  
  create: (data: Partial<Technician>) =>
    fetchApi<Technician>('/technicians', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<Technician>) =>
    fetchApi<Technician>(`/technicians/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) =>
    fetchApi<{ message: string }>(`/technicians/${id}`, {
      method: 'DELETE',
    }),
  
  uploadImage: (id: string, imageData: string) =>
    fetchApi<{ success: boolean; message: string }>(`/technicians/${id}/image`, {
      method: 'POST',
      body: JSON.stringify({ image_data: imageData }),
    }),
  
  updateStatus: (id: string, status: string, statusLabel: string) =>
    fetchApi<{ message: string }>(`/technicians/${id}/status?status=${status}&status_label=${statusLabel}`, {
      method: 'PUT',
    }),
};

// ==================== JOBS API ====================

export const jobsApi = {
  getAll: (params?: { 
    status?: string; 
    priority?: string; 
    customer_id?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.priority) searchParams.append('priority', params.priority);
    if (params?.customer_id) searchParams.append('customer_id', params.customer_id);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    const query = searchParams.toString();
    return fetchApi<Job[]>(`/jobs${query ? `?${query}` : ''}`);
  },
  
  getById: (id: string) => fetchApi<Job>(`/jobs/${id}`),
  
  create: (data: Partial<Job>) =>
    fetchApi<Job>('/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<Job>) =>
    fetchApi<Job>(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) =>
    fetchApi<{ message: string }>(`/jobs/${id}`, {
      method: 'DELETE',
    }),
};

// ==================== TASKS API ====================

export const tasksApi = {
  getAll: (params?: { 
    job_id?: string;
    status?: string;
    technician_id?: string;
    task_type?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.job_id) searchParams.append('job_id', params.job_id);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.technician_id) searchParams.append('technician_id', params.technician_id);
    if (params?.task_type) searchParams.append('task_type', params.task_type);
    const query = searchParams.toString();
    return fetchApi<Task[]>(`/tasks${query ? `?${query}` : ''}`);
  },
  
  getById: (id: string) => fetchApi<Task>(`/tasks/${id}`),
  
  create: (data: Partial<Task>) =>
    fetchApi<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<Task>) =>
    fetchApi<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  move: (taskId: string, newStatus: string, newOrder: number) =>
    fetchApi<Task>('/tasks/move', {
      method: 'POST',
      body: JSON.stringify({
        task_id: taskId,
        new_status: newStatus,
        new_order: newOrder,
      }),
    }),
  
  delete: (id: string) =>
    fetchApi<{ message: string }>(`/tasks/${id}`, {
      method: 'DELETE',
    }),
};

// ==================== APPOINTMENTS API ====================

export const appointmentsApi = {
  getAll: (params?: {
    job_id?: string;
    technician_id?: string;
    status?: string;
    date?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.job_id) searchParams.append('job_id', params.job_id);
    if (params?.technician_id) searchParams.append('technician_id', params.technician_id);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.date) searchParams.append('date', params.date);
    const query = searchParams.toString();
    return fetchApi<any[]>(`/appointments${query ? `?${query}` : ''}`);
  },
  
  getById: (id: string) => fetchApi<any>(`/appointments/${id}`),
  
  getConfirmation: (token: string) => fetchApi<AppointmentConfirmation>(`/appointments/confirmation/${token}`),
  
  create: (data: any) =>
    fetchApi<any>('/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateStatus: (id: string, status: string) =>
    fetchApi<{ message: string }>(`/appointments/${id}/status?status=${status}`, {
      method: 'PUT',
    }),
};

// ==================== TIME TRACKING API ====================

export interface GeoLocation {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
}

export interface ShiftSession {
  id: string;
  technician_id: string;
  shift_start: string;
  shift_start_location?: GeoLocation;
  shift_end?: string;
  shift_end_location?: GeoLocation;
  total_shift_minutes?: number;
  jobs_completed: number;
  status: 'active' | 'completed';
  created_at: string;
}

export interface JobTimeEntry {
  id: string;
  technician_id: string;
  job_id: string;
  job_number?: string;
  job_type?: string;
  shift_session_id?: string;
  dispatch_time?: string;
  dispatch_location?: GeoLocation;
  estimated_travel_minutes?: number;
  estimated_route_distance_miles?: number;
  job_start?: string;
  job_start_location?: GeoLocation;
  actual_travel_minutes?: number;
  job_end?: string;
  job_end_location?: GeoLocation;
  actual_job_minutes?: number;
  travel_variance_minutes?: number;
  status: 'dispatched' | 'traveling' | 'on_site' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface TechnicianMetrics {
  technician_id: string;
  technician_name: string;
  avg_travel_minutes: number;
  total_travel_minutes: number;
  travel_entries_count: number;
  travel_variance_avg: number;
  avg_job_minutes_residential_repair: number;
  avg_job_minutes_commercial_repair: number;
  avg_job_minutes_residential_install: number;
  avg_job_minutes_commercial_install: number;
  avg_job_minutes_maintenance: number;
  avg_job_minutes_emergency: number;
  total_jobs_tracked: number;
  total_job_minutes: number;
  jobs_on_time_percentage: number;
  recent_avg_travel_minutes: number;
  recent_travel_variance: number;
  last_updated: string;
}

export const timeTrackingApi = {
  // Shift management
  startShift: (technicianId: string, location?: GeoLocation) =>
    fetchApi<{ message: string; session_id: string; shift_start: string; location_captured: boolean }>(
      `/time-tracking/shift/start?technician_id=${technicianId}`,
      {
        method: 'POST',
        body: location ? JSON.stringify(location) : undefined,
      }
    ),
  
  endShift: (technicianId: string, location?: GeoLocation) =>
    fetchApi<{ message: string; session_id: string; total_shift_hours: number; jobs_completed: number }>(
      `/time-tracking/shift/end?technician_id=${technicianId}`,
      {
        method: 'POST',
        body: location ? JSON.stringify(location) : undefined,
      }
    ),
  
  getActiveShift: (technicianId: string) =>
    fetchApi<{ active: boolean; session: ShiftSession | null }>(`/time-tracking/shift/active/${technicianId}`),
  
  // Job time tracking
  dispatchToJob: (technicianId: string, jobId: string, location?: GeoLocation) =>
    fetchApi<{ message: string; entry_id: string; job_number: string; estimated_travel_minutes?: number; estimated_distance_miles?: number }>(
      '/time-tracking/job/dispatch',
      {
        method: 'POST',
        body: JSON.stringify({
          technician_id: technicianId,
          job_id: jobId,
          dispatch_location: location,
        }),
      }
    ),
  
  arriveAtJob: (entryId: string, location?: GeoLocation) =>
    fetchApi<{ message: string; actual_travel_minutes: number; estimated_travel_minutes?: number; travel_variance_minutes?: number }>(
      `/time-tracking/job/arrive/${entryId}`,
      {
        method: 'POST',
        body: location ? JSON.stringify(location) : undefined,
      }
    ),
  
  completeJob: (entryId: string, location?: GeoLocation, notes?: string) =>
    fetchApi<{ message: string; actual_job_minutes: number; actual_job_hours: number; travel_minutes?: number }>(
      `/time-tracking/job/complete/${entryId}?${notes ? `notes=${encodeURIComponent(notes)}` : ''}`,
      {
        method: 'POST',
        body: location ? JSON.stringify(location) : undefined,
      }
    ),
  
  getActiveJobEntry: (technicianId: string) =>
    fetchApi<{ active: boolean; entry: JobTimeEntry | null }>(`/time-tracking/job/active/${technicianId}`),
  
  // Metrics
  getTechnicianMetrics: (technicianId: string) =>
    fetchApi<TechnicianMetrics>(`/time-tracking/metrics/${technicianId}`),
  
  getHistory: (technicianId: string, days: number = 30) =>
    fetchApi<{ job_entries: JobTimeEntry[]; shifts: ShiftSession[] }>(`/time-tracking/history/${technicianId}?days=${days}`),
  
  // Route estimation
  estimateRoute: (origin: GeoLocation, destination: GeoLocation) =>
    fetchApi<{ origin: GeoLocation; destination: GeoLocation; estimated_minutes: number; estimated_miles: number; route_count: number; confidence: string }>(
      '/time-tracking/route-estimate',
      {
        method: 'POST',
        body: JSON.stringify({ origin, destination }),
      }
    ),
};

// ==================== SEED API ====================

export const seedApi = {
  seed: () => fetchApi<{ message: string; technicians: number; jobs: number; tasks: number }>('/seed', {
    method: 'POST',
  }),
};
