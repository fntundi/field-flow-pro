import { motion } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, ArrowRight, DollarSign, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useState } from "react";

const estimates = [
  { id: "EST-2041", customer: "Robert Kim", type: "Residential Install", address: "789 Maple Dr, Dallas, TX", status: "pending" as const, created: "Feb 27", expires: "Mar 13", options: [
    { tier: "Good", desc: "14 SEER Single-Stage", price: "$4,800" },
    { tier: "Better", desc: "16 SEER Two-Stage", price: "$6,200" },
    { tier: "Best", desc: "20 SEER Variable Speed", price: "$8,900" },
  ]},
  { id: "EST-2040", customer: "Anderson Group", type: "Commercial Repair", address: "1200 Industrial Blvd, Plano, TX", status: "open" as const, created: "Feb 26", expires: "Mar 12", options: [
    { tier: "Good", desc: "Compressor Repair", price: "$2,100" },
    { tier: "Better", desc: "Compressor + Coil", price: "$3,800" },
    { tier: "Best", desc: "Full Unit Replacement", price: "$12,500" },
  ]},
  { id: "EST-2039", customer: "Jennifer Moore", type: "Residential Install", address: "456 Oak Ln, Frisco, TX", status: "complete" as const, created: "Feb 25", expires: "Mar 11", options: [
    { tier: "Good", desc: "Basic Package", price: "$3,200" },
    { tier: "Better", desc: "Mid-Range Package", price: "$5,100" },
    { tier: "Best", desc: "Premium Package", price: "$7,800" },
  ]},
  { id: "EST-2038", customer: "Williams & Sons LLC", type: "Commercial Install", address: "900 Commerce St, Richardson, TX", status: "complete" as const, created: "Feb 24", expires: "Mar 10", options: [
    { tier: "Good", desc: "Standard RTU", price: "$8,500" },
    { tier: "Better", desc: "High-Efficiency RTU", price: "$12,400" },
    { tier: "Best", desc: "VRF System", price: "$24,000" },
  ]},
  { id: "EST-2037", customer: "Patricia Gray", type: "Maintenance", address: "321 Elm St, McKinney, TX", status: "urgent" as const, created: "Feb 23", expires: "Feb 27", options: [
    { tier: "Good", desc: "Basic Tune-Up", price: "$189" },
    { tier: "Better", desc: "Full Maintenance", price: "$349" },
    { tier: "Best", desc: "Annual Plan", price: "$599" },
  ]},
];

const Estimates = () => {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const filtered = estimates.filter(
    (e) =>
      e.customer.toLowerCase().includes(search.toLowerCase()) ||
      e.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Estimates</h1>
          <p className="page-subtitle">Create and manage job estimates with tiered pricing</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" /> New Estimate
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Open Estimates", value: "12", icon: FileText, color: "text-info" },
          { label: "Avg. Value", value: "$6,420", icon: DollarSign, color: "text-accent" },
          { label: "Converted (MTD)", value: "18", icon: CheckCircle2, color: "text-success" },
          { label: "Conversion Rate", value: "64%", icon: ArrowRight, color: "text-accent" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="metric-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1.5">{stat.value}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
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
          <Input placeholder="Search estimates..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Estimates List */}
      <div className="space-y-3">
        {filtered.map((est, i) => (
          <motion.div
            key={est.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="metric-card cursor-pointer"
            onClick={() => setExpandedId(expandedId === est.id ? null : est.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-muted-foreground">{est.id}</span>
                    <StatusBadge status={est.status} />
                  </div>
                  <p className="text-sm font-semibold text-foreground mt-1">{est.customer}</p>
                  <p className="text-xs text-muted-foreground">{est.type} · {est.address}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Created {est.created}</p>
                <p className="text-xs text-muted-foreground">Expires {est.expires}</p>
              </div>
            </div>

            {/* Good/Better/Best Pricing */}
            {expandedId === est.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 pt-4 border-t border-border"
              >
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pricing Options</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {est.options.map((opt) => (
                    <div
                      key={opt.tier}
                      className={`rounded-lg border p-4 text-center transition-all ${
                        opt.tier === "Better"
                          ? "border-accent bg-accent/5 ring-1 ring-accent/20"
                          : "border-border"
                      }`}
                    >
                      <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                        opt.tier === "Better" ? "text-accent" : "text-muted-foreground"
                      }`}>
                        {opt.tier}
                        {opt.tier === "Better" && " ★"}
                      </p>
                      <p className="text-lg font-bold text-foreground">{opt.price}</p>
                      <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                    Convert to Job <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                  <Button size="sm" variant="outline">Send to Customer</Button>
                  <Button size="sm" variant="outline">Download PDF</Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Estimates;
