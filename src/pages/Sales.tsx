import { motion } from "framer-motion";
import MetricCard from "@/components/MetricCard";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DollarSign, TrendingUp, Target, Award, Search, Phone, ArrowRight, Users,
  BarChart3, Calendar, FileText, Percent
} from "lucide-react";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from "recharts";

const CHART_COLORS = [
  "hsl(36, 95%, 54%)",
  "hsl(210, 90%, 52%)",
  "hsl(152, 60%, 40%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 72%, 51%)",
];

const pipelineData = [
  { stage: "New Lead", count: 42, value: 168000 },
  { stage: "Contacted", count: 28, value: 112000 },
  { stage: "Site Visit", count: 18, value: 108000 },
  { stage: "Quote Sent", count: 14, value: 98000 },
  { stage: "Negotiation", count: 8, value: 72000 },
  { stage: "Won", count: 6, value: 54000 },
];

const revenueByRep = [
  { name: "Rachel Kim", closed: 12, revenue: 84200, quota: 100000, winRate: 68 },
  { name: "Tom Parker", closed: 9, revenue: 62100, quota: 80000, winRate: 55 },
  { name: "Sarah Lee", closed: 7, revenue: 48500, quota: 75000, winRate: 72 },
  { name: "Jake Morris", closed: 5, revenue: 31800, quota: 60000, winRate: 42 },
];

const monthlyTrend = [
  { month: "Sep", revenue: 38000, deals: 8 },
  { month: "Oct", revenue: 45000, deals: 10 },
  { month: "Nov", revenue: 52000, deals: 11 },
  { month: "Dec", revenue: 31000, deals: 6 },
  { month: "Jan", revenue: 67000, deals: 14 },
  { month: "Feb", revenue: 54000, deals: 12 },
];

const recentDeals = [
  { id: "EST-220", customer: "Metro Office Park", type: "Commercial Install", value: "$18,500", stage: "Quote Sent", rep: "Rachel Kim", daysInStage: 3, tier: "Best" },
  { id: "EST-219", customer: "Sarah Mitchell", type: "Residential Repair", value: "$4,200", stage: "Won", rep: "Tom Parker", daysInStage: 0, tier: "Better" },
  { id: "EST-218", customer: "TechHub Offices", type: "Commercial Repair", value: "$8,900", stage: "Negotiation", rep: "Sarah Lee", daysInStage: 5, tier: "Good" },
  { id: "EST-217", customer: "James Rivera", type: "Residential Install", value: "$12,800", stage: "Site Visit", rep: "Rachel Kim", daysInStage: 2, tier: "Best" },
  { id: "EST-216", customer: "Linda Hayes", type: "Residential Install", value: "$6,400", stage: "Won", rep: "Jake Morris", daysInStage: 0, tier: "Better" },
  { id: "EST-215", customer: "Acme Corp", type: "Commercial Maintenance", value: "$3,200", stage: "Contacted", rep: "Tom Parker", daysInStage: 1, tier: "Good" },
];

const sourceData = [
  { name: "Referral", value: 35 },
  { name: "Web/SEO", value: 25 },
  { name: "Google Ads", value: 20 },
  { name: "Repeat Client", value: 15 },
  { name: "Other", value: 5 },
];

const stageToStatus = (stage: string): "open" | "in_progress" | "complete" | "pending" => {
  if (stage === "Won") return "complete";
  if (stage === "Negotiation" || stage === "Quote Sent") return "in_progress";
  if (stage === "Site Visit" || stage === "Contacted") return "pending";
  return "open";
};

