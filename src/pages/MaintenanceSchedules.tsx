import { motion } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Settings2, Bell, BellRing, Calendar, AlertTriangle, CheckCircle2, Mail, Phone } from "lucide-react";
import { useState } from "react";

interface MaintenanceSchedule {
  id: string;
  customer: string;
  site: string;
  equipment: string;
  plan: string;
  frequency: string;
  lastService: string;
  nextDue: string;
  status: "on_track" | "due_soon" | "overdue" | "escalated";
  internalAttempts: number;
  maxAttempts: number;
  customerNotified: boolean;
  daysUntilDue: number;
}

const schedules: MaintenanceSchedule[] = [
  { id: "MS-301", customer: "Sarah Mitchell", site: "Primary Residence", equipment: "Trane XR15 (3-ton)", plan: "Premium Plan", frequency: "Quarterly", lastService: "Dec 15, 2025", nextDue: "Mar 15, 2026", status: "due_soon", internalAttempts: 1, maxAttempts: 3, customerNotified: false, daysUntilDue: 15 },
  { id: "MS-302", customer: "Acme Corp", site: "Main Office", equipment: "Carrier 50XC (15-ton)", plan: "Enterprise", frequency: "Monthly", lastService: "Feb 3, 2026", nextDue: "Mar 3, 2026", status: "on_track", internalAttempts: 0, maxAttempts: 3, customerNotified: false, daysUntilDue: 3 },
  { id: "MS-303", customer: "Metro Office Park", site: "Building A", equipment: "Lennox XC25 (5-ton)", plan: "Standard Plan", frequency: "Quarterly", lastService: "Jan 1, 2026", nextDue: "Apr 1, 2026", status: "on_track", internalAttempts: 0, maxAttempts: 3, customerNotified: false, daysUntilDue: 32 },
  { id: "MS-304", customer: "Linda Hayes", site: "Primary Residence", equipment: "Goodman GSX16 (2.5-ton)", plan: "Basic Plan", frequency: "Semi-Annual", lastService: "Nov 1, 2025", nextDue: "May 1, 2026", status: "on_track", internalAttempts: 0, maxAttempts: 3, customerNotified: false, daysUntilDue: 62 },
  { id: "MS-305", customer: "David Park", site: "Home", equipment: "Carrier Infinity (3.5-ton)", plan: "—", frequency: "Annual", lastService: "Mar 10, 2025", nextDue: "Mar 10, 2026", status: "due_soon", internalAttempts: 2, maxAttempts: 3, customerNotified: false, daysUntilDue: 10 },
  { id: "MS-306", customer: "TechHub Offices", site: "Suite 200", equipment: "York YC2F (10-ton)", plan: "—", frequency: "Quarterly", lastService: "Aug 24, 2025", nextDue: "Nov 24, 2025", status: "overdue", internalAttempts: 3, maxAttempts: 3, customerNotified: true, daysUntilDue: -96 },
  { id: "MS-307", customer: "Maria Santos", site: "Home", equipment: "Rheem RA20 (3-ton)", plan: "Premium Plan", frequency: "Quarterly", lastService: "Dec 20, 2025", nextDue: "Mar 20, 2026", status: "due_soon", internalAttempts: 0, maxAttempts: 3, customerNotified: false, daysUntilDue: 20 },
  { id: "MS-308", customer: "James Rivera", site: "Home", equipment: "Rheem RA20 (3-ton)", plan: "—", frequency: "Annual", lastService: "Feb 27, 2025", nextDue: "Feb 27, 2026", status: "escalated", internalAttempts: 3, maxAttempts: 3, customerNotified: true, daysUntilDue: -1 },
];

const alertConfig = {
  dueSoonDays: 30,
  overdueDays: 0,
  maxInternalAttempts: 3,
  reminderIntervalDays: 7,
  customerEscalationEnabled: true,
};

