import { motion } from "framer-motion";
import MetricCard from "@/components/MetricCard";
import { DollarSign, TrendingUp, Users, Clock, Target, BarChart3, Percent, ArrowUpRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";

const revenueByMonth = [
  { month: "Sep", revenue: 42000, expenses: 28000 },
  { month: "Oct", revenue: 48000, expenses: 31000 },
  { month: "Nov", revenue: 55000, expenses: 33000 },
  { month: "Dec", revenue: 38000, expenses: 26000 },
  { month: "Jan", revenue: 62000, expenses: 35000 },
  { month: "Feb", revenue: 58000, expenses: 32000 },
];

const techPerformance = [
  { name: "Mike J.", jobs: 28, revenue: 18400, rating: 4.9, efficiency: 94 },
  { name: "Lisa C.", jobs: 22, revenue: 15200, rating: 4.8, efficiency: 91 },
  { name: "Tom B.", jobs: 25, revenue: 12800, rating: 4.7, efficiency: 88 },
  { name: "Amy D.", jobs: 19, revenue: 14100, rating: 4.9, efficiency: 96 },
  { name: "Carlos M.", jobs: 14, revenue: 8200, rating: 4.6, efficiency: 85 },
];

const leadSources = [
  { name: "Google Ads", value: 35 },
  { name: "Referral", value: 28 },
  { name: "Website", value: 20 },
  { name: "Phone", value: 12 },
  { name: "Other", value: 5 },
];

const dispatchMetrics = [
  { day: "Mon", avgResponse: 18, avgTravel: 22 },
  { day: "Tue", avgResponse: 15, avgTravel: 19 },
  { day: "Wed", avgResponse: 22, avgTravel: 25 },
  { day: "Thu", avgResponse: 12, avgTravel: 17 },
  { day: "Fri", avgResponse: 20, avgTravel: 23 },
];

const COLORS = ["hsl(36,95%,54%)", "hsl(210,90%,52%)", "hsl(152,60%,40%)", "hsl(280,60%,55%)", "hsl(0,72%,51%)"];

const Analytics = () => {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Business performance and reporting dashboards</p>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Gross Margin" value="44.7%" change="+2.1% vs last month" changeType="positive" icon={Percent} index={0} />
        <MetricCard title="Avg. Ticket" value="$371" change="+$24 vs last month" changeType="positive" icon={DollarSign} index={1} />
        <MetricCard title="Lead Conversion" value="64%" change="+5% improvement" changeType="positive" icon={Target} index={2} />
        <MetricCard title="DSO (Days Sales)" value="28 days" change="-3 days improvement" changeType="positive" icon={Clock} index={3} />
      </div>

      {/* Revenue & Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="metric-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue vs Expenses</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(215,14%,46%)" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(215,14%,46%)" }} tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, ""]} contentStyle={{ background: "hsl(0,0%,100%)", border: "1px solid hsl(214,20%,90%)", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="revenue" fill="hsl(36,95%,54%)" radius={[4,4,0,0]} name="Revenue" />
              <Bar dataKey="expenses" fill="hsl(215,28%,17%)" radius={[4,4,0,0]} name="Expenses" opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="metric-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Lead Sources</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie data={leadSources} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                  {leadSources.map((_, i) => (<Cell key={i} fill={COLORS[i]} />))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(0,0%,100%)", border: "1px solid hsl(214,20%,90%)", borderRadius: "8px", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {leadSources.map((src, i) => (
                <div key={src.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                    <span className="text-muted-foreground">{src.name}</span>
                  </div>
                  <span className="font-medium text-foreground">{src.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Technician Performance */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="metric-card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Technician Performance (MTD)</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Technician</th><th>Jobs Completed</th><th>Revenue Generated</th><th>Rating</th><th>Efficiency</th></tr>
          </thead>
          <tbody>
            {techPerformance.map((tech) => (
              <tr key={tech.name}>
                <td className="font-medium">{tech.name}</td>
                <td>{tech.jobs}</td>
                <td className="font-medium text-foreground">${tech.revenue.toLocaleString()}</td>
                <td>⭐ {tech.rating}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full max-w-[80px]">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${tech.efficiency}%` }} />
                    </div>
                    <span className="text-xs font-medium text-foreground">{tech.efficiency}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* Dispatch Metrics */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="metric-card">
        <h3 className="text-sm font-semibold text-foreground mb-4">Dispatch Metrics (Avg. Minutes)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={dispatchMetrics}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(215,14%,46%)" }} />
            <YAxis tick={{ fontSize: 12, fill: "hsl(215,14%,46%)" }} />
            <Tooltip contentStyle={{ background: "hsl(0,0%,100%)", border: "1px solid hsl(214,20%,90%)", borderRadius: "8px", fontSize: "12px" }} />
            <Line type="monotone" dataKey="avgResponse" stroke="hsl(36,95%,54%)" strokeWidth={2} dot={{ r: 4 }} name="Response Time" />
            <Line type="monotone" dataKey="avgTravel" stroke="hsl(210,90%,52%)" strokeWidth={2} dot={{ r: 4 }} name="Travel Time" />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
};

export default Analytics;
