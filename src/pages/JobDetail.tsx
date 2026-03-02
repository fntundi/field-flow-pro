import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { allJobs } from "@/data/jobs";
import { callStatusMap } from "@/types/jobs";
import {
  ArrowLeft, MapPin, User, Calendar, Clock, Wrench, Phone,
  ClipboardList, Building2, ChevronRight, FileText, DollarSign,
  Package
} from "lucide-react";

const equipmentByCustomer: Record<string, { name: string; installed: string; lastService: string }[]> = {
  "CUST-1001": [
    { name: "Trane XR15 (3-ton)", installed: "Jun 2021", lastService: "Feb 27, 2026" },
    { name: "Honeywell T6 Thermostat", installed: "Jun 2021", lastService: "Feb 27, 2026" },
  ],
  "CUST-1002": [
    { name: "Carrier 50XC (15-ton)", installed: "Mar 2019", lastService: "Feb 27, 2026" },
    { name: "Carrier 50XC (10-ton)", installed: "Mar 2019", lastService: "Feb 20, 2026" },
  ],
  "CUST-1003": [{ name: "Rheem RA20 (3-ton)", installed: "Aug 2020", lastService: "Feb 27, 2026" }],
  "CUST-1004": [
    { name: "Lennox XC25 (5-ton)", installed: "Jan 2022", lastService: "Feb 25, 2026" },
    { name: "York YC2F (10-ton)", installed: "Jan 2022", lastService: "Feb 18, 2026" },
  ],
  "CUST-1005": [{ name: "Carrier Infinity (3.5-ton)", installed: "Apr 2023", lastService: "Feb 26, 2026" }],
  "CUST-1006": [{ name: "Goodman GSX16 (2.5-ton)", installed: "Feb 2026", lastService: "Feb 26, 2026" }],
  "CUST-1007": [{ name: "York YC2F (10-ton)", installed: "May 2020", lastService: "Feb 24, 2026" }],
};

const JobDetail = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const job = allJobs.find((j) => j.id === jobId);

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold text-foreground mb-2">Job Not Found</h2>
        <p className="text-sm text-muted-foreground mb-4">No job with ID "{jobId}" exists.</p>
        <Link to="/jobs">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Back to Jobs</Button>
        </Link>
      </div>
    );
  }

  const equipment = equipmentByCustomer[job.customerId] || [];
  const completedCalls = job.calls.filter((c) => c.status === "complete").length;
  const totalHours = job.calls
    .filter((c) => c.duration !== "—")
    .reduce((sum, c) => {
      const match = c.duration.match(/([\d.]+)/);
      return sum + (match ? parseFloat(match[1]) : 0);
    }, 0);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/jobs" className="hover:text-foreground transition-colors">Jobs</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">{job.id}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="page-title">{job.id}</h1>
            <StatusBadge status={job.status} />
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
              job.priority === "Urgent" ? "bg-destructive/10 text-destructive" :
              job.priority === "High" ? "bg-warning/10 text-warning" :
              "bg-muted text-muted-foreground"
            }`}>{job.priority}</span>
          </div>
          <p className="text-sm text-muted-foreground">{job.type} · Created {job.created}</p>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <Link to={`/customers?id=${job.customerId}`} className="text-accent hover:underline font-medium flex items-center gap-1">
              <User className="w-3.5 h-3.5" />{job.customer}
            </Link>
            <span className="text-muted-foreground flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />{job.site}
            </span>
            <span className="text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />{job.siteAddress}
            </span>
          </div>
        </div>
        <Link to="/jobs">
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content — Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Call/Visit Timeline */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="metric-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
              Call / Visit Timeline ({job.calls.length})
            </h3>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

              <div className="space-y-4">
                {job.calls.map((call, i) => {
                  const cStatus = callStatusMap[call.status];
                  return (
                    <motion.div
                      key={call.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="relative pl-10"
                    >
                      {/* Timeline dot */}
                      <div className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2 border-card ${
                        call.status === "complete" ? "bg-success" :
                        call.status === "in_progress" ? "bg-accent" :
                        call.status === "cancelled" ? "bg-destructive" :
                        "bg-muted-foreground"
                      }`} />

                      <div className="bg-muted/30 rounded-lg border border-border p-4">
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
                                <div className="mt-2 px-3 py-2 bg-card rounded-md border border-border/50">
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
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Equipment at Site */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="metric-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-accent" />Equipment at Site
            </h3>
            {equipment.length > 0 ? (
              <div className="space-y-2">
                {equipment.map((eq) => (
                  <div key={eq.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{eq.name}</p>
                      <p className="text-xs text-muted-foreground">Installed {eq.installed}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Last service: {eq.lastService}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No equipment records found.</p>
            )}
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Job Summary */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="metric-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Job Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estimated Days</span>
                <span className="font-medium text-foreground">{job.estimatedDays}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Calls</span>
                <span className="font-medium text-foreground">{job.calls.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium text-foreground">{completedCalls}/{job.calls.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Hours Logged</span>
                <span className="font-medium text-foreground">{totalHours} hrs</span>
              </div>
              <div className="border-t border-border pt-3 mt-3 space-y-2">
                <Link to="/estimates" className="flex items-center justify-between text-sm text-accent hover:underline group">
                  <span className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" />View Estimates</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
                <Link to="/invoices" className="flex items-center justify-between text-sm text-accent hover:underline group">
                  <span className="flex items-center gap-2"><DollarSign className="w-3.5 h-3.5" />View Invoices</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Customer Info */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="metric-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Customer</h3>
            <div className="space-y-2">
              <Link to={`/customers?id=${job.customerId}`} className="text-sm font-medium text-accent hover:underline">
                {job.customer}
              </Link>
              <p className="text-xs text-muted-foreground font-mono">{job.customerId}</p>
              <div className="border-t border-border pt-2 mt-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="w-3 h-3" />{job.site}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3 h-3" />{job.siteAddress}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default JobDetail;
