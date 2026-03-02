import { motion, AnimatePresence } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, ChevronDown, ChevronRight, Phone, Wrench, ClipboardList, Calendar, MapPin, User, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "tech" | "sales">("all");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [customerFilter, setCustomerFilter] = useState<string | null>(null);

  useEffect(() => {
    const status = searchParams.get("status");
    const customer = searchParams.get("customer");
    if (status) setStatusFilter(status);
    if (customer) setCustomerFilter(customer);
  }, [searchParams]);

  const filtered = allJobs.filter((j) => {
    const matchSearch = j.customer.toLowerCase().includes(search.toLowerCase()) ||
      j.id.toLowerCase().includes(search.toLowerCase()) ||
      j.site.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || j.status === statusFilter ||
      (statusFilter === "active" && (j.status === "open" || j.status === "in_progress" || j.status === "urgent"));
    const matchCustomer = !customerFilter || j.customerId === customerFilter;
    return matchSearch && matchStatus && matchCustomer;
  });

  const getFilteredCalls = (calls: Call[]) => {
    if (filterType === "all") return calls;
    return calls.filter((c) => c.type === filterType);
  };

  const clearFilters = () => {
    setStatusFilter(null);
    setCustomerFilter(null);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="page-subtitle">Manage jobs, calls, and multi-day work orders</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" />
          New Job
        </Button>
      </div>

      {/* Active Filters */}
      {(statusFilter || customerFilter) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filters:</span>
          {statusFilter && (
            <span className="status-badge status-progress text-xs">Status: {statusFilter}</span>
          )}
          {customerFilter && (
            <span className="status-badge status-open text-xs">Customer: {customerFilter}</span>
          )}
          <button onClick={clearFilters} className="text-xs text-accent hover:underline ml-1">Clear all</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search jobs, customers, sites..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(["all", "tech", "sales"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterType === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "All Calls" : t === "tech" ? "Tech Calls" : "Sales Calls"}
            </button>
          ))}
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
              <tr
                key={job.id}
                className="cursor-pointer"
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
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
                  <StatusBadge status={job.status} />
                </div>
              </div>

              {/* Expanded Calls */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="border-t border-border bg-muted/20 px-5 py-3">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                          Calls / Visits ({visibleCalls.length})
                        </h4>
                        <div className="flex items-center gap-2">
                          <Link to={`/jobs/${job.id}`} className="text-xs text-accent hover:underline">Full Detail →</Link>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <Plus className="w-3 h-3 mr-1" /> Add Call
                          </Button>
                        </div>
                      </div>
                      {visibleCalls.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">No {filterType} calls for this job</p>
                      ) : (
                        <div className="space-y-2">
                          {visibleCalls.map((call) => {
                            const cStatus = callStatusMap[call.status];
                            return (
                              <div key={call.id} className="bg-card rounded-lg border border-border p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                      call.type === "tech" ? "bg-info/10 text-info" : "bg-accent/10 text-accent"
                                    }`}>
                                      {call.type === "tech" ? <Wrench className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs text-muted-foreground">{call.id}</span>
                                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                          call.type === "tech" ? "bg-info/10 text-info" : "bg-accent/10 text-accent"
                                        }`}>
                                          {call.type === "tech" ? "Technician" : "Sales"}
                                        </span>
                                      </div>
                                      <p className="text-sm font-medium text-foreground mt-1">{call.summary}</p>
                                      {call.discoveryNotes && (
                                        <div className="mt-2 px-3 py-2 bg-muted rounded-md border border-border/50">
                                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Discovery Notes</p>
                                          <p className="text-xs text-foreground">{call.discoveryNotes}</p>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{call.assignee}</span>
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{call.scheduledDate}</span>
                                        {call.duration !== "—" && <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3" />{call.duration}</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <StatusBadge status={cStatus.status} label={cStatus.label} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Jobs;