const MaintenanceSchedules = () => {
  const [search, setSearch] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  const filtered = schedules.filter(
    (s) =>
      s.customer.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.equipment.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusInfo = (status: MaintenanceSchedule["status"]) => {
    switch (status) {
      case "on_track": return { badge: <StatusBadge status="complete" label="On Track" />, icon: <CheckCircle2 className="w-4 h-4 text-success" /> };
      case "due_soon": return { badge: <StatusBadge status="pending" label="Due Soon" />, icon: <Bell className="w-4 h-4 text-warning" /> };
      case "overdue": return { badge: <StatusBadge status="urgent" label="Overdue" />, icon: <AlertTriangle className="w-4 h-4 text-destructive" /> };
      case "escalated": return { badge: <StatusBadge status="urgent" label="Escalated to Customer" />, icon: <BellRing className="w-4 h-4 text-destructive" /> };
    }
  };

  const overdue = schedules.filter((s) => s.status === "overdue" || s.status === "escalated").length;
  const dueSoon = schedules.filter((s) => s.status === "due_soon").length;
  const escalated = schedules.filter((s) => s.customerNotified).length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance Schedules</h1>
          <p className="page-subtitle">Auto-generated from installations with configurable alerts and escalation</p>
        </div>
        <Button variant="outline" onClick={() => setShowConfig(!showConfig)}>
          <Settings2 className="w-4 h-4 mr-2" /> Alert Settings
        </Button>
      </div>

      {/* Alert Configuration Panel */}
      {showConfig && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="metric-card border-accent/30 border-2">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-accent" /> Alert Configuration
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Due Soon Threshold (days)</label>
              <Input type="number" defaultValue={alertConfig.dueSoonDays} className="h-9" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Internal Reminder Interval (days)</label>
              <Input type="number" defaultValue={alertConfig.reminderIntervalDays} className="h-9" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Max Internal Attempts Before Escalation</label>
              <Input type="number" defaultValue={alertConfig.maxInternalAttempts} className="h-9" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Customer Escalation</label>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-9 h-5 rounded-full bg-accent relative cursor-pointer">
                  <div className="w-4 h-4 rounded-full bg-accent-foreground absolute right-0.5 top-0.5" />
                </div>
                <span className="text-xs text-foreground">Enabled — auto-notify customer after max attempts</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowConfig(false)}>Cancel</Button>
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">Save Settings</Button>
          </div>
        </motion.div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Schedules", value: schedules.length.toString(), icon: Calendar, color: "text-info" },
          { label: "Due Soon", value: dueSoon.toString(), icon: Bell, color: "text-warning" },
          { label: "Overdue", value: overdue.toString(), icon: AlertTriangle, color: "text-destructive" },
          { label: "Escalated to Customer", value: escalated.toString(), icon: BellRing, color: "text-destructive" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="metric-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1.5">{stat.value}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search schedules..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Schedule Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="metric-card !p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Schedule</th>
              <th>Customer / Site</th>
              <th>Equipment</th>
              <th>Frequency</th>
              <th>Last Service</th>
              <th>Next Due</th>
              <th>Alert Progress</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const statusInfo = getStatusInfo(s.status);
              return (
                <tr key={s.id} className="cursor-pointer">
                  <td className="font-mono text-xs font-medium">{s.id}</td>
                  <td>
                    <div>
                      <p className="font-medium text-foreground">{s.customer}</p>
                      <p className="text-xs text-muted-foreground">{s.site}</p>
                    </div>
                  </td>
                  <td className="text-xs text-muted-foreground">{s.equipment}</td>
                  <td className="text-muted-foreground">{s.frequency}</td>
                  <td className="text-muted-foreground text-xs">{s.lastService}</td>
                  <td>
                    <span className={`text-xs font-medium ${
                      s.daysUntilDue < 0 ? "text-destructive" :
                      s.daysUntilDue <= 30 ? "text-warning" : "text-foreground"
                    }`}>
                      {s.nextDue}
                      {s.daysUntilDue < 0 && <span className="block text-destructive">{Math.abs(s.daysUntilDue)}d overdue</span>}
                      {s.daysUntilDue > 0 && s.daysUntilDue <= 30 && <span className="block text-warning">in {s.daysUntilDue}d</span>}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: s.maxAttempts }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-6 rounded-sm ${
                              i < s.internalAttempts
                                ? s.internalAttempts >= s.maxAttempts ? "bg-destructive" : "bg-warning"
                                : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.internalAttempts}/{s.maxAttempts}
                        {s.customerNotified && (
                          <span className="flex items-center gap-1 text-destructive mt-0.5">
                            <Mail className="w-3 h-3" /> Sent to customer
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{statusInfo.badge}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default MaintenanceSchedules;
