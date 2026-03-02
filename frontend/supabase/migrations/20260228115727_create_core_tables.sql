/*
  # Create Core HVAC Business Tables

  ## New Tables
  
  ### 1. customers
    - `id` (uuid, primary key)
    - `customer_number` (text, unique) - Auto-generated customer ID
    - `name` (text) - Customer/Company name
    - `type` (text) - Residential or Commercial
    - `email` (text)
    - `phone` (text)
    - `address` (text)
    - `city` (text)
    - `state` (text)
    - `zip` (text)
    - `notes` (text)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### 2. sites
    - `id` (uuid, primary key)
    - `customer_id` (uuid, foreign key)
    - `site_name` (text) - Optional site name for multi-location customers
    - `address` (text)
    - `city` (text)
    - `state` (text)
    - `zip` (text)
    - `access_instructions` (text)
    - `gate_code` (text)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### 3. equipment
    - `id` (uuid, primary key)
    - `site_id` (uuid, foreign key)
    - `equipment_type` (text) - AC, Furnace, Heat Pump, etc.
    - `manufacturer` (text)
    - `model_number` (text)
    - `serial_number` (text)
    - `capacity` (text) - e.g., "3-ton", "5-ton"
    - `installation_date` (date)
    - `warranty_expiration` (date)
    - `notes` (text)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### 4. jobs
    - `id` (uuid, primary key)
    - `job_number` (text, unique) - Auto-generated job ID
    - `customer_id` (uuid, foreign key)
    - `site_id` (uuid, foreign key)
    - `job_type` (text) - Install, Repair, Maintenance, Emergency
    - `title` (text)
    - `description` (text)
    - `status` (text) - open, in_progress, complete, cancelled
    - `priority` (text) - normal, high, urgent
    - `scheduled_date` (timestamptz)
    - `completed_date` (timestamptz)
    - `assigned_tech_id` (uuid) - Will link to technicians table later
    - `estimated_hours` (numeric)
    - `actual_hours` (numeric)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### 5. job_calls
    - `id` (uuid, primary key)
    - `job_id` (uuid, foreign key)
    - `call_type` (text) - initial, follow_up, callback, emergency
    - `caller_name` (text)
    - `caller_phone` (text)
    - `issue_description` (text)
    - `notes` (text)
    - `call_date` (timestamptz)
    - `created_at` (timestamptz)

  ### 6. job_visits
    - `id` (uuid, primary key)
    - `job_id` (uuid, foreign key)
    - `tech_id` (uuid)
    - `visit_date` (timestamptz)
    - `arrival_time` (timestamptz)
    - `departure_time` (timestamptz)
    - `work_performed` (text)
    - `parts_used` (jsonb)
    - `findings` (text)
    - `photos` (jsonb) - Array of photo URLs
    - `customer_signature` (text)
    - `created_at` (timestamptz)

  ### 7. maintenance_schedules
    - `id` (uuid, primary key)
    - `customer_id` (uuid, foreign key)
    - `site_id` (uuid, foreign key)
    - `equipment_id` (uuid, foreign key)
    - `agreement_id` (text) - Links to service agreement
    - `frequency` (text) - monthly, quarterly, semi_annual, annual
    - `last_service_date` (date)
    - `next_service_date` (date)
    - `status` (text) - active, paused, expired
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### 8. sales_pipeline
    - `id` (uuid, primary key)
    - `lead_id` (text) - Links to leads table
    - `customer_id` (uuid, foreign key)
    - `opportunity_name` (text)
    - `stage` (text) - lead, qualified, proposal, negotiation, closed_won, closed_lost
    - `value` (numeric)
    - `probability` (integer) - 0-100%
    - `expected_close_date` (date)
    - `source` (text) - website, referral, google_ads, phone, etc.
    - `notes` (text)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage data
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_number text UNIQUE NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'residential',
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sites table
CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  site_name text,
  address text NOT NULL,
  city text,
  state text,
  zip text,
  access_instructions text,
  gate_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  equipment_type text NOT NULL,
  manufacturer text,
  model_number text,
  serial_number text,
  capacity text,
  installation_date date,
  warranty_expiration date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  scheduled_date timestamptz,
  completed_date timestamptz,
  assigned_tech_id uuid,
  estimated_hours numeric,
  actual_hours numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create job_calls table
CREATE TABLE IF NOT EXISTS job_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  call_type text NOT NULL,
  caller_name text,
  caller_phone text,
  issue_description text,
  notes text,
  call_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create job_visits table
CREATE TABLE IF NOT EXISTS job_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  tech_id uuid,
  visit_date timestamptz NOT NULL,
  arrival_time timestamptz,
  departure_time timestamptz,
  work_performed text,
  parts_used jsonb DEFAULT '[]'::jsonb,
  findings text,
  photos jsonb DEFAULT '[]'::jsonb,
  customer_signature text,
  created_at timestamptz DEFAULT now()
);

-- Create maintenance_schedules table
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  equipment_id uuid REFERENCES equipment(id) ON DELETE CASCADE,
  agreement_id text,
  frequency text NOT NULL,
  last_service_date date,
  next_service_date date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sales_pipeline table
CREATE TABLE IF NOT EXISTS sales_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  opportunity_name text NOT NULL,
  stage text NOT NULL DEFAULT 'lead',
  value numeric DEFAULT 0,
  probability integer DEFAULT 0,
  expected_close_date date,
  source text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sites_customer_id ON sites(customer_id);
CREATE INDEX IF NOT EXISTS idx_equipment_site_id ON equipment(site_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_site_id ON jobs(site_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_job_calls_job_id ON job_calls(job_id);
CREATE INDEX IF NOT EXISTS idx_job_visits_job_id ON job_visits(job_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_customer_id ON maintenance_schedules(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_pipeline_customer_id ON sales_pipeline(customer_id);

-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_pipeline ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for customers
CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS Policies for sites
CREATE POLICY "Authenticated users can view sites"
  ON sites FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sites"
  ON sites FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sites"
  ON sites FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete sites"
  ON sites FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS Policies for equipment
CREATE POLICY "Authenticated users can view equipment"
  ON equipment FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert equipment"
  ON equipment FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update equipment"
  ON equipment FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete equipment"
  ON equipment FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS Policies for jobs
CREATE POLICY "Authenticated users can view jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS Policies for job_calls
CREATE POLICY "Authenticated users can view job calls"
  ON job_calls FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert job calls"
  ON job_calls FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update job calls"
  ON job_calls FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete job calls"
  ON job_calls FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS Policies for job_visits
CREATE POLICY "Authenticated users can view job visits"
  ON job_visits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert job visits"
  ON job_visits FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update job visits"
  ON job_visits FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete job visits"
  ON job_visits FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS Policies for maintenance_schedules
CREATE POLICY "Authenticated users can view maintenance schedules"
  ON maintenance_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert maintenance schedules"
  ON maintenance_schedules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update maintenance schedules"
  ON maintenance_schedules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete maintenance schedules"
  ON maintenance_schedules FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS Policies for sales_pipeline
CREATE POLICY "Authenticated users can view sales pipeline"
  ON sales_pipeline FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sales pipeline"
  ON sales_pipeline FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales pipeline"
  ON sales_pipeline FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete sales pipeline"
  ON sales_pipeline FOR DELETE
  TO authenticated
  USING (true);