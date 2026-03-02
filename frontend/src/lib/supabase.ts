import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Customer = {
  id: string;
  customer_number: string;
  name: string;
  type: 'residential' | 'commercial';
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Site = {
  id: string;
  customer_id: string;
  site_name: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  access_instructions: string | null;
  gate_code: string | null;
  created_at: string;
  updated_at: string;
};

export type Equipment = {
  id: string;
  site_id: string;
  equipment_type: string;
  manufacturer: string | null;
  model_number: string | null;
  serial_number: string | null;
  capacity: string | null;
  installation_date: string | null;
  warranty_expiration: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Job = {
  id: string;
  job_number: string;
  customer_id: string;
  site_id: string;
  job_type: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'complete' | 'cancelled';
  priority: 'normal' | 'high' | 'urgent';
  scheduled_date: string | null;
  completed_date: string | null;
  assigned_tech_id: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  created_at: string;
  updated_at: string;
};

export type JobCall = {
  id: string;
  job_id: string;
  call_type: 'initial' | 'follow_up' | 'callback' | 'emergency';
  caller_name: string | null;
  caller_phone: string | null;
  issue_description: string | null;
  notes: string | null;
  call_date: string;
  created_at: string;
};

export type JobVisit = {
  id: string;
  job_id: string;
  tech_id: string | null;
  visit_date: string;
  arrival_time: string | null;
  departure_time: string | null;
  work_performed: string | null;
  parts_used: any[];
  findings: string | null;
  photos: string[];
  customer_signature: string | null;
  created_at: string;
};

export type MaintenanceSchedule = {
  id: string;
  customer_id: string;
  site_id: string;
  equipment_id: string | null;
  agreement_id: string | null;
  frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  last_service_date: string | null;
  next_service_date: string | null;
  status: 'active' | 'paused' | 'expired';
  created_at: string;
  updated_at: string;
};

export type SalesPipeline = {
  id: string;
  lead_id: string | null;
  customer_id: string | null;
  opportunity_name: string;
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  value: number;
  probability: number;
  expected_close_date: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
