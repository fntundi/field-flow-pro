import { motion } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, DollarSign, Clock, CheckCircle2, AlertTriangle, Download, Send } from "lucide-react";
import { useState } from "react";

const invoices = [
  { id: "INV-5042", customer: "Sarah Mitchell", job: "JOB-1042", amount: "$4,850.00", tax: "$388.00", total: "$5,238.00", status: "paid" as const, issued: "Feb 27", due: "Mar 13", paidDate: "Feb 27", method: "Card on File" },
  { id: "INV-5041", customer: "Acme Corp", job: "JOB-1041", amount: "$12,400.00", tax: "$992.00", total: "$13,392.00", status: "sent" as const, issued: "Feb 27", due: "Mar 27", paidDate: null, method: null },
  { id: "INV-5040", customer: "James Rivera", job: "JOB-1040", amount: "$890.00", tax: "$71.20", total: "$961.20", status: "overdue" as const, issued: "Feb 20", due: "Feb 27", paidDate: null, method: null },
  { id: "INV-5039", customer: "Metro Office Park", job: "JOB-1039", amount: "$6,200.00", tax: "$496.00", total: "$6,696.00", status: "draft" as const, issued: "Feb 28", due: "Mar 14", paidDate: null, method: null },
  { id: "INV-5038", customer: "David Park", job: "JOB-1038", amount: "$1,250.00", tax: "$100.00", total: "$1,350.00", status: "paid" as const, issued: "Feb 26", due: "Mar 12", paidDate: "Feb 26", method: "ACH Transfer" },
  { id: "INV-5037", customer: "Linda Hayes", job: "JOB-1037", amount: "$7,800.00", tax: "$624.00", total: "$8,424.00", status: "paid" as const, issued: "Feb 26", due: "Mar 12", paidDate: "Feb 28", method: "Check" },
  { id: "INV-5036", customer: "TechHub Offices", job: "JOB-1036", amount: "$3,450.00", tax: "$276.00", total: "$3,726.00", status: "sent" as const, issued: "Feb 25", due: "Mar 11", paidDate: null, method: null },
];

const getInvoiceStatusBadge = (status: string) => {
  switch (status) {
    case "paid": return <StatusBadge status="complete" label="Paid" />;
    case "sent": return <StatusBadge status="open" label="Sent" />;
    case "overdue": return <StatusBadge status="urgent" label="Overdue" />;
    case "draft": return <StatusBadge status="pending" label="Draft" />;
    default: return null;
  }
};

const Invoices = () => {
  const [search, setSearch] = useState("");
  const filtered = invoices.filter(
    (inv) =>
      inv.customer.toLowerCase().includes(search.toLowerCase()) ||
      inv.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Billing, payments, and financial tracking</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" /> New Invoice
        </Button>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Revenue (MTD)", value: "$58,420", icon: DollarSign, change: "+12.3%" },
          { label: "Outstanding", value: "$24,114", icon: Clock, change: "6 invoices" },
          { label: "Collected (MTD)", value: "$34,306", icon: CheckCircle2, change: "14 invoices" },
          { label: "Overdue", value: "$961", icon: AlertTriangle, change: "1 invoice" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="metric-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1.5">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.change}</p>
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
          <Input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Invoices Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="metric-card !p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Job</th>
              <th>Amount</th>
              <th>Tax</th>
              <th>Total</th>
              <th>Status</th>
              <th>Due</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id}>
                <td className="font-mono text-xs font-medium">{inv.id}</td>
                <td className="font-medium">{inv.customer}</td>
                <td className="font-mono text-xs text-muted-foreground">{inv.job}</td>
                <td className="text-foreground">{inv.amount}</td>
                <td className="text-muted-foreground">{inv.tax}</td>
                <td className="font-semibold text-foreground">{inv.total}</td>
                <td>{getInvoiceStatusBadge(inv.status)}</td>
                <td className="text-muted-foreground text-xs">{inv.due}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Send className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="w-3 h-3" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default Invoices;
