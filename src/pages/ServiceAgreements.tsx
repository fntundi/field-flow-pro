import { motion } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Shield, Calendar, DollarSign, RefreshCw } from "lucide-react";
import { useState } from "react";

const agreements = [
  { id: "SA-401", customer: "Sarah Mitchell", type: "Residential", plan: "Premium Plan", visits: "4/year", price: "$49/mo", nextService: "Mar 15, 2026", startDate: "Jan 2025", endDate: "Jan 2027", status: "active", equipment: "Trane XR15 (3-ton)" },
  { id: "SA-402", customer: "Acme Corp", type: "Commercial", plan: "Enterprise", visits: "12/year", price: "$299/mo", nextService: "Mar 3, 2026", startDate: "Jun 2024", endDate: "Jun 2026", status: "active", equipment: "Carrier 50XC (15-ton)" },
  { id: "SA-403", customer: "Metro Office Park", type: "Commercial", plan: "Standard Plan", visits: "4/year", price: "$149/mo", nextService: "Apr 1, 2026", startDate: "Sep 2025", endDate: "Sep 2026", status: "active", equipment: "Lennox XC25 (5-ton)" },
  { id: "SA-404", customer: "Linda Hayes", type: "Residential", plan: "Basic Plan", visits: "2/year", price: "$29/mo", nextService: "May 1, 2026", startDate: "Nov 2025", endDate: "Nov 2026", status: "active", equipment: "Goodman GSX16 (2.5-ton)" },
  { id: "SA-405", customer: "Maria Santos", type: "Residential", plan: "Premium Plan", visits: "4/year", price: "$49/mo", nextService: "Mar 20, 2026", startDate: "Mar 2025", endDate: "Mar 2027", status: "active", equipment: "Rheem RA20 (3-ton)" },
  { id: "SA-406", customer: "TechHub Offices", type: "Commercial", plan: "Standard Plan", visits: "4/year", price: "$149/mo", nextService: "—", startDate: "Jan 2025", endDate: "Jan 2026", status: "expired", equipment: "York YC2F (10-ton)" },
  { id: "SA-407", customer: "David Park", type: "Residential", plan: "Basic Plan", visits: "2/year", price: "$29/mo", nextService: "—", startDate: "Jun 2025", endDate: "Feb 2026", status: "expiring", equipment: "Daikin DX20VC (3.5-ton)" },
];

const Agreements = () => {
  const [search, setSearch] = useState("");
  const filtered = agreements.filter(
    (a) =>
      a.customer.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <StatusBadge status="complete" label="Active" />;
      case "expired": return <StatusBadge status="urgent" label="Expired" />;
      case "expiring": return <StatusBadge status="pending" label="Expiring Soon" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Service Agreements</h1>
          <p className="page-subtitle">Manage recurring maintenance contracts and plans</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" /> New Agreement
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Active Agreements", value: "67", icon: Shield, desc: "+5 this month" },
          { label: "Monthly Revenue", value: "$8,420", icon: DollarSign, desc: "+12% vs last month" },
          { label: "Renewal Rate", value: "89%", icon: RefreshCw, desc: "+3% improvement" },
          { label: "Upcoming Services", value: "14", icon: Calendar, desc: "Next 30 days" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="metric-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1.5">{stat.value}</p>
                <p className="text-xs text-success mt-0.5">{stat.desc}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-accent" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search agreements..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Agreements Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="metric-card !p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agreement</th>
              <th>Customer</th>
              <th>Plan</th>
              <th>Visits</th>
              <th>Price</th>
              <th>Equipment</th>
              <th>Next Service</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="cursor-pointer">
                <td className="font-mono text-xs font-medium">{a.id}</td>
                <td>
                  <div>
                    <p className="font-medium text-foreground">{a.customer}</p>
                    <p className="text-xs text-muted-foreground">{a.type}</p>
                  </div>
                </td>
                <td className="font-medium">{a.plan}</td>
                <td className="text-muted-foreground">{a.visits}</td>
                <td className="font-medium text-foreground">{a.price}</td>
                <td className="text-xs text-muted-foreground">{a.equipment}</td>
                <td className="text-muted-foreground text-xs">{a.nextService}</td>
                <td>{getStatusBadge(a.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default Agreements;