const Sales = () => {
  const [search, setSearch] = useState("");

  const filteredDeals = recentDeals.filter(
    (d) =>
      d.customer.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.rep.toLowerCase().includes(search.toLowerCase())
  );

  const totalPipeline = pipelineData.reduce((sum, s) => sum + s.value, 0);
  const totalWon = monthlyTrend.reduce((sum, m) => sum + m.revenue, 0);
  const avgDealSize = Math.round(totalWon / monthlyTrend.reduce((sum, m) => sum + m.deals, 0));

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales</h1>
          <p className="page-subtitle">Pipeline, performance, and deal tracking</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <FileText className="w-4 h-4 mr-2" /> New Estimate
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Pipeline Value" value={`$${(totalPipeline / 1000).toFixed(0)}k`} change="+18% vs last month" changeType="positive" icon={DollarSign} index={0} />
        <MetricCard title="Win Rate" value="58%" change="+5% improvement" changeType="positive" icon={Target} index={1} />
        <MetricCard title="Avg Deal Size" value={`$${(avgDealSize / 1000).toFixed(1)}k`} change="+$800 vs avg" changeType="positive" icon={TrendingUp} index={2} />
        <MetricCard title="Deals This Month" value="12" change="6 won, 2 lost" changeType="neutral" icon={Award} index={3} />
      </div>

      {/* Pipeline Funnel + Revenue Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="metric-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Sales Pipeline</h3>
          <div className="space-y-2">
            {pipelineData.map((stage, i) => {
              const maxCount = pipelineData[0].count;
              const pct = (stage.count / maxCount) * 100;
              return (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 text-right">{stage.stage}</span>
                  <div className="flex-1 h-7 bg-muted rounded-md overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
                      className="h-full rounded-md flex items-center justify-end px-2"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    >
                      <span className="text-xs font-semibold text-white drop-shadow">{stage.count}</span>
                    </motion.div>
                  </div>
                  <span className="text-xs font-medium text-foreground w-16 text-right">${(stage.value / 1000).toFixed(0)}k</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="metric-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyTrend}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(36, 95%, 54%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(36, 95%, 54%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(215, 14%, 46%)" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(215, 14%, 46%)" }} tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]} contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(214, 20%, 90%)", borderRadius: "8px", fontSize: "12px" }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(36, 95%, 54%)" fill="url(#salesGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Rep Performance + Lead Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="metric-card lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">Sales Rep Performance</h3>
          <div className="space-y-3">
            {revenueByRep.map((rep) => {
              const quotaPct = Math.round((rep.revenue / rep.quota) * 100);
              return (
                <div key={rep.name} className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center">
                        <Users className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{rep.name}</p>
                        <p className="text-xs text-muted-foreground">{rep.closed} deals closed · {rep.winRate}% win rate</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">${(rep.revenue / 1000).toFixed(1)}k</p>
                      <p className="text-xs text-muted-foreground">of ${(rep.quota / 1000).toFixed(0)}k quota</p>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(quotaPct, 100)}%` }}
                      transition={{ delay: 0.6, duration: 0.5 }}
                      className={`h-full rounded-full ${quotaPct >= 100 ? "bg-success" : quotaPct >= 75 ? "bg-accent" : "bg-warning"}`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{quotaPct}% of quota</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="metric-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Lead Sources</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={sourceData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {sourceData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(214, 20%, 90%)", borderRadius: "8px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {sourceData.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i] }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-medium text-foreground">{item.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Active Deals Table */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search deals..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="metric-card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Active Deals</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Estimate</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Value</th>
              <th>Tier</th>
              <th>Sales Rep</th>
              <th>Days in Stage</th>
              <th>Stage</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeals.map((deal) => (
              <tr key={deal.id} className="cursor-pointer">
                <td className="font-mono text-xs font-medium">{deal.id}</td>
                <td className="font-medium text-foreground">{deal.customer}</td>
                <td className="text-muted-foreground text-xs">{deal.type}</td>
                <td className="font-semibold text-foreground">{deal.value}</td>
                <td>
                  <span className={`status-badge ${
                    deal.tier === "Best" ? "status-complete" :
                    deal.tier === "Better" ? "status-open" : "status-progress"
                  }`}>{deal.tier}</span>
                </td>
                <td className="text-muted-foreground">{deal.rep}</td>
                <td>
                  <span className={`text-xs font-medium ${deal.daysInStage > 4 ? "text-warning" : "text-muted-foreground"}`}>
                    {deal.daysInStage === 0 ? "—" : `${deal.daysInStage}d`}
                  </span>
                </td>
                <td><StatusBadge status={stageToStatus(deal.stage)} label={deal.stage} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default Sales;
