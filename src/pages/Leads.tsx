import { motion } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Phone, Mail } from "lucide-react";

const leads = [
  { id: "LEAD-301", name: "Robert Kim", source: "Website", phone: "(214) 555-0142", status: "open" as const, pcb: null, created: "Feb 27" },
  { id: "LEAD-300", name: "Jennifer Moore", source: "Referral", phone: "(972) 555-0198", status: "in_progress" as const, pcb: "PCB-089", created: "Feb 26" },
  { id: "LEAD-299", name: "Williams & Sons LLC", source: "Google Ads", phone: "(469) 555-0231", status: "complete" as const, pcb: null, created: "Feb 25" },
  { id: "LEAD-298", name: "Patricia Gray", source: "Phone", phone: "(214) 555-0377", status: "pending" as const, pcb: "PCB-088", created: "Feb 25" },
  { id: "LEAD-297", name: "Anderson Group", source: "Website", phone: "(972) 555-0456", status: "open" as const, pcb: null, created: "Feb 24" },
];

const pcbs = [
  { id: "PCB-089", lead: "LEAD-300", reason: "Follow-up on quote", assignee: "Sales Team", status: "in_progress" as const, due: "Feb 28" },
  { id: "PCB-088", lead: "LEAD-298", reason: "Needs site inspection", assignee: "Mike Johnson", status: "open" as const, due: "Mar 1" },
  { id: "PCB-087", lead: "LEAD-295", reason: "Price comparison", assignee: "Sales Team", status: "complete" as const, due: "Feb 26" },
];

const Leads = () => {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads & PCBs</h1>
          <p className="page-subtitle">Track leads and potential call-backs</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" /> New Lead
        </Button>
      </div>

      {/* Leads Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="metric-card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Active Leads</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Lead ID</th><th>Name</th><th>Source</th><th>Phone</th><th>PCB</th><th>Status</th><th>Created</th></tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="cursor-pointer">
                <td className="font-mono text-xs font-medium">{lead.id}</td>
                <td className="font-medium">{lead.name}</td>
                <td className="text-muted-foreground">{lead.source}</td>
                <td className="text-muted-foreground text-xs">{lead.phone}</td>
                <td className="font-mono text-xs">{lead.pcb || "—"}</td>
                <td><StatusBadge status={lead.status} /></td>
                <td className="text-muted-foreground text-xs">{lead.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* PCBs */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="metric-card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Potential Call-Backs (PCBs)</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>PCB ID</th><th>Lead</th><th>Reason</th><th>Assigned To</th><th>Due</th><th>Status</th></tr>
          </thead>
          <tbody>
            {pcbs.map((pcb) => (
              <tr key={pcb.id}>
                <td className="font-mono text-xs font-medium">{pcb.id}</td>
                <td className="font-mono text-xs">{pcb.lead}</td>
                <td className="text-muted-foreground">{pcb.reason}</td>
                <td>{pcb.assignee}</td>
                <td className="text-muted-foreground text-xs">{pcb.due}</td>
                <td><StatusBadge status={pcb.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default Leads;
