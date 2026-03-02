import { Job } from "@/types/jobs";

export const allJobs: Job[] = [
  {
    id: "JOB-1042", customer: "Sarah Mitchell", customerId: "CUST-1001",
    site: "Primary Residence", siteAddress: "1423 Oak Ave, Dallas, TX",
    type: "Residential Repair", status: "in_progress", priority: "Normal", created: "Feb 25, 2026", estimatedDays: 2,
    calls: [
      { id: "CALL-2080", type: "tech", assignee: "Mike Johnson", scheduledDate: "Feb 27, 2:30 PM", duration: "1.5 hrs", status: "in_progress", summary: "Troubleshoot A/C not cooling — compressor check", discoveryNotes: "Compressor cycling on high-pressure cutout. Suspected TXV restriction." },
      { id: "CALL-2081", type: "sales", assignee: "Rachel Kim", scheduledDate: "Feb 28, 10:00 AM", status: "scheduled", duration: "—", summary: "Present repair vs. replacement options to customer" },
    ],
  },
  {
    id: "JOB-1041", customer: "Acme Corp", customerId: "CUST-1002",
    site: "Main Office", siteAddress: "500 Commerce St, Dallas, TX",
    type: "Commercial Repair", status: "complete", priority: "High", created: "Feb 24, 2026", estimatedDays: 1,
    calls: [
      { id: "CALL-2078", type: "tech", assignee: "Lisa Chen", scheduledDate: "Feb 27, 11:00 AM", duration: "2 hrs", status: "complete", summary: "RTU #3 economizer actuator replacement" },
    ],
  },
  {
    id: "JOB-1040", customer: "James Rivera", customerId: "CUST-1003",
    site: "Home", siteAddress: "812 Elm St, Plano, TX",
    type: "Emergency Repair", status: "urgent", priority: "Urgent", created: "Feb 27, 2026", estimatedDays: 1,
    calls: [
      { id: "CALL-2079", type: "tech", assignee: "Tom Brown", scheduledDate: "Feb 27, 9:15 AM", duration: "3 hrs", status: "in_progress", summary: "No heat emergency — gas furnace diagnosis", discoveryNotes: "Flame sensor corroded. Ignitor weak. Recommend both replacements." },
      { id: "CALL-2082", type: "sales", assignee: "Rachel Kim", scheduledDate: "Feb 27, 4:00 PM", status: "scheduled", duration: "—", summary: "Quote for full furnace replacement (15+ year unit)" },
    ],
  },
  {
    id: "JOB-1039", customer: "Metro Office Park", customerId: "CUST-1004",
    site: "Building A", siteAddress: "2100 N Central Expy, Richardson, TX",
    type: "Commercial Install", status: "open", priority: "Normal", created: "Feb 26, 2026", estimatedDays: 5,
    calls: [
      { id: "CALL-2083", type: "tech", assignee: "Amy Davis", scheduledDate: "Feb 28, 8:00 AM", status: "scheduled", duration: "—", summary: "Day 1: Ductwork prep and old unit removal" },
      { id: "CALL-2084", type: "tech", assignee: "Amy Davis", scheduledDate: "Mar 1, 8:00 AM", status: "scheduled", duration: "—", summary: "Day 2: New RTU placement and refrigerant lines" },
      { id: "CALL-2085", type: "tech", assignee: "Mike Johnson", scheduledDate: "Mar 2, 8:00 AM", status: "scheduled", duration: "—", summary: "Day 3: Electrical, controls, and commissioning" },
    ],
  },
  {
    id: "JOB-1038", customer: "David Park", customerId: "CUST-1005",
    site: "Home", siteAddress: "3301 Mockingbird Ln, Dallas, TX",
    type: "Residential Repair", status: "complete", priority: "Normal", created: "Feb 24, 2026", estimatedDays: 1,
    calls: [
      { id: "CALL-2076", type: "tech", assignee: "Mike Johnson", scheduledDate: "Feb 26, 3:00 PM", duration: "1 hr", status: "complete", summary: "Thermostat wiring repair — zone 2" },
    ],
  },
  {
    id: "JOB-1037", customer: "Linda Hayes", customerId: "CUST-1006",
    site: "Primary Residence", siteAddress: "905 Preston Rd, Frisco, TX",
    type: "Residential Install", status: "complete", priority: "Normal", created: "Feb 22, 2026", estimatedDays: 3,
    calls: [
      { id: "CALL-2070", type: "sales", assignee: "Rachel Kim", scheduledDate: "Feb 22, 10:00 AM", duration: "45 min", status: "complete", summary: "Good/Better/Best presentation — 3-ton split system" },
      { id: "CALL-2071", type: "tech", assignee: "Lisa Chen", scheduledDate: "Feb 25, 8:00 AM", duration: "4 hrs", status: "complete", summary: "Day 1: Remove old system, prep pad and linesets" },
      { id: "CALL-2072", type: "tech", assignee: "Lisa Chen", scheduledDate: "Feb 26, 8:00 AM", duration: "5 hrs", status: "complete", summary: "Day 2: Install condenser, coil, and thermostat" },
    ],
  },
  {
    id: "JOB-1036", customer: "TechHub Offices", customerId: "CUST-1007",
    site: "Suite 200", siteAddress: "4400 Beltline Rd, Addison, TX",
    type: "Commercial Maintenance", status: "pending", priority: "Low", created: "Feb 26, 2026", estimatedDays: 1,
    calls: [
      { id: "CALL-2086", type: "tech", assignee: "Tom Brown", scheduledDate: "Feb 28, 1:00 PM", status: "scheduled", duration: "—", summary: "Quarterly PM — RTU inspection and filter change" },
    ],
  },
];
