// API service for communicating with backend
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

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

// ==================== INVENTORY API ====================

export interface InventoryCategory {
  id: string;
  name: string;
  description?: string;
  is_standard: boolean;
  icon?: string;
  sort_order: number;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category_id: string;
  category_name?: string;
  unit: string;
  unit_cost: number;
  retail_price: number;
  min_stock_threshold: number;
  is_serialized: boolean;
  is_active: boolean;
}

export interface TruckInventoryItem {
  item_id: string;
  item_name: string;
  sku: string;
  category_id: string;
  category_name: string;
  quantity: number;
  min_threshold: number;
  unit: string;
  last_counted?: string;
  needs_restock: boolean;
}

export interface Truck {
  id: string;
  truck_number: string;
  name: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  license_plate?: string;
  assigned_technician_id?: string;
  assigned_technician_name?: string;
  status: 'active' | 'maintenance' | 'inactive';
}

export interface TruckInventory {
  id: string;
  truck_id: string;
  truck_name: string;
  technician_id?: string;
  technician_name?: string;
  items: TruckInventoryItem[];
  last_stock_check?: string;
  stock_check_required: boolean;
}

export interface StockCheckItem {
  item_id: string;
  item_name: string;
  sku: string;
  expected_qty: number;
  actual_qty: number;
  min_threshold: number;
  variance: number;
}

export interface RestockRequest {
  id: string;
  truck_id: string;
  truck_name: string;
  technician_id?: string;
  technician_name?: string;
  request_type: 'auto' | 'manual';
  items: Array<{
    item_id: string;
    item_name: string;
    sku: string;
    current_qty: number;
    requested_qty: number;
    reason: string;
  }>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
}

