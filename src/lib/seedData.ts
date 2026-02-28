import { supabase } from './supabase';

export async function seedDatabase() {
  try {
    const customerData = [
      {
        customer_number: 'CUST-1001',
        name: 'Sarah Mitchell',
        type: 'residential',
        email: 'sarah.m@email.com',
        phone: '(214) 555-0142',
        address: '1423 Oak Ave',
        city: 'Dallas',
        state: 'TX',
        zip: '75201',
      },
      {
        customer_number: 'CUST-1002',
        name: 'Acme Corp',
        type: 'commercial',
        email: 'facilities@acme.com',
        phone: '(972) 555-0198',
        address: '500 Commerce St',
        city: 'Dallas',
        state: 'TX',
        zip: '75202',
      },
      {
        customer_number: 'CUST-1003',
        name: 'James Rivera',
        type: 'residential',
        email: 'j.rivera@email.com',
        phone: '(469) 555-0231',
        address: '812 Elm St',
        city: 'Plano',
        state: 'TX',
        zip: '75074',
      },
    ];

    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .insert(customerData)
      .select();

    if (customerError) throw customerError;

    if (customers) {
      const siteData = customers.map((customer) => ({
        customer_id: customer.id,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        site_name: customer.type === 'commercial' ? 'Main Office' : null,
      }));

      const { data: sites, error: siteError } = await supabase
        .from('sites')
        .insert(siteData)
        .select();

      if (siteError) throw siteError;

      if (sites) {
        const equipmentData = [
          {
            site_id: sites[0].id,
            equipment_type: 'Air Conditioner',
            manufacturer: 'Trane',
            model_number: 'XR15-036',
            serial_number: 'TRN12345678',
            capacity: '3-ton',
            installation_date: '2023-05-15',
            warranty_expiration: '2033-05-15',
          },
          {
            site_id: sites[1].id,
            equipment_type: 'Commercial RTU',
            manufacturer: 'Carrier',
            model_number: '50XC-150',
            serial_number: 'CAR87654321',
            capacity: '15-ton',
            installation_date: '2022-08-20',
            warranty_expiration: '2032-08-20',
          },
        ];

        const { error: equipmentError } = await supabase
          .from('equipment')
          .insert(equipmentData);

        if (equipmentError) throw equipmentError;

        const jobData = [
          {
            job_number: 'JOB-1042',
            customer_id: customers[0].id,
            site_id: sites[0].id,
            job_type: 'Residential Install',
            title: 'AC Unit Installation',
            description: 'Install new 3-ton Trane AC unit',
            status: 'in_progress',
            priority: 'normal',
            scheduled_date: '2026-02-27T14:30:00Z',
            estimated_hours: 6,
          },
          {
            job_number: 'JOB-1041',
            customer_id: customers[1].id,
            site_id: sites[1].id,
            job_type: 'Commercial Repair',
            title: 'RTU Compressor Repair',
            description: 'Diagnose and repair commercial RTU compressor issue',
            status: 'complete',
            priority: 'high',
            scheduled_date: '2026-02-27T11:00:00Z',
            completed_date: '2026-02-27T15:30:00Z',
            estimated_hours: 4,
            actual_hours: 4.5,
          },
          {
            job_number: 'JOB-1040',
            customer_id: customers[2].id,
            site_id: sites[2].id,
            job_type: 'Maintenance',
            title: 'Quarterly HVAC Maintenance',
            description: 'Routine maintenance and filter replacement',
            status: 'urgent',
            priority: 'urgent',
            scheduled_date: '2026-02-27T09:15:00Z',
            estimated_hours: 2,
          },
        ];

        const { data: jobs, error: jobError } = await supabase
          .from('jobs')
          .insert(jobData)
          .select();

        if (jobError) throw jobError;

        if (jobs) {
          const callData = [
            {
              job_id: jobs[0].id,
              call_type: 'initial',
              caller_name: 'Sarah Mitchell',
              caller_phone: '(214) 555-0142',
              issue_description: 'AC not cooling, requesting installation quote',
              notes: 'Customer interested in high-efficiency unit',
              call_date: '2026-02-20T10:30:00Z',
            },
            {
              job_id: jobs[1].id,
              call_type: 'emergency',
              caller_name: 'John from Acme',
              caller_phone: '(972) 555-0198',
              issue_description: 'Commercial unit down, office too hot',
              notes: 'Priority customer, dispatch immediately',
              call_date: '2026-02-27T08:45:00Z',
            },
          ];

          const { error: callError } = await supabase
            .from('job_calls')
            .insert(callData);

          if (callError) throw callError;

          const visitData = [
            {
              job_id: jobs[1].id,
              visit_date: '2026-02-27T11:00:00Z',
              arrival_time: '2026-02-27T11:15:00Z',
              departure_time: '2026-02-27T15:30:00Z',
              work_performed: 'Diagnosed compressor failure. Replaced compressor, recharged system, tested all functions.',
              findings: 'Compressor failed due to electrical surge. Recommended surge protection.',
              parts_used: [
                { part: 'Compressor', qty: 1, cost: 850 },
                { part: 'R-410A Refrigerant', qty: 15, cost: 180 },
              ],
            },
          ];

          const { error: visitError } = await supabase
            .from('job_visits')
            .insert(visitData);

          if (visitError) throw visitError;
        }
      }
    }

    console.log('Database seeded successfully!');
    return { success: true };
  } catch (error) {
    console.error('Error seeding database:', error);
    return { success: false, error };
  }
}
