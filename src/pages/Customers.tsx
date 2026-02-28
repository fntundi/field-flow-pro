import { motion } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Phone, Mail, MapPin, Clock, DollarSign, FileText } from "lucide-react";
import { useState } from "react";

const customers = [
  { id: "CUST-1001", name: "Sarah Mitchell", type: "Residential", phone: "(214) 555-0142", email: "sarah.m@email.com", address: "1423 Oak Ave, Dallas, TX", totalJobs: 8, totalSpent: "$12,450", lastService: "Feb 27, 2026", status: "active" as const, agreement: "Premium Plan" },
  { id: "CUST-1002", name: "Acme Corp", type: "Commercial", phone: "(972) 555-0198", email: "facilities@acme.com", address: "500 Commerce St, Dallas, TX", totalJobs: 24, totalSpent: "$87,200", lastService: "Feb 27, 2026", status: "active" as const, agreement: "Enterprise" },
  { id: "CUST-1003", name: "James Rivera", type: "Residential", phone: "(469) 555-0231", email: "j.rivera@email.com", address: "812 Elm St, Plano, TX", totalJobs: 3, totalSpent: "$4,890", lastService: "Feb 27, 2026", status: "active" as const, agreement: null },
  { id: "CUST-1004", name: "Metro Office Park", type: "Commercial", phone: "(214) 555-0377", email: "ops@metrooffice.com", address: "2100 N Central Expy, Richardson, TX", totalJobs: 15, totalSpent: "$52,100", lastService: "Feb 25, 2026", status: "active" as const, agreement: "Standard Plan" },
  { id: "CUST-1005", name: "David Park", type: "Residential", phone: "(972) 555-0456", email: "d.park@email.com", address: "3301 Mockingbird Ln, Dallas, TX", totalJobs: 5, totalSpent: "$7,320", lastService: "Feb 26, 2026", status: "active" as const, agreement: null },
  { id: "CUST-1006", name: "Linda Hayes", type: "Residential", phone: "(469) 555-0512", email: "linda.h@email.com", address: "905 Preston Rd, Frisco, TX", totalJobs: 2, totalSpent: "$3,150", lastService: "Feb 26, 2026", status: "active" as const, agreement: "Basic Plan" },
  { id: "CUST-1007", name: "TechHub Offices", type: "Commercial", phone: "(214) 555-0689", email: "admin@techhub.co", address: "4400 Beltline Rd, Addison, TX", totalJobs: 9, totalSpent: "$28,400", lastService: "Feb 24, 2026", status: "inactive" as const, agreement: null },
  { id: "CUST-1008", name: "Maria Santos", type: "Residential", phone: "(972) 555-0734", email: "m.santos@email.com", address: "667 Greenville Ave, Dallas, TX", totalJobs: 4, totalSpent: "$6,200", lastService: "Feb 25, 2026", status: "active" as const, agreement: "Premium Plan" },
];

const Customers = () => {
  const [search, setSearch] = useState("");
  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage customer profiles, service history, and communication</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: "284", icon: "👥" },
          { label: "Active Agreements", value: "67", icon: "📋" },
          { label: "Avg. Lifetime Value", value: "$8,420", icon: "💰" },
          { label: "Repeat Rate", value: "72%", icon: "🔄" },
        ].map((stat) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="metric-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
              </div>
              <span className="text-2xl">{stat.icon}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Customer Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="metric-card !p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Type</th>
              <th>Contact</th>
              <th>Total Jobs</th>
              <th>Total Spent</th>
              <th>Agreement</th>
              <th>Last Service</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="cursor-pointer">
                <td>
                  <div>
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.address}</p>
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${c.type === "Commercial" ? "status-open" : "status-complete"}`}>
                    {c.type}
                  </span>
                </td>
                <td>
                  <div className="space-y-0.5">
                    <p className="text-xs flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3" />{c.phone}</p>
                    <p className="text-xs flex items-center gap-1 text-muted-foreground"><Mail className="w-3 h-3" />{c.email}</p>
                  </div>
                </td>
                <td className="font-medium">{c.totalJobs}</td>
                <td className="font-medium text-foreground">{c.totalSpent}</td>
                <td>
                  {c.agreement ? (
                    <span className="status-badge status-complete">{c.agreement}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">None</span>
                  )}
                </td>
                <td className="text-muted-foreground text-xs">{c.lastService}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default Customers;
