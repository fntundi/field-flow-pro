import { motion, AnimatePresence } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, ChevronDown, ChevronRight, Phone, Wrench, ClipboardList, Calendar, MapPin, User, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

type CallType = "tech" | "sales";
type CallStatus = "scheduled" | "in_progress" | "complete" | "cancelled";

interface Call {
  id: string;
  type: CallType;
  assignee: string;
  scheduledDate: string;
  duration: string;
  status: CallStatus;
  summary: string;
  discoveryNotes?: string;
}

interface Job {
  id: string;
  customer: string;
  customerId: string;
  site: string;
  siteAddress: string;
  type: string;
  status: "open" | "in_progress" | "complete" | "urgent" | "pending";
  priority: string;
  created: string;
  estimatedDays: number;
  calls: Call[];
}

const allJobs: Job[] = [
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

const callStatusMap: Record<CallStatus, { status: "open" | "in_progress" | "complete" | "cancelled"; label: string }> = {
  scheduled: { status: "open", label: "Scheduled" },
  in_progress: { status: "in_progress", label: "In Progress" },
  complete: { status: "complete", label: "Complete" },
  cancelled: { status: "cancelled", label: "Cancelled" },
};

const Jobs = () => {
  const [search, setSearch] = useState("");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "tech" | "sales">("all");

  const filtered = allJobs.filter(
    (j) =>
      j.customer.toLowerCase().includes(search.toLowerCase()) ||
      j.id.toLowerCase().includes(search.toLowerCase()) ||
      j.site.toLowerCase().includes(search.toLowerCase())
  );

  const getFilteredCalls = (calls: Call[]) => {
    if (filterType === "all") return calls;
    return calls.filter((c) => c.type === filterType);
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

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs, customers, sites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(["all", "tech", "sales"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterType === t
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
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

      {/* Jobs List */}
      <div className="space-y-3">
        {filtered.map((job) => {
          const isExpanded = expandedJob === job.id;
          const visibleCalls = getFilteredCalls(job.calls);
          const completedCalls = job.calls.filter((c) => c.status === "complete").length;

          return (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="metric-card !p-0 overflow-hidden"
            >
              {/* Job Header Row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedJob(isExpanded ? null : job.id)}
              >
                <button className="text-muted-foreground">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xs font-medium text-foreground">{job.id}</span>
                    <span className="text-sm font-semibold text-foreground">{job.customer}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3" />{job.site}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-muted-foreground">{job.type}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{job.siteAddress}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden md:block">
                    <p className="text-xs text-muted-foreground">{completedCalls}/{job.calls.length} calls</p>
                    <p className="text-xs text-muted-foreground">{job.estimatedDays} day{job.estimatedDays > 1 ? "s" : ""}</p>
                  </div>
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
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border bg-muted/20 px-5 py-3">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                          Calls / Visits ({visibleCalls.length})
                        </h4>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          <Plus className="w-3 h-3 mr-1" /> Add Call
                        </Button>
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
                                      call.type === "tech"
                                        ? "bg-info/10 text-info"
                                        : "bg-accent/10 text-accent"
                                    }`}>
                                      {call.type === "tech" ? <Wrench className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs text-muted-foreground">{call.id}</span>
                                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                          call.type === "tech"
                                            ? "bg-info/10 text-info"
                                            : "bg-accent/10 text-accent"
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
