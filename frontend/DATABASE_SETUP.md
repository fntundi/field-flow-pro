# Database Setup Guide

This application uses Supabase for data persistence. Follow these steps to set up your database:

## 1. Environment Variables

Create a `.env` file in the project root with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project settings under API.

## 2. Database Schema

The database migration has already been applied with the following tables:

### Core Tables
- `customers` - Customer/company information
- `sites` - Service location details for each customer
- `equipment` - HVAC equipment installed at each site
- `jobs` - Service jobs and work orders
- `job_calls` - Phone calls related to jobs
- `job_visits` - Technician visit records
- `maintenance_schedules` - Recurring maintenance agreements
- `sales_pipeline` - Sales opportunities and leads

### Features
- All tables have Row Level Security (RLS) enabled
- Authenticated users can perform all CRUD operations
- Foreign key relationships maintain data integrity
- Indexes optimize common queries

## 3. Seed Sample Data (Optional)

To populate the database with sample data for testing:

1. Open your browser console
2. Run the following code:

```javascript
import { seedDatabase } from './src/lib/seedData';
await seedDatabase();
```

Or add a seed button temporarily to any component:

```tsx
import { seedDatabase } from '@/lib/seedData';

// In your component
<Button onClick={async () => {
  const result = await seedDatabase();
  if (result.success) {
    alert('Database seeded successfully!');
  }
}}>
  Seed Database
</Button>
```

## 4. Database Structure

### Customers → Sites → Equipment
- Each customer can have multiple sites
- Each site can have multiple pieces of equipment
- Equipment tracks warranty, installation dates, and specifications

### Jobs → Calls & Visits
- Each job is linked to a customer and site
- Jobs can have multiple phone calls (initial contact, follow-ups)
- Jobs can have multiple technician visits with detailed work logs

### Key Job Fields
- `job_number`: Unique identifier (e.g., JOB-1042)
- `status`: open, in_progress, complete, cancelled
- `priority`: normal, high, urgent
- `job_type`: Install, Repair, Maintenance, Emergency

## 5. Job Detail View Features

The job detail page (`/jobs/:id`) displays:

1. **Overview Tab**
   - Job description
   - Site address
   - Estimated vs actual hours

2. **Timeline Tab**
   - Chronological list of all calls and visits
   - Call details (caller, issue description, notes)
   - Visit details (arrival/departure times, work performed, findings)

3. **Site Details Tab**
   - Complete location information
   - Access instructions
   - Gate codes

4. **Equipment Tab**
   - All equipment at the service site
   - Manufacturer, model, serial numbers
   - Installation and warranty dates

## 6. Security Notes

- All data requires authentication
- RLS policies prevent unauthorized access
- User authentication should be added for production use
- API keys should never be committed to version control
