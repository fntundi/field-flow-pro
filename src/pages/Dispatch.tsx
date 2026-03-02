import { motion } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { MapPin, Clock, Navigation } from "lucide-react";
import { Link } from "react-router-dom";

const dispatches = [
  { tech: "Mike Johnson", job: "JOB-1042", customer: "Sarah Mitchell", customerId: "CUST-1001", location: "1423 Oak Ave", status: "in_progress" as const, eta: "On site", distance: "0 mi" },
  { tech: "Lisa Chen", job: "JOB-1041", customer: "Acme Corp", customerId: "CUST-1002", location: "500 Commerce St", status: "complete" as const, eta: "Done", distance: "--" },
  { tech: "Tom Brown", job: "JOB-1040", customer: "James Rivera", customerId: "CUST-1003", location: "812 Elm St", status: "urgent" as const, eta: "15 min", distance: "4.2 mi" },
  { tech: "Amy Davis", job: "JOB-1039", customer: "Metro Office Park", customerId: "CUST-1004", location: "2100 N Central Expy", status: "pending" as const, eta: "Tomorrow", distance: "12.1 mi" },
];

const Dispatch = () => {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dispatch</h1>
          <p className="page-subtitle">Real-time technician locations and routing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="metric-card lg:col-span-2 flex items-center justify-center min-h-[420px] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-secondary opacity-50" />
          <div className="relative text-center">
            <MapPin className="w-12 h-12 text-accent mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Live Map View</p>
            <p className="text-xs text-muted-foreground mt-1">Connect to a mapping service to enable real-time tracking</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Active Dispatches</h3>
          {dispatches.map((d) => (
            <div key={d.tech} className="metric-card !p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Link to="/technicians" className="text-sm font-semibold text-foreground hover:text-accent transition-colors">{d.tech}</Link>
                <StatusBadge status={d.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                <Link to={`/jobs/${d.job}`} className="text-accent hover:underline font-mono">{d.job}</Link>
                {" · "}
                <Link to={`/customers?id=${d.customerId}`} className="hover:text-accent transition-colors">{d.customer}</Link>
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{d.location}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{d.eta}</span>
                <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{d.distance}</span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default Dispatch;
