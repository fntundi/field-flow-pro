import { motion, AnimatePresence } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Plus, Search, Phone, Mail, MapPin, ChevronDown, ChevronRight, Building2, Briefcase, Home } from "lucide-react";
import { useState } from "react";

interface Site {
  id: string;
  name: string;
  address: string;
  type: "residential" | "commercial";
  equipment: string[];
  activeJobs: number;
  lastService: string;
}

interface Customer {
  id: string;
  name: string;
  type: string;
  phone: string;
  email: string;
  totalJobs: number;
  totalSpent: string;
  lastService: string;
  status: "active" | "inactive";
  agreement: string | null;
  sites: Site[];
}

const customers: Customer[] = [
  {
    id: "CUST-1001", name: "Sarah Mitchell", type: "Residential", phone: "(214) 555-0142", email: "sarah.m@email.com",
    totalJobs: 8, totalSpent: "$12,450", lastService: "Feb 27, 2026", status: "active", agreement: "Premium Plan",
    sites: [
      { id: "SITE-1001A", name: "Primary Residence", address: "1423 Oak Ave, Dallas, TX", type: "residential", equipment: ["Trane XR15 (3-ton)", "Honeywell T6 Thermostat"], activeJobs: 1, lastService: "Feb 27, 2026" },
      { id: "SITE-1001B", name: "Rental Property", address: "809 Maple Dr, Plano, TX", type: "residential", equipment: ["Goodman GSX16 (2.5-ton)"], activeJobs: 0, lastService: "Jan 15, 2026" },
    ],
  },
  {
    id: "CUST-1002", name: "Acme Corp", type: "Commercial", phone: "(972) 555-0198", email: "facilities@acme.com",
    totalJobs: 24, totalSpent: "$87,200", lastService: "Feb 27, 2026", status: "active", agreement: "Enterprise",
    sites: [
      { id: "SITE-1002A", name: "Main Office", address: "500 Commerce St, Dallas, TX", type: "commercial", equipment: ["Carrier 50XC (15-ton)", "Carrier 50XC (10-ton)"], activeJobs: 0, lastService: "Feb 27, 2026" },
      { id: "SITE-1002B", name: "Warehouse", address: "1200 Industrial Blvd, Dallas, TX", type: "commercial", equipment: ["Lennox LGH (20-ton)"], activeJobs: 1, lastService: "Feb 20, 2026" },
      { id: "SITE-1002C", name: "Executive Suite", address: "502 Commerce St, Ste 400, Dallas, TX", type: "commercial", equipment: ["Daikin VRV IV (8-ton)"], activeJobs: 0, lastService: "Feb 10, 2026" },
    ],
  },
  {
    id: "CUST-1003", name: "James Rivera", type: "Residential", phone: "(469) 555-0231", email: "j.rivera@email.com",
    totalJobs: 3, totalSpent: "$4,890", lastService: "Feb 27, 2026", status: "active", agreement: null,
    sites: [
      { id: "SITE-1003A", name: "Home", address: "812 Elm St, Plano, TX", type: "residential", equipment: ["Rheem RA20 (3-ton)"], activeJobs: 1, lastService: "Feb 27, 2026" },
    ],
  },
  {
    id: "CUST-1004", name: "Metro Office Park", type: "Commercial", phone: "(214) 555-0377", email: "ops@metrooffice.com",
    totalJobs: 15, totalSpent: "$52,100", lastService: "Feb 25, 2026", status: "active", agreement: "Standard Plan",
    sites: [
      { id: "SITE-1004A", name: "Building A", address: "2100 N Central Expy, Richardson, TX", type: "commercial", equipment: ["Lennox XC25 (5-ton)", "York YC2F (10-ton)"], activeJobs: 1, lastService: "Feb 25, 2026" },
      { id: "SITE-1004B", name: "Building B", address: "2104 N Central Expy, Richardson, TX", type: "commercial", equipment: ["Trane IntelliPak (15-ton)"], activeJobs: 0, lastService: "Feb 18, 2026" },
    ],
  },
  {
    id: "CUST-1005", name: "David Park", type: "Residential", phone: "(972) 555-0456", email: "d.park@email.com",
    totalJobs: 5, totalSpent: "$7,320", lastService: "Feb 26, 2026", status: "active", agreement: null,
    sites: [
      { id: "SITE-1005A", name: "Home", address: "3301 Mockingbird Ln, Dallas, TX", type: "residential", equipment: ["Carrier Infinity (3.5-ton)"], activeJobs: 0, lastService: "Feb 26, 2026" },
    ],
  },
  {
    id: "CUST-1006", name: "Linda Hayes", type: "Residential", phone: "(469) 555-0512", email: "linda.h@email.com",
    totalJobs: 2, totalSpent: "$3,150", lastService: "Feb 26, 2026", status: "active", agreement: "Basic Plan",
    sites: [
      { id: "SITE-1006A", name: "Primary Residence", address: "905 Preston Rd, Frisco, TX", type: "residential", equipment: ["Goodman GSX16 (2.5-ton)"], activeJobs: 0, lastService: "Feb 26, 2026" },
    ],
  },
  {
    id: "CUST-1007", name: "TechHub Offices", type: "Commercial", phone: "(214) 555-0689", email: "admin@techhub.co",
    totalJobs: 9, totalSpent: "$28,400", lastService: "Feb 24, 2026", status: "inactive", agreement: null,
    sites: [
      { id: "SITE-1007A", name: "Suite 200", address: "4400 Beltline Rd, Addison, TX", type: "commercial", equipment: ["York YC2F (10-ton)"], activeJobs: 1, lastService: "Feb 24, 2026" },
    ],
  },
  {
    id: "CUST-1008", name: "Maria Santos", type: "Residential", phone: "(972) 555-0734", email: "m.santos@email.com",
    totalJobs: 4, totalSpent: "$6,200", lastService: "Feb 25, 2026", status: "active", agreement: "Premium Plan",
    sites: [
      { id: "SITE-1008A", name: "Home", address: "667 Greenville Ave, Dallas, TX", type: "residential", equipment: ["Rheem RA20 (3-ton)"], activeJobs: 0, lastService: "Feb 25, 2026" },
    ],
  },
];