export const inventoryApi = {
  // Categories
  getCategories: () => fetchApi<InventoryCategory[]>('/inventory/categories'),
  
  createCategory: (data: { name: string; description?: string; icon?: string }) =>
    fetchApi<InventoryCategory>('/inventory/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  // Items
  getItems: (params?: { category_id?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.category_id) searchParams.append('category_id', params.category_id);
    if (params?.search) searchParams.append('search', params.search);
    const query = searchParams.toString();
    return fetchApi<InventoryItem[]>(`/inventory/items${query ? `?${query}` : ''}`);
  },
  
  getItem: (id: string) => fetchApi<InventoryItem>(`/inventory/items/${id}`),
  
  createItem: (data: Partial<InventoryItem>) =>
    fetchApi<InventoryItem>('/inventory/items', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateItem: (id: string, data: Partial<InventoryItem>) =>
    fetchApi<InventoryItem>(`/inventory/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  // Audit log
  getAuditLog: (params?: { truck_id?: string; job_id?: string; days?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.truck_id) searchParams.append('truck_id', params.truck_id);
    if (params?.job_id) searchParams.append('job_id', params.job_id);
    if (params?.days) searchParams.append('days', params.days.toString());
    const query = searchParams.toString();
    return fetchApi<any[]>(`/inventory/audit-log${query ? `?${query}` : ''}`);
  },
};

// ==================== TRUCKS API ====================

export const trucksApi = {
  getAll: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return fetchApi<Truck[]>(`/trucks${query}`);
  },
  
  getById: (id: string) => fetchApi<Truck>(`/trucks/${id}`),
  
  getByTechnician: (techId: string) => fetchApi<Truck>(`/trucks/by-technician/${techId}`),
  
  create: (data: Partial<Truck>) =>
    fetchApi<Truck>('/trucks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<Truck>) =>
    fetchApi<Truck>(`/trucks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  // Truck Inventory
  getInventory: (truckId: string) => fetchApi<TruckInventory>(`/truck-inventory/${truckId}`),
  
  updateInventoryItems: (truckId: string, items: Array<{ item_id: string; quantity: number }>) =>
    fetchApi<{ message: string }>(`/truck-inventory/${truckId}/items`, {
      method: 'PUT',
      body: JSON.stringify(items),
    }),
  
  addItemToTruck: (truckId: string, itemId: string, quantity: number) =>
    fetchApi<{ message: string }>(`/truck-inventory/${truckId}/add-item?item_id=${itemId}&quantity=${quantity}`, {
      method: 'POST',
    }),
};

// ==================== STOCK CHECK API ====================

export const stockCheckApi = {
  checkRequired: (technicianId: string) =>
    fetchApi<{
      required: boolean;
      reason: string;
      truck_id?: string;
      truck_name?: string;
      items?: TruckInventoryItem[];
    }>(`/stock-check/required/${technicianId}`),
  
  submit: (data: {
    truck_id: string;
    technician_id: string;
    shift_session_id?: string;
    check_type?: 'shift_start' | 'shift_end' | 'audit';
    items_checked: StockCheckItem[];
    notes?: string;
  }) =>
    fetchApi<any>('/stock-check', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getHistory: (params?: { truck_id?: string; technician_id?: string; days?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.truck_id) searchParams.append('truck_id', params.truck_id);
    if (params?.technician_id) searchParams.append('technician_id', params.technician_id);
    if (params?.days) searchParams.append('days', params.days.toString());
    const query = searchParams.toString();
    return fetchApi<any[]>(`/stock-checks${query ? `?${query}` : ''}`);
  },
};

// ==================== RESTOCK API ====================

export const restockApi = {
  getRequests: (params?: { status?: string; truck_id?: string; priority?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.truck_id) searchParams.append('truck_id', params.truck_id);
    if (params?.priority) searchParams.append('priority', params.priority);
    const query = searchParams.toString();
    return fetchApi<RestockRequest[]>(`/restock-requests${query ? `?${query}` : ''}`);
  },
  
  create: (data: {
    truck_id: string;
    technician_id?: string;
    request_type?: 'auto' | 'manual';
    items: Array<{ item_id: string; item_name: string; sku: string; current_qty: number; requested_qty: number; reason: string }>;
    priority?: string;
    notes?: string;
  }) =>
    fetchApi<RestockRequest>('/restock-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateStatus: (requestId: string, status: string, approvedBy?: string) =>
    fetchApi<{ message: string }>(
      `/restock-requests/${requestId}/status?status=${status}${approvedBy ? `&approved_by=${approvedBy}` : ''}`,
      { method: 'PUT' }
    ),
};

// ==================== JOB EQUIPMENT API ====================

export interface JobEquipmentUsage {
  id: string;
  job_id: string;
  job_number: string;
  technician_id: string;
  technician_name: string;
  truck_id: string;
  planned_items: Array<{ item_id: string; item_name: string; sku: string; quantity: number; unit_cost: number }>;
  actual_items: Array<{ item_id: string; item_name: string; sku: string; quantity: number; unit_cost: number; serial_number?: string }>;
  status: 'pending_approval' | 'approved' | 'adjusted' | 'disputed';
  tech_approved: boolean;
  has_variance: boolean;
  inventory_deducted: boolean;
}

export const jobEquipmentApi = {
  create: (jobId: string, technicianId: string, truckId: string, plannedItems?: any[]) =>
    fetchApi<JobEquipmentUsage>(
      `/jobs/${jobId}/equipment-usage?technician_id=${technicianId}&truck_id=${truckId}`,
      {
        method: 'POST',
        body: JSON.stringify(plannedItems || []),
      }
    ),
  
  get: (jobId: string) => fetchApi<JobEquipmentUsage | null>(`/jobs/${jobId}/equipment-usage`),
  
  approve: (jobId: string, actualItems: any[], notes?: string) =>
    fetchApi<{ message: string; has_variance: boolean }>(`/jobs/${jobId}/equipment-usage/approve`, {
      method: 'POST',
      body: JSON.stringify({ actual_items: actualItems, notes }),
    }),
};

// ==================== J-LOAD CALCULATOR API ====================

export interface JLoadQuickEstimate {
  id: string;
  job_id?: string;
  site_id?: string;
  quote_id?: string;
  square_footage: number;
  climate_zone: string;
  building_type: string;
  building_age: string;
  insulation_quality: string;
  num_floors: number;
  ceiling_height: number;
  num_windows: number;
  window_type: string;
  cooling_btuh: number;
  heating_btuh: number;
  recommended_tonnage: number;
  recommended_furnace_btuh: number;
  recommended_equipment: Array<{ type: string; size: string; model_suggestion: string }>;
  notes?: string;
  created_at: string;
}

export interface ManualJLoadCalculation {
  id: string;
  job_id?: string;
  project_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  climate_zone: string;
  total_square_footage: number;
  conditioned_volume: number;
  walls: any[];
  windows: any[];
  doors: any[];
  ceilings: any[];
  floors: any[];
  sensible_cooling_load: number;
  latent_cooling_load: number;
  total_cooling_load: number;
  heating_load: number;
  recommended_cooling_tons: number;
  recommended_heating_btuh: number;
  equipment_recommendations: any[];
  status: 'draft' | 'calculated' | 'verified' | 'approved';
}

export const jloadApi = {
  quickEstimate: (data: {
    job_id?: string;
    site_id?: string;
    quote_id?: string;
    square_footage: number;
    climate_zone: string;
    building_type?: string;
    building_age?: string;
    insulation_quality?: string;
    num_floors?: number;
    ceiling_height?: number;
    num_windows?: number;
    window_type?: string;
    notes?: string;
  }, technicianId?: string) =>
    fetchApi<JLoadQuickEstimate>(
      `/jload/quick-estimate${technicianId ? `?technician_id=${technicianId}` : ''}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
  
  createManualJ: (data: {
    job_id?: string;
    project_name: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    climate_zone: string;
    total_square_footage: number;
    num_floors?: number;
    ceiling_height?: number;
  }, technicianId?: string) =>
    fetchApi<ManualJLoadCalculation>(
      `/jload/manual-j${technicianId ? `?technician_id=${technicianId}` : ''}`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
  
  getManualJ: (calcId: string) => fetchApi<ManualJLoadCalculation>(`/jload/manual-j/${calcId}`),
  
  updateManualJ: (calcId: string, data: Partial<ManualJLoadCalculation>) =>
    fetchApi<ManualJLoadCalculation>(`/jload/manual-j/${calcId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  runManualJCalculation: (calcId: string) =>
    fetchApi<{
      sensible_cooling_load: number;
      latent_cooling_load: number;
      total_cooling_load: number;
      heating_load: number;
      recommended_cooling_tons: number;
      recommended_heating_btuh: number;
      equipment_recommendations: any[];
    }>(`/jload/manual-j/${calcId}/calculate`, { method: 'POST' }),
  
  getByJob: (jobId: string) =>
    fetchApi<{
      quick_estimates: JLoadQuickEstimate[];
      manual_j_calculations: ManualJLoadCalculation[];
    }>(`/jload/by-job/${jobId}`),
};

// ==================== SEED API ====================

export const seedApi = {
  seed: () => fetchApi<{ message: string; technicians: number; jobs: number; tasks: number }>('/seed', {
    method: 'POST',
  }),
};
