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

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}/api${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
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
  
  // ======= Multi-Location Inventory =======
  
  // Locations (warehouses, trucks, etc.)
  getLocations: () => fetchApi<InventoryLocation[]>('/inventory/locations'),
  
  createLocation: (data: Partial<InventoryLocation>) =>
    fetchApi<InventoryLocation>('/inventory/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateLocation: (id: string, data: Partial<InventoryLocation>) =>
    fetchApi<InventoryLocation>(`/inventory/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  // Location Stock
  getLocationStock: (locationId: string) =>
    fetchApi<LocationInventory[]>(`/inventory/locations/${locationId}/stock`),
  
  updateLocationStock: (locationId: string, itemId: string, data: Partial<LocationInventory>) =>
    fetchApi<LocationInventory>(`/inventory/locations/${locationId}/stock/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  // Transfers
  getTransfers: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return fetchApi<InventoryTransfer[]>(`/inventory/transfers${query}`);
  },
  
  createTransfer: (data: Partial<InventoryTransfer>) =>
    fetchApi<InventoryTransfer>('/inventory/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  approveTransfer: (transferId: string) =>
    fetchApi<InventoryTransfer>(`/inventory/transfers/${transferId}/approve`, {
      method: 'PUT',
    }),
  
  receiveTransfer: (transferId: string) =>
    fetchApi<InventoryTransfer>(`/inventory/transfers/${transferId}/receive`, {
      method: 'PUT',
    }),
};

// Multi-warehouse inventory types
export interface InventoryLocation {
  id: string;
  name: string;
  location_type: 'warehouse' | 'truck' | 'satellite' | 'vendor';
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  truck_id?: string;
  assigned_technician_id?: string;
  manager_name?: string;
  phone?: string;
  is_active: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationInventory {
  id: string;
  location_id: string;
  item_id: string;
  item_name?: string;
  item_sku?: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  min_quantity: number;
  max_quantity: number;
  reorder_point: number;
  average_cost: number;
  total_value: number;
  last_counted_at?: string;
  last_restocked_at?: string;
  updated_at: string;
}

export interface InventoryTransfer {
  id: string;
  transfer_number: string;
  from_location_id: string;
  from_location_name: string;
  to_location_id: string;
  to_location_name: string;
  items: Array<{
    item_id: string;
    item_name: string;
    quantity: number;
    unit_cost: number;
  }>;
  status: 'pending' | 'in_transit' | 'received' | 'cancelled';
  requested_by_id: string;
  requested_by_name: string;
  approved_by_id?: string;
  received_by_id?: string;
  requested_at: string;
  approved_at?: string;
  shipped_at?: string;
  received_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

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

// ==================== GOOGLE MAPS ROUTING API ====================

export interface RouteCalculation {
  id: string;
  origin_address: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_address: string;
  destination_lat?: number;
  destination_lng?: number;
  distance_meters: number;
  distance_miles: number;
  duration_seconds: number;
  duration_minutes: number;
  duration_in_traffic_seconds?: number;
  duration_in_traffic_minutes?: number;
  polyline?: string;
  summary?: string;
  warnings: string[];
  api_status: string;
}

export const mapsApi = {
  getConfig: () => fetchApi<{ configured: boolean; message: string }>('/maps/config'),
  
  calculateRoute: (origin: string, destination: string, departureTime?: string) =>
    fetchApi<RouteCalculation>('/maps/route', {
      method: 'POST',
      body: JSON.stringify({ origin, destination, departure_time: departureTime }),
    }),
  
  geocode: (address: string) =>
    fetchApi<{ address: string; lat: number; lng: number } | { error: string }>(
      `/maps/geocode?address=${encodeURIComponent(address)}`
    ),
};

// ==================== MAINTENANCE AGREEMENTS API ====================

export interface MaintenanceTemplate {
  id: string;
  name: string;
  description?: string;
  frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  visits_per_year: number;
  base_price: number;
  included_services: string[];
  parts_discount_percent: number;
  labor_discount_percent: number;
  priority_response: boolean;
}

export interface MaintenanceAgreement {
  id: string;
  agreement_number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  service_address: string;
  template_id?: string;
  template_name?: string;
  frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  equipment: Array<{ type: string; model: string; serial_number?: string; location?: string }>;
  start_date: string;
  end_date: string;
  next_service_date?: string;
  last_service_date?: string;
  annual_price: number;
  payment_frequency: 'monthly' | 'quarterly' | 'annual';
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  auto_renew: boolean;
  generated_job_ids: string[];
  notes?: string;
  created_at: string;
}

export const maintenanceApi = {
  getTemplates: () => fetchApi<MaintenanceTemplate[]>('/maintenance/templates'),
  
  createTemplate: (data: Partial<MaintenanceTemplate>) =>
    fetchApi<MaintenanceTemplate>('/maintenance/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getAgreements: (params?: { status?: string; customer_name?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.customer_name) searchParams.append('customer_name', params.customer_name);
    const query = searchParams.toString();
    return fetchApi<MaintenanceAgreement[]>(`/maintenance/agreements${query ? `?${query}` : ''}`);
  },
  
  getAgreement: (id: string) => fetchApi<MaintenanceAgreement>(`/maintenance/agreements/${id}`),
  
  createAgreement: (data: {
    customer_name: string;
    customer_email?: string;
    customer_phone?: string;
    service_address: string;
    template_id?: string;
    frequency?: string;
    equipment?: any[];
    start_date: string;
    end_date?: string;
    annual_price?: number;
    payment_frequency?: string;
    auto_renew?: boolean;
    notes?: string;
  }) =>
    fetchApi<MaintenanceAgreement>('/maintenance/agreements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateAgreement: (id: string, data: Partial<MaintenanceAgreement>) =>
    fetchApi<MaintenanceAgreement>(`/maintenance/agreements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  generateJobs: (agreementId: string) =>
    fetchApi<{ message: string; job_ids: string[] }>(`/maintenance/agreements/${agreementId}/generate-jobs`, {
      method: 'POST',
    }),
  
  getDueRenewals: (days: number = 30) =>
    fetchApi<MaintenanceAgreement[]>(`/maintenance/due-renewals?days=${days}`),
};

// ==================== INSTALL PROJECTS / GANTT API ====================

export interface ProjectPhase {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  depends_on: string[];
  assigned_technician_ids: string[];
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  percent_complete: number;
  milestones: Array<{ name: string; date: string; completed: boolean }>;
  task_ids: string[];
  color?: string;
  notes?: string;
}

export interface InstallProject {
  id: string;
  project_number: string;
  job_id: string;
  name: string;
  description?: string;
  customer_name: string;
  site_address: string;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date?: string;
  actual_end_date?: string;
  phases: ProjectPhase[];
  assigned_technician_ids: string[];
  estimated_hours: number;
  actual_hours: number;
  estimated_cost: number;
  actual_cost: number;
  status: 'planning' | 'scheduled' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  percent_complete: number;
  billing_milestones: Array<{ name: string; percent: number; amount: number; invoiced: boolean }>;
  notes?: string;
}

export interface GanttData {
  project: { id: string; name: string; start: string; end: string; progress: number };
  phases: Array<{
    id: string;
    name: string;
    start: string;
    end: string;
    duration: number;
    progress: number;
    dependencies: string[];
    resources: string[];
    color?: string;
    status: string;
  }>;
  resources: Array<{ id: string; name: string }>;
}

export const projectsApi = {
  getAll: (params?: { status?: string; job_id?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.job_id) searchParams.append('job_id', params.job_id);
    const query = searchParams.toString();
    return fetchApi<InstallProject[]>(`/projects${query ? `?${query}` : ''}`);
  },
  
  getById: (id: string) => fetchApi<InstallProject>(`/projects/${id}`),
  
  create: (data: {
    job_id: string;
    name: string;
    description?: string;
    customer_name: string;
    site_address: string;
    planned_start_date: string;
    planned_end_date: string;
    estimated_hours?: number;
    estimated_cost?: number;
    notes?: string;
  }) =>
    fetchApi<InstallProject>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<InstallProject>) =>
    fetchApi<InstallProject>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  addPhase: (projectId: string, data: {
    name: string;
    description?: string;
    start_date: string;
    end_date: string;
    depends_on?: string[];
    assigned_technician_ids?: string[];
    color?: string;
  }) =>
    fetchApi<ProjectPhase>(`/projects/${projectId}/phases`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updatePhase: (projectId: string, phaseId: string, data: Partial<ProjectPhase>) =>
    fetchApi<{ message: string }>(`/projects/${projectId}/phases/${phaseId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  getGanttData: (projectId: string) => fetchApi<GanttData>(`/projects/gantt-data/${projectId}`),
};

// ==================== CUSTOMER PORTAL API ====================

export interface CustomerAccount {
  id: string;
  email: string;
  name: string;
  phone?: string;
  addresses: Array<{ address: string; is_primary: boolean }>;
  email_verified: boolean;
  notification_preferences: { email_reminders: boolean; sms_reminders: boolean; marketing: boolean };
  status: 'active' | 'inactive' | 'suspended';
  last_login?: string;
}

export interface ServiceRequest {
  id: string;
  request_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  service_type: 'repair' | 'maintenance' | 'installation' | 'inspection' | 'other';
  description: string;
  urgency: 'low' | 'normal' | 'high' | 'emergency';
  preferred_dates: string[];
  preferred_time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime';
  service_address: string;
  access_instructions?: string;
  status: 'pending' | 'confirmed' | 'scheduled' | 'completed' | 'cancelled';
  assigned_job_id?: string;
  notes?: string;
  created_at: string;
}

export const customerPortalApi = {
  register: (data: { email: string; password?: string; name: string; phone?: string; address?: string }) =>
    fetchApi<{ message: string; customer_id: string; verification_token?: string }>('/customer/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  login: (email: string, password: string) =>
    fetchApi<{ message: string; token: string; customer: { id: string; name: string; email: string } }>(
      '/customer/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  
  requestMagicLink: (email: string) =>
    fetchApi<{ message: string; token?: string }>('/customer/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  
  verifyMagicLink: (token: string) =>
    fetchApi<{ message: string; token: string; customer: { id: string; name: string; email: string } }>(
      `/customer/verify-magic/${token}`,
      { method: 'POST' }
    ),
  
  getProfile: (customerId: string) => fetchApi<CustomerAccount>(`/customer/profile/${customerId}`),
  
  updateProfile: (customerId: string, data: Partial<CustomerAccount>) =>
    fetchApi<{ message: string }>(`/customer/profile/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  createServiceRequest: (customerId: string, data: {
    service_type: string;
    description: string;
    urgency?: string;
    preferred_dates?: string[];
    preferred_time_of_day?: string;
    service_address: string;
    access_instructions?: string;
  }) =>
    fetchApi<{ message: string; request_number: string; request_id: string }>(
      `/customer/service-request?customer_id=${customerId}`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  
  getServiceRequests: (customerId: string) =>
    fetchApi<ServiceRequest[]>(`/customer/${customerId}/service-requests`),
  
  getJobs: (customerId: string) =>
    fetchApi<any[]>(`/customer/${customerId}/jobs`),
  
  getAgreements: (customerId: string) =>
    fetchApi<MaintenanceAgreement[]>(`/customer/${customerId}/agreements`),
};

// Admin service request management
export const serviceRequestsApi = {
  getAll: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return fetchApi<ServiceRequest[]>(`/service-requests${query}`);
  },
  
  updateStatus: (requestId: string, status: string, jobId?: string) =>
    fetchApi<{ message: string }>(
      `/service-requests/${requestId}/status?status=${status}${jobId ? `&job_id=${jobId}` : ''}`,
      { method: 'PUT' }
    ),
};

// ==================== OFFLINE SYNC API ====================

export interface SyncChange {
  operation: 'create' | 'update' | 'delete';
  entity_type: string;
  entity_id?: string;
  payload?: any;
  client_timestamp: string;
}

export interface SyncResult {
  synced: Array<{ entity_type: string; entity_id?: string; message?: string }>;
  conflicts: Array<{
    entity_type: string;
    entity_id?: string;
    conflict_type: string;
    server_data?: any;
    queue_id: string;
  }>;
  failed: Array<{ entity_type: string; error: string }>;
}

export interface SyncStatus {
  client_id: string;
  pending_count: number;
  synced_count: number;
  conflict_count: number;
  failed_count: number;
  last_sync?: string;
  conflicts: any[];
}

export const syncApi = {
  syncBatch: (clientId: string, userId: string | null, userType: string, changes: SyncChange[]) =>
    fetchApi<SyncResult>('/sync/batch', {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId,
        user_id: userId,
        user_type: userType,
        changes,
      }),
    }),
  
  resolveConflict: (queueId: string, resolution: 'client_wins' | 'server_wins' | 'merged' | 'manual', mergedData?: any) =>
    fetchApi<{ message: string }>('/sync/resolve', {
      method: 'POST',
      body: JSON.stringify({
        queue_id: queueId,
        resolution,
        merged_data: mergedData,
      }),
    }),
  
  getStatus: (clientId: string) => fetchApi<SyncStatus>(`/sync/status/${clientId}`),
  
  getPending: (clientId: string) => fetchApi<any[]>(`/sync/pending/${clientId}`),
};

// ==================== SEED API ====================

export const seedApi = {
  seed: () => fetchApi<{ message: string; technicians: number; jobs: number; tasks: number }>('/seed', {
    method: 'POST',
  }),
};

// ==================== SYSTEM SETTINGS API ====================

export interface SystemSettings {
  id: string;
  google_maps_enabled: boolean;
  google_maps_api_key_set: boolean;
  ai_features_enabled: boolean;
  ai_provider?: "gemini" | "openai" | "claude";
  ai_model?: string;
  ai_failover_enabled?: boolean;
  quickbooks_enabled?: boolean;
  quickbooks_configured?: boolean;
  quickbooks_sync_invoices?: boolean;
  quickbooks_sync_payments?: boolean;
  quickbooks_sync_customers?: boolean;
  quickbooks_last_sync?: string | null;
  push_notifications_enabled?: boolean;
  push_vapid_public_key?: string | null;
  push_vapid_private_key?: string | null;
  notify_on_chat_message?: boolean;
  notify_on_job_assignment?: boolean;
  notify_on_schedule_change?: boolean;
  notify_on_payment_received?: boolean;
  default_tax_rate: number;
  default_labor_rate: number;
  overtime_multiplier: number;
  default_trip_charge: number;
  default_parts_markup: number;
  default_job_duration_hours: number;
  buffer_time_percent: number;
  require_shift_start_stock_check: boolean;
  require_shift_end_stock_check: boolean;
  customer_portal_enabled: boolean;
  allow_customer_scheduling: boolean;
}

export const settingsApi = {
  get: () => fetchApi<SystemSettings>('/system/settings'),
  
  update: (data: Partial<SystemSettings>) =>
    fetchApi<SystemSettings>('/system/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ==================== ROLES API (RFC-002) ====================

export interface Permission {
  module: string;
  action: string;
  allowed: boolean;
}

export interface Role {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  permissions: Permission[];
  is_system: boolean;
  created_at: string;
}

export const rolesApi = {
  getAll: () => fetchApi<Role[]>('/roles'),
  
  create: (data: { name: string; display_name: string; description?: string; permissions?: Permission[] }) =>
    fetchApi<Role>('/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  delete: (roleId: string) =>
    fetchApi<{ message: string }>(`/roles/${roleId}`, {
      method: 'DELETE',
    }),
};

// ==================== LEADS API (RFC-002) ====================

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'quoted' | 'won' | 'lost';

export interface Lead {
  id: string;
  lead_number: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  company_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  source: string;
  source_detail?: string;
  preferred_contact_method: 'phone' | 'email' | 'text' | 'any';
  status: LeadStatus;
  status_changed_at: string;
  assigned_to_id?: string;
  assigned_to_name?: string;
  first_contact_at?: string;
  qualified_at?: string;
  quoted_at?: string;
  closed_at?: string;
  close_reason?: string;
  converted_customer_id?: string;
  converted_job_id?: string;
  proposal_ids: string[];
  notes?: string;
  tags: string[];
  estimated_value: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
}

export interface LeadMetrics {
  total_leads: number;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  lead_to_close_ratio: number;
  avg_time_to_first_contact_hours: number;
}

export const leadsApi = {
  getAll: (params?: { status?: string; source?: string; assigned_to?: string; search?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.source) searchParams.append('source', params.source);
    if (params?.assigned_to) searchParams.append('assigned_to', params.assigned_to);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString();
    return fetchApi<Lead[]>(`/leads${query ? `?${query}` : ''}`);
  },
  
  getMetrics: () => fetchApi<LeadMetrics>('/leads/metrics'),
  
  getById: (id: string) => fetchApi<Lead>(`/leads/${id}`),
  
  create: (data: {
    contact_name: string;
    contact_email?: string;
    contact_phone?: string;
    company_name?: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    source?: string;
    source_detail?: string;
    preferred_contact_method?: string;
    notes?: string;
    tags?: string[];
    estimated_value?: number;
    priority?: string;
  }) =>
    fetchApi<Lead>('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<Lead>) =>
    fetchApi<Lead>(`/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  convert: (id: string) =>
    fetchApi<{ message: string; customer_id: string; lead_id: string }>(`/leads/${id}/convert`, {
      method: 'POST',
    }),
  
  delete: (id: string) =>
    fetchApi<{ message: string }>(`/leads/${id}`, {
      method: 'DELETE',
    }),
};

// ==================== PCB API (RFC-002) ====================

export type PCBStatus = 'created' | 'assigned' | 'follow_up' | 'converted' | 'closed';

export interface PCB {
  id: string;
  pcb_number: string;
  lead_id?: string;
  job_id?: string;
  customer_id?: string;
  customer_name?: string;
  reason: string;
  reason_category: 'follow_up' | 'upsell' | 'warranty' | 'complaint' | 'question' | 'other';
  status: PCBStatus;
  status_changed_at: string;
  assigned_technician_id?: string;
  assigned_technician_name?: string;
  assigned_owner_id?: string;
  assigned_owner_name?: string;
  follow_up_date?: string;
  follow_up_time?: string;
  reminder_sent: boolean;
  converted_to_job_id?: string;
  resolution_notes?: string;
  resolved_at?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PCBMetrics {
  total_pcbs: number;
  open_pcbs: number;
  by_status: Record<string, number>;
  conversion_rate: number;
  overdue_count: number;
}

export const pcbsApi = {
  getAll: (params?: { status?: string; assigned_to?: string; priority?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.assigned_to) searchParams.append('assigned_to', params.assigned_to);
    if (params?.priority) searchParams.append('priority', params.priority);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString();
    return fetchApi<PCB[]>(`/pcbs${query ? `?${query}` : ''}`);
  },
  
  getMetrics: () => fetchApi<PCBMetrics>('/pcbs/metrics'),
  
  getById: (id: string) => fetchApi<PCB>(`/pcbs/${id}`),
  
  create: (data: {
    lead_id?: string;
    job_id?: string;
    customer_id?: string;
    customer_name?: string;
    reason: string;
    reason_category?: string;
    assigned_technician_id?: string;
    assigned_owner_id?: string;
    follow_up_date?: string;
    follow_up_time?: string;
    priority?: string;
    notes?: string;
  }) =>
    fetchApi<PCB>('/pcbs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<PCB>) =>
    fetchApi<PCB>(`/pcbs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  convert: (id: string) =>
    fetchApi<{ message: string; job_id: string; job_number: string }>(`/pcbs/${id}/convert`, {
      method: 'POST',
    }),
  
  delete: (id: string) =>
    fetchApi<{ message: string }>(`/pcbs/${id}`, {
      method: 'DELETE',
    }),
};

// ==================== PROPOSALS API (RFC-002) ====================

export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';

export interface ProposalLineItem {
  id: string;
  item_type: 'equipment' | 'labor' | 'material' | 'misc' | 'discount';
  name: string;
  description?: string;
  sku?: string;
  manufacturer?: string;
  model?: string;
  warranty_years?: number;
  quantity: number;
  unit: string;
  unit_price: number;
  extended_price: number;
  unit_cost: number;
  margin_percent: number;
}

export interface ProposalOption {
  id: string;
  tier: 'good' | 'better' | 'best';
  name: string;
  description?: string;
  line_items: ProposalLineItem[];
  equipment_total: number;
  labor_total: number;
  materials_total: number;
  misc_total: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  financing_available: boolean;
  monthly_payment?: number;
  financing_term_months?: number;
  is_recommended: boolean;
}

export interface Proposal {
  id: string;
  proposal_number: string;
  lead_id?: string;
  job_id?: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  site_address: string;
  title: string;
  description?: string;
  options: ProposalOption[];
  selected_option_id?: string;
  status: ProposalStatus;
  status_changed_at: string;
  valid_until?: string;
  sent_at?: string;
  viewed_at?: string;
  accepted_at?: string;
  created_by_id?: string;
  created_by_name?: string;
  customer_signature?: string;
  customer_signed_at?: string;
  converted_job_id?: string;
  notes?: string;
  internal_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProposalMetrics {
  total_proposals: number;
  by_status: Record<string, number>;
  open_quotes: number;
  win_rate: number;
}

export const proposalsApi = {
  getAll: (params?: { status?: string; lead_id?: string; customer_id?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.lead_id) searchParams.append('lead_id', params.lead_id);
    if (params?.customer_id) searchParams.append('customer_id', params.customer_id);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString();
    return fetchApi<Proposal[]>(`/proposals${query ? `?${query}` : ''}`);
  },
  
  getMetrics: () => fetchApi<ProposalMetrics>('/proposals/metrics'),
  
  getById: (id: string) => fetchApi<Proposal>(`/proposals/${id}`),
  
  create: (data: {
    lead_id?: string;
    job_id?: string;
    customer_id?: string;
    customer_name: string;
    customer_email?: string;
    customer_phone?: string;
    site_address: string;
    title: string;
    description?: string;
    valid_until?: string;
    notes?: string;
  }) =>
    fetchApi<Proposal>('/proposals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<Proposal>) =>
    fetchApi<Proposal>(`/proposals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  addOption: (id: string, option: {
    tier: string;
    name: string;
    description?: string;
    line_items?: any[];
    is_recommended?: boolean;
  }) =>
    fetchApi<{ message: string; option_id: string }>(`/proposals/${id}/options`, {
      method: 'POST',
      body: JSON.stringify(option),
    }),
  
  accept: (id: string, optionId: string, signature?: string) =>
    fetchApi<{ message: string; job_id: string; job_number: string }>(
      `/proposals/${id}/accept?option_id=${optionId}${signature ? `&signature=${encodeURIComponent(signature)}` : ''}`,
      { method: 'POST' }
    ),
};

// ==================== JOB TYPES API (RFC-002) ====================

export interface ChecklistItemTemplate {
  id: string;
  order: number;
  description: string;
  requires_before_photo: boolean;
  requires_after_photo: boolean;
  requires_note: boolean;
  requires_measurement: boolean;
  requires_signature: boolean;
  is_required: boolean;
  allow_exception: boolean;
}

export interface JobTypeTemplate {
  id: string;
  name: string;
  category: 'residential_service' | 'residential_install' | 'commercial_service' | 'commercial_install';
  description?: string;
  default_priority: 'low' | 'normal' | 'high' | 'urgent';
  estimated_duration_hours: number;
  requires_permit: boolean;
  requires_inspection: boolean;
  base_labor_rate: number;
  trip_charge: number;
  checklist_items: ChecklistItemTemplate[];
  version: number;
  is_active: boolean;
  created_at: string;
}

export const jobTypesApi = {
  getAll: (params?: { category?: string; active_only?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.active_only !== undefined) searchParams.append('active_only', params.active_only.toString());
    const query = searchParams.toString();
    return fetchApi<JobTypeTemplate[]>(`/job-types${query ? `?${query}` : ''}`);
  },
  
  create: (data: {
    name: string;
    category: string;
    description?: string;
    default_priority?: string;
    estimated_duration_hours?: number;
    requires_permit?: boolean;
    requires_inspection?: boolean;
    base_labor_rate?: number;
    trip_charge?: number;
    checklist_items?: ChecklistItemTemplate[];
  }) =>
    fetchApi<JobTypeTemplate>('/job-types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<JobTypeTemplate>) =>
    fetchApi<JobTypeTemplate>(`/job-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ==================== JOB CHECKLISTS API (RFC-002) ====================

export interface ChecklistItemEvidence {
  id: string;
  evidence_type: 'before_photo' | 'after_photo' | 'note' | 'signature' | 'measurement';
  photo_url?: string;
  photo_data?: string;
  photo_taken_at?: string;
  measurement_value?: number;
  measurement_unit?: string;
  note_text?: string;
  signature_data?: string;
  captured_by_id?: string;
  captured_by_name?: string;
  captured_at: string;
}

export interface JobChecklistItem {
  id: string;
  template_item_id?: string;
  order: number;
  description: string;
  requires_before_photo: boolean;
  requires_after_photo: boolean;
  requires_note: boolean;
  requires_measurement: boolean;
  requires_signature: boolean;
  is_required: boolean;
  status: 'not_started' | 'in_progress' | 'completed' | 'exception';
  evidence: ChecklistItemEvidence[];
  has_exception: boolean;
  exception_reason?: string;
  completed_at?: string;
  completed_by_id?: string;
  completed_by_name?: string;
}

export interface JobChecklist {
  id: string;
  job_id: string;
  template_id?: string;
  template_name?: string;
  items: JobChecklistItem[];
  total_items: number;
  completed_items: number;
  exception_items: number;
  percent_complete: number;
  can_complete_job: boolean;
  blocking_items: string[];
  created_at: string;
  updated_at: string;
}

export const jobChecklistApi = {
  get: (jobId: string) => fetchApi<{ checklist: JobChecklist | null; message?: string }>(`/jobs/${jobId}/checklist`),
  
  create: (jobId: string, templateId?: string) =>
    fetchApi<JobChecklist>(
      `/jobs/${jobId}/checklist${templateId ? `?template_id=${templateId}` : ''}`,
      { method: 'POST' }
    ),
  
  updateItem: (jobId: string, itemId: string, data: {
    status?: string;
    evidence?: Partial<ChecklistItemEvidence>;
    has_exception?: boolean;
    exception_reason?: string;
    completed_by_id?: string;
    completed_by_name?: string;
  }) =>
    fetchApi<JobChecklist>(`/jobs/${jobId}/checklist/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ==================== VENDORS API (RFC-002) ====================

export interface Vendor {
  id: string;
  vendor_number: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  payment_terms: string;
  credit_limit?: number;
  account_number?: string;
  website?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

export const vendorsApi = {
  getAll: (params?: { active_only?: boolean; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.active_only !== undefined) searchParams.append('active_only', params.active_only.toString());
    if (params?.search) searchParams.append('search', params.search);
    const query = searchParams.toString();
    return fetchApi<Vendor[]>(`/vendors${query ? `?${query}` : ''}`);
  },
  
  getById: (id: string) => fetchApi<Vendor>(`/vendors/${id}`),
  
  create: (data: {
    name: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    payment_terms?: string;
    account_number?: string;
    notes?: string;
  }) =>
    fetchApi<Vendor>('/vendors', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<Vendor>) =>
    fetchApi<Vendor>(`/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ==================== PURCHASE ORDERS API (RFC-002) ====================

export interface POLineItem {
  id: string;
  item_id: string;
  item_name: string;
  sku: string;
  quantity_ordered: number;
  quantity_received: number;
  unit: string;
  unit_cost: number;
  extended_cost: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  vendor_name: string;
  line_items: POLineItem[];
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  total: number;
  status: 'draft' | 'submitted' | 'confirmed' | 'partial' | 'received' | 'cancelled';
  order_date?: string;
  expected_date?: string;
  received_date?: string;
  receive_to_location_id?: string;
  receive_to_location_name?: string;
  job_id?: string;
  notes?: string;
  created_at: string;
}

export const purchaseOrdersApi = {
  getAll: (params?: { status?: string; vendor_id?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.vendor_id) searchParams.append('vendor_id', params.vendor_id);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString();
    return fetchApi<PurchaseOrder[]>(`/purchase-orders${query ? `?${query}` : ''}`);
  },
  
  getById: (id: string) => fetchApi<PurchaseOrder>(`/purchase-orders/${id}`),
  
  create: (data: {
    vendor_id: string;
    line_items?: { item_id: string; quantity_ordered: number; unit_cost?: number }[];
    expected_date?: string;
    receive_to_location_id?: string;
    job_id?: string;
    notes?: string;
  }) =>
    fetchApi<PurchaseOrder>('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateStatus: (id: string, status: string) =>
    fetchApi<{ message: string }>(`/purchase-orders/${id}/status?status=${status}`, {
      method: 'PUT',
    }),
};

// ==================== INVOICES API (RFC-002) ====================

export interface InvoiceLineItem {
  id: string;
  line_type: 'labor' | 'parts' | 'trip' | 'misc' | 'discount' | 'tax';
  description: string;
  sku?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  extended_price: number;
  cost: number;
  markup_percent: number;
}

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  job_id?: string;
  job_number?: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  billing_address?: string;
  line_items: InvoiceLineItem[];
  labor_total: number;
  parts_total: number;
  trip_total: number;
  misc_total: number;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'void' | 'overdue';
  amount_paid: number;
  balance_due: number;
  invoice_date: string;
  due_date?: string;
  paid_date?: string;
  notes?: string;
  created_at: string;
}

export const invoicesApi = {
  getAll: (params?: { status?: string; customer_id?: string; job_id?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.customer_id) searchParams.append('customer_id', params.customer_id);
    if (params?.job_id) searchParams.append('job_id', params.job_id);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString();
    return fetchApi<InvoiceRecord[]>(`/invoices${query ? `?${query}` : ''}`);
  },
  
  getById: (id: string) => fetchApi<InvoiceRecord>(`/invoices/${id}`),
  
  create: (data: {
    job_id?: string;
    customer_id?: string;
    customer_name: string;
    customer_email?: string;
    billing_address?: string;
    line_items?: any[];
    tax_rate?: number;
    due_date?: string;
    notes?: string;
  }) =>
    fetchApi<InvoiceRecord>('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateStatus: (id: string, status: string) =>
    fetchApi<{ message: string }>(`/invoices/${id}/status?status=${status}`, {
      method: 'PUT',
    }),
};

// ==================== PAYMENTS API (RFC-002) ====================

export interface PaymentRecord {
  id: string;
  payment_number: string;
  invoice_id: string;
  invoice_number?: string;
  customer_id?: string;
  customer_name?: string;
  payment_method: 'card' | 'ach' | 'check' | 'cash' | 'financing' | 'other';
  amount: number;
  card_last_four?: string;
  card_brand?: string;
  check_number?: string;
  financing_provider?: string;
  transaction_id?: string;
  processed_at: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  notes?: string;
  created_at: string;
}

export const paymentsApi = {
  getAll: (params?: { invoice_id?: string; customer_id?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.invoice_id) searchParams.append('invoice_id', params.invoice_id);
    if (params?.customer_id) searchParams.append('customer_id', params.customer_id);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString();
    return fetchApi<PaymentRecord[]>(`/payments${query ? `?${query}` : ''}`);
  },
  
  create: (data: {
    invoice_id: string;
    payment_method: string;
    amount: number;
    card_last_four?: string;
    check_number?: string;
    financing_provider?: string;
    notes?: string;
  }) =>
    fetchApi<PaymentRecord>('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ==================== CUSTOMER EQUIPMENT API (RFC-002) ====================

export interface CustomerEquipmentRecord {
  id: string;
  customer_id: string;
  customer_name?: string;
  site_address?: string;
  equipment_type: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  location_in_building?: string;
  install_date?: string;
  warranty_start_date?: string;
  warranty_end_date?: string;
  warranty_type: 'manufacturer' | 'extended' | 'labor' | 'parts' | 'full';
  warranty_terms?: string;
  is_in_warranty: boolean;
  warranty_expiring_soon: boolean;
  last_service_date?: string;
  next_service_date?: string;
  service_job_ids: string[];
  notes?: string;
  is_active: boolean;
  created_at: string;
}

export const customerEquipmentApi = {
  getAll: (params?: { customer_id?: string; warranty_expiring?: boolean; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.customer_id) searchParams.append('customer_id', params.customer_id);
    if (params?.warranty_expiring) searchParams.append('warranty_expiring', 'true');
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString();
    return fetchApi<CustomerEquipmentRecord[]>(`/customer-equipment${query ? `?${query}` : ''}`);
  },
  
  getById: (id: string) => fetchApi<CustomerEquipmentRecord>(`/customer-equipment/${id}`),
  
  create: (data: {
    customer_id: string;
    site_address?: string;
    equipment_type: string;
    manufacturer?: string;
    model?: string;
    serial_number?: string;
    location_in_building?: string;
    install_date?: string;
    warranty_start_date?: string;
    warranty_end_date?: string;
    warranty_type?: string;
    notes?: string;
  }) =>
    fetchApi<CustomerEquipmentRecord>('/customer-equipment', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ==================== SITES API ====================

export interface SiteContact {
  name: string;
  phone?: string;
  email?: string;
  role?: string;
  is_primary: boolean;
  notes?: string;
}

export interface Site {
  id: string;
  customer_id: string;
  customer_name?: string;
  name: string;
  site_type: 'residential' | 'commercial' | 'industrial' | 'multi-family';
  address: string;
  city?: string;
  state?: string;
  zip_code?: string;
  access_instructions?: string;
  gate_code?: string;
  key_location?: string;
  parking_notes?: string;
  building_hours?: string;
  contacts: SiteContact[];
  equipment_ids: string[];
  total_jobs: number;
  last_service_date?: string;
  latitude?: number;
  longitude?: number;
  is_active: boolean;
  requires_appointment: boolean;
  has_pets: boolean;
  pet_notes?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SiteCreate {
  customer_id: string;
  name: string;
  site_type?: 'residential' | 'commercial' | 'industrial' | 'multi-family';
  address: string;
  city?: string;
  state?: string;
  zip_code?: string;
  access_instructions?: string;
  gate_code?: string;
  key_location?: string;
  parking_notes?: string;
  building_hours?: string;
  contacts?: SiteContact[];
  requires_appointment?: boolean;
  has_pets?: boolean;
  pet_notes?: string;
  notes?: string;
}

export const sitesApi = {
  getAll: (params?: { customer_id?: string; site_type?: string; search?: string }) => {
    const query = params ? new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined) as [string, string][]
    ).toString() : '';
    return fetchApi<Site[]>(`/sites${query ? `?${query}` : ''}`);
  },
  
  getById: (id: string) => fetchApi<Site>(`/sites/${id}`),
  
  getJobs: (id: string) => fetchApi<Job[]>(`/sites/${id}/jobs`),
  
  getEquipment: (id: string) => fetchApi<CustomerEquipmentRecord[]>(`/sites/${id}/equipment`),
  
  create: (data: SiteCreate) =>
    fetchApi<Site>('/sites', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<Site>) =>
    fetchApi<Site>(`/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) =>
    fetchApi<{ message: string }>(`/sites/${id}`, {
      method: 'DELETE',
    }),
  
  linkEquipment: (siteId: string, equipmentId: string) =>
    fetchApi<{ message: string }>(`/sites/${siteId}/equipment/${equipmentId}`, {
      method: 'POST',
    }),
  
  migrateFromJobs: () =>
    fetchApi<{ message: string; sites_created: number; total_unique_addresses: number }>(
      '/sites/migrate-from-jobs',
      { method: 'POST' }
    ),
};

// ==================== AUTHENTICATION API ====================

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar_url?: string;
  phone?: string;
  auth_provider: 'local' | 'google';
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export const authApi = {
  register: (data: { email: string; password: string; name: string; role?: string }) =>
    fetchApi<TokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  login: (data: { email: string; password: string }) =>
    fetchApi<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getMe: () => fetchApi<AuthUser>('/auth/me'),
  
  updateMe: (data: { name?: string; phone?: string; avatar_url?: string }) =>
    fetchApi<AuthUser>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  changePassword: (data: { current_password: string; new_password: string }) =>
    fetchApi<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getUsers: () => fetchApi<AuthUser[]>('/auth/users'),
  
  updateUserRole: (userId: string, role: string) =>
    fetchApi<{ message: string }>(`/auth/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  
  googleSessionExchange: (sessionId: string) =>
    fetchApi<TokenResponse>('/auth/google/session', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    }),
  
  googleLogout: () =>
    fetchApi<{ message: string }>('/auth/google/logout', {
      method: 'POST',
    }),
};

// ==================== AI FEATURES API ====================

export const aiApi = {
  getSchedulingSuggestions: (data: { jobs?: any[]; technicians?: any[]; new_job?: any }) =>
    fetchApi<{ suggestions: string; ai_model: string }>('/ai/scheduling-suggestions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  generateJobSummary: (data: { job_id?: string; job_type?: string; title?: string; description?: string; notes?: string; customer_name?: string; address?: string; equipment_used?: string }) =>
    fetchApi<{ summary: string; ai_model: string }>('/ai/job-summary', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getPredictiveMaintenance: (data: { equipment?: any; service_history?: any[] }) =>
    fetchApi<{ predictions: string; ai_model: string }>('/ai/predictive-maintenance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ==================== IMPORT WIZARD API ====================

export interface ImportValidation {
  total_records: number;
  valid_records: number;
  invalid_records: number;
  errors: { row: number; errors: string[] }[];
  warnings: { row: number; warnings: string[] }[];
  can_import: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  error_details: { row: number; error: string }[];
  message: string;
}

export interface ImportTemplate {
  columns: string[];
  sample_row: string[];
}

export const importApi = {
  validate: (data: { type: string; records: any[] }) =>
    fetchApi<ImportValidation>('/import/validate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  process: (data: { type: string; records: any[]; skip_duplicates?: boolean }) =>
    fetchApi<ImportResult>('/import/process', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getTemplate: (importType: string) =>
    fetchApi<ImportTemplate>(`/import/templates/${importType}`),
};

// ==================== REPORTS API ====================

export interface ReportSummary {
  jobs: { total: number; completed: number; completion_rate: number };
  revenue: { total: number; invoice_count: number };
  leads: { total: number; won: number; conversion_rate: number };
  technicians: { total: number };
}

export interface ReportQueryParams {
  data_source: string;
  columns: string[];
  filters?: { field: string; operator: string; value: string }[];
  group_by?: string;
  sort_by?: string;
  sort_order?: string;
  date_range?: { start: string; end: string };
}

export interface ReportQueryResult {
  data_source: string;
  results: any[];
  aggregations?: Record<string, number>;
  total_count: number;
}

export const reportsApi = {
  getSummary: () => fetchApi<ReportSummary>('/reports/summary'),
  
  query: (data: ReportQueryParams) =>
    fetchApi<ReportQueryResult>('/reports/query', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ==================== STRIPE PAYMENTS API ====================

export interface CheckoutSession {
  checkout_url: string;
  session_id: string;
}

export interface CheckoutStatus {
  status: string;
  payment_status: string;
  amount_total: number;
  currency: string;
  metadata: Record<string, string>;
}

export const stripePaymentsApi = {
  createCheckoutSession: (invoiceId: string) =>
    fetchApi<CheckoutSession>('/payments/checkout/create', {
      method: 'POST',
      body: JSON.stringify({
        invoice_id: invoiceId,
        origin_url: window.location.origin,
      }),
    }),
  
  getCheckoutStatus: (sessionId: string) =>
    fetchApi<CheckoutStatus>(`/payments/checkout/status/${sessionId}`),
};


// ==================== MILESTONE TEMPLATES API ====================

export interface MilestoneTemplate {
  id: string;
  name: string;
  description?: string;
  milestones: {
    id: string;
    name: string;
    percentage: number;
    description?: string;
    trigger: string;
    trigger_phase_id?: string;
  }[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectBillingMilestone {
  id: string;
  template_milestone_id?: string;
  name: string;
  percentage: number;
  amount: number;
  description?: string;
  status: 'pending' | 'ready_to_bill' | 'invoiced' | 'paid';
  invoice_id?: string;
  invoiced_at?: string;
  paid_at?: string;
  trigger: string;
  triggered_at?: string;
}

export const milestoneTemplatesApi = {
  getAll: (activeOnly: boolean = true) =>
    fetchApi<MilestoneTemplate[]>(`/milestone-templates?active_only=${activeOnly}`),
  
  get: (id: string) =>
    fetchApi<MilestoneTemplate>(`/milestone-templates/${id}`),
  
  create: (data: Partial<MilestoneTemplate>) =>
    fetchApi<MilestoneTemplate>('/milestone-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<MilestoneTemplate>) =>
    fetchApi<MilestoneTemplate>(`/milestone-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) =>
    fetchApi<{ message: string }>(`/milestone-templates/${id}`, {
      method: 'DELETE',
    }),
};

export const projectBillingApi = {
  applyTemplate: (projectId: string, templateId: string) =>
    fetchApi<{ message: string; milestones: ProjectBillingMilestone[] }>(
      `/projects/${projectId}/apply-template/${templateId}`,
      { method: 'POST' }
    ),
  
  updateMilestone: (projectId: string, milestoneId: string, data: any) =>
    fetchApi<{ message: string; milestone: ProjectBillingMilestone }>(
      `/projects/${projectId}/milestones/${milestoneId}`,
      { method: 'PUT', body: JSON.stringify(data) }
    ),
  
  invoiceMilestone: (projectId: string, milestoneId: string) =>
    fetchApi<{ message: string; invoice: any }>(
      `/projects/${projectId}/milestones/${milestoneId}/invoice`,
      { method: 'POST' }
    ),
};

// ==================== RESCHEDULE REQUESTS API ====================

export interface RescheduleRequest {
  id: string;
  request_number: string;
  job_id: string;
  job_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  original_date: string;
  original_time?: string;
  requested_date: string;
  requested_time_preference?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_date?: string;
  approved_time?: string;
  rejection_reason?: string;
  processed_by_id?: string;
  processed_at?: string;
  created_at: string;
}

export const rescheduleRequestsApi = {
  getAll: (status?: string) =>
    fetchApi<RescheduleRequest[]>(
      `/reschedule-requests${status ? `?status=${status}` : ''}`
    ),
  
  create: (data: {
    job_id: string;
    customer_id?: string;
    customer_email?: string;
    requested_date: string;
    requested_time_preference?: string;
    reason?: string;
  }) =>
    fetchApi<RescheduleRequest>('/reschedule-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  approve: (id: string, data: { approved_date?: string; approved_time?: string }) =>
    fetchApi<{ message: string; new_date: string; new_time?: string }>(
      `/reschedule-requests/${id}/approve`,
      { method: 'PUT', body: JSON.stringify(data) }
    ),
  
  reject: (id: string, reason?: string) =>
    fetchApi<{ message: string }>(
      `/reschedule-requests/${id}/reject`,
      { method: 'PUT', body: JSON.stringify({ reason }) }
    ),
  
  getByCustomer: (customerId: string) =>
    fetchApi<RescheduleRequest[]>(`/customer/${customerId}/reschedule-requests`),
};

// ==================== SUPPORT REQUESTS API ====================

export interface SupportRequest {
  id: string;
  request_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  request_type: string;
  subject: string;
  description: string;
  service_address?: string;
  equipment_id?: string;
  equipment_type?: string;
  priority: string;
  status: string;
  assigned_to_id?: string;
  job_id?: string;
  response_notes?: string;
  created_at: string;
}

export const supportRequestsApi = {
  getAll: (status?: string) =>
    fetchApi<SupportRequest[]>(
      `/support-requests${status ? `?status=${status}` : ''}`
    ),
  
  create: (customerId: string, data: {
    request_type?: string;
    subject: string;
    description: string;
    service_address?: string;
    equipment_id?: string;
    priority?: string;
  }) =>
    fetchApi<SupportRequest>(`/customer/${customerId}/support-request`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: any) =>
    fetchApi<{ message: string }>(`/support-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ==================== CUSTOMER PORTAL API ====================

export interface CustomerAccount {
  id: string;
  email: string;
  name: string;
  phone?: string;
  addresses: { address: string; is_primary: boolean }[];
  email_verified: boolean;
  last_login?: string;
  notification_preferences: {
    email_reminders: boolean;
    sms_reminders: boolean;
    marketing: boolean;
  };
  status: string;
}

// ==================== JOB CHAT API ====================

export type ChatChannel = 'internal' | 'customer';

export interface ChatMessage {
  id: string;
  job_id: string;
  channel: ChatChannel;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  sender_avatar_url?: string;
  message_type: 'text' | 'image' | 'system';
  content: string;
  image_url?: string;
  is_read: boolean;
  read_by: string[];
  created_at: string;
}

export interface ChatThread {
  id: string;
  job_id: string;
  channel: ChatChannel;
  participants: { user_id: string; name: string; role: string; joined_at: string }[];
  message_count: number;
  last_message_at?: string;
  last_message_preview?: string;
  is_active: boolean;
  created_at: string;
}

export interface UnreadCounts {
  [jobId: string]: {
    internal: number;
    customer: number;
  };
}

export const chatApi = {
  // Get messages for a job's channel
  getMessages: (jobId: string, channel: ChatChannel, limit: number = 50, before?: string) => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (before) params.append('before', before);
    return fetchApi<ChatMessage[]>(`/jobs/${jobId}/chat/${channel}/messages?${params.toString()}`);
  },
  
  // Get threads for a job
  getThreads: (jobId: string) =>
    fetchApi<ChatThread[]>(`/jobs/${jobId}/chat/threads`),
  
  // Post a message (REST fallback)
  postMessage: (jobId: string, channel: ChatChannel, content: string) =>
    fetchApi<ChatMessage>(`/jobs/${jobId}/chat/${channel}/message`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  
  // Get unread counts for current user
  getUnreadCounts: () =>
    fetchApi<UnreadCounts>('/chat/unread-counts'),
  
  // Create a WebSocket connection to chat
  createWebSocket: (jobId: string, channel: ChatChannel): WebSocket => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('auth_token') || '';
    // Use the same host as the API base URL but replace /api prefix
    const wsBase = API_BASE_URL.replace('https://', '').replace('http://', '');
    return new WebSocket(`${wsProtocol}//${wsBase}/ws/chat/${jobId}/${channel}?token=${token}`);
  },
};


// ==================== AI CONFIG API ====================

export interface AIConfig {
  primary_provider: 'gemini' | 'openai' | 'claude';
  primary_model: string;
  failover_providers: Array<{ provider: string; model: string }>;
  failover_enabled: boolean;
  fallback_to_simple: boolean;
  max_retries: number;
  total_requests: number;
  failed_requests: number;
  failover_count: number;
  last_failure_at?: string;
}

export const aiConfigApi = {
  getConfig: () => fetchApi<AIConfig>('/ai/config'),
  
  updateConfig: (data: Partial<AIConfig>) =>
    fetchApi<{ message: string }>('/ai/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ==================== QUICKBOOKS API ====================

export interface QuickBooksStatus {
  enabled: boolean;
  configured: boolean;
  connected: boolean;
  last_sync?: string;
  sync_settings: {
    invoices: boolean;
    payments: boolean;
    customers: boolean;
  };
}

export interface QuickBooksSyncLog {
  id: string;
  sync_type: 'invoice' | 'payment' | 'customer' | 'full';
  direction: 'push' | 'pull' | 'bidirectional';
  status: 'started' | 'completed' | 'failed' | 'partial';
  items_synced: number;
  items_failed: number;
  errors: string[];
  started_at: string;
  completed_at?: string;
}

export const quickbooksApi = {
  getStatus: () => fetchApi<QuickBooksStatus>('/integrations/quickbooks/status'),
  
  updateSettings: (data: Partial<QuickBooksStatus['sync_settings'] & { quickbooks_enabled: boolean }>) =>
    fetchApi<{ message: string }>('/integrations/quickbooks/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  getAuthUrl: () => fetchApi<{ auth_url: string }>('/integrations/quickbooks/auth-url'),
  
  disconnect: () =>
    fetchApi<{ message: string }>('/integrations/quickbooks/disconnect', {
      method: 'POST',
    }),
  
  triggerSync: (data: { sync_type: string }) =>
    fetchApi<{ message: string; sync_id: string }>('/integrations/quickbooks/sync', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getSyncLogs: (limit: number = 10) =>
    fetchApi<QuickBooksSyncLog[]>(`/integrations/quickbooks/sync-logs?limit=${limit}`),
};

// ==================== PUSH NOTIFICATIONS API ====================

export interface PushSubscriptionInfo {
  id: string;
  device_type: string;
  is_active: boolean;
  created_at: string;
}

export const pushApi = {
  getVapidKey: () => fetchApi<{ publicKey: string }>('/push/vapid-key'),
  
  subscribe: (subscription: PushSubscriptionJSON) =>
    fetchApi<{ message: string; id: string }>('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
    }),
  
  unsubscribe: (endpoint: string) =>
    fetchApi<{ message: string }>('/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    }),
  
  getSubscriptions: () =>
    fetchApi<PushSubscriptionInfo[]>('/push/subscriptions'),
};