const Customers = () => {
  const [search, setSearch] = useState("");
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.sites.some((s) => s.address.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage customer profiles, sites, and service history</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: "284", icon: "👥" },
          { label: "Total Sites", value: "412", icon: "🏢" },
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

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search customers, sites, addresses..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((c) => {
          const isExpanded = expandedCustomer === c.id;
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="metric-card !p-0 overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedCustomer(isExpanded ? null : c.id)}>
                <button className="text-muted-foreground">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-foreground">{c.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                    <span className={`status-badge ${c.type === "Commercial" ? "status-open" : "status-complete"}`}>{c.type}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.sites.length} site{c.sites.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div className="hidden md:block">
                    <p className="text-sm font-semibold text-foreground">{c.totalSpent}</p>
                    <Link to={`/jobs?customer=${c.id}`} className="text-xs text-accent hover:underline">{c.totalJobs} jobs</Link>
                  </div>
                  {c.agreement ? (
                    <Link to="/agreements" className="status-badge status-complete hover:opacity-80">{c.agreement}</Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">No agreement</span>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="border-t border-border bg-muted/20 px-5 py-3">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Sites ({c.sites.length})</h4>
                        <Button variant="ghost" size="sm" className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" /> Add Site</Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {c.sites.map((site) => (
                          <div key={site.id} className="bg-card rounded-lg border border-border p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {site.type === "commercial" ? <Building2 className="w-4 h-4 text-info" /> : <Home className="w-4 h-4 text-success" />}
                                <span className="text-sm font-medium text-foreground">{site.name}</span>
                                <span className="font-mono text-xs text-muted-foreground">{site.id}</span>
                              </div>
                              {site.activeJobs > 0 && (
                                <Link to={`/jobs?customer=${c.id}`} className="status-badge status-progress hover:opacity-80">{site.activeJobs} active</Link>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2"><MapPin className="w-3 h-3" />{site.address}</p>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {site.equipment.map((eq) => (
                                <span key={eq} className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{eq}</span>
                              ))}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />Last: {site.lastService}</span>
                            </div>
                          </div>
                        ))}
                      </div>
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

export default Customers;
