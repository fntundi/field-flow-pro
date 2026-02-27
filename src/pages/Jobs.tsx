import { motion } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const allJobs = [
  { id: "JOB-1042", customer: "Sarah Mitchell", address: "1423 Oak Ave, Dallas, TX", type: "Residential Install", tech: "Mike Johnson", status: "in_progress" as const, scheduled: "Feb 27, 2:30 PM", priority: "Normal" },
  { id: "JOB-1041", customer: "Acme Corp", address: "500 Commerce St, Dallas, TX", type: "Commercial Repair", tech: "Lisa Chen", status: "complete" as const, scheduled: "Feb 27, 11:00 AM", priority: "High" },
  { id: "JOB-1040", customer: "James Rivera", address: "812 Elm St, Plano, TX", type: "Maintenance", tech: "Tom Brown", status: "urgent" as const, scheduled: "Feb 27, 9:15 AM", priority: "Urgent" },
  { id: "JOB-1039", customer: "Metro Office Park", address: "2100 N Central Expy, Richardson, TX", type: "Commercial Install", tech: "Amy Davis", status: "open" as const, scheduled: "Feb 28, 8:00 AM", priority: "Normal" },
  { id: "JOB-1038", customer: "David Park", address: "3301 Mockingbird Ln, Dallas, TX", type: "Residential Repair", tech: "Mike Johnson", status: "complete" as const, scheduled: "Feb 26, 3:00 PM", priority: "Normal" },
  { id: "JOB-1037", customer: "Linda Hayes", address: "905 Preston Rd, Frisco, TX", type: "Residential Install", tech: "Lisa Chen", status: "complete" as const, scheduled: "Feb 26, 10:00 AM", priority: "Normal" },
  { id: "JOB-1036", customer: "TechHub Offices", address: "4400 Beltline Rd, Addison, TX", type: "Commercial Maintenance", tech: "Tom Brown", status: "pending" as const, scheduled: "Feb 28, 1:00 PM", priority: "Low" },
  { id: "JOB-1035", customer: "Maria Santos", address: "667 Greenville Ave, Dallas, TX", type: "Emergency Repair", tech: "Amy Davis", status: "complete" as const, scheduled: "Feb 25, 7:30 PM", priority: "Urgent" },
];

const Jobs = () => {
  const [search, setSearch] = useState("");
  const filtered = allJobs.filter(
    (j) =>
      j.customer.toLowerCase().includes(search.toLowerCase()) ||
      j.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="page-subtitle">Manage all service jobs and work orders</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" />
          New Job
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="w-4 h-4 mr-2" /> Filters
        </Button>
      </div>

      {/* Jobs Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="metric-card !p-0 overflow-hidden"
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Customer</th>
              <th>Address</th>
              <th>Type</th>
              <th>Technician</th>
              <th>Scheduled</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((job) => (
              <tr key={job.id} className="cursor-pointer">
                <td className="font-mono text-xs font-medium">{job.id}</td>
                <td className="font-medium">{job.customer}</td>
                <td className="text-muted-foreground text-xs">{job.address}</td>
                <td className="text-muted-foreground">{job.type}</td>
                <td>{job.tech}</td>
                <td className="text-muted-foreground text-xs">{job.scheduled}</td>
                <td>
                  <span className={`text-xs font-medium ${
                    job.priority === "Urgent" ? "text-destructive" :
                    job.priority === "High" ? "text-warning" : "text-muted-foreground"
                  }`}>{job.priority}</span>
                </td>
                <td><StatusBadge status={job.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default Jobs;
