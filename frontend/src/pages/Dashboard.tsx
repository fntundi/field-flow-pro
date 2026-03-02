import { motion } from "framer-motion";
import MetricCard from "@/components/MetricCard";
import StatusBadge from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import {
  Briefcase, DollarSign, Users, TrendingUp, Clock, CheckCircle2, AlertTriangle, MapPin,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const revenueData = [
  { month: "Sep", revenue: 42000 },
  { month: "Oct", revenue: 48000 },
  { month: "Nov", revenue: 55000 },
  { month: "Dec", revenue: 38000 },
  { month: "Jan", revenue: 62000 },
  { month: "Feb", revenue: 58000 },
];

const jobTypeData = [
  { name: "Residential Install", value: 42 },
  { name: "Commercial Repair", value: 28 },
  { name: "Maintenance", value: 18 },
  { name: "Emergency", value: 12 },
];

const CHART_COLORS = [
  "hsl(36, 95%, 54%)",
  "hsl(210, 90%, 52%)",
  "hsl(152, 60%, 40%)",
  "hsl(280, 60%, 55%)",
];

const recentJobs = [
  { id: "JOB-1042", customer: "Sarah Mitchell", type: "Residential Install", tech: "Mike Johnson", status: "in_progress" as const, time: "2:30 PM" },
  { id: "JOB-1041", customer: "Acme Corp", type: "Commercial Repair", tech: "Lisa Chen", status: "complete" as const, time: "11:00 AM" },
  { id: "JOB-1040", customer: "James Rivera", type: "Maintenance", tech: "Tom Brown", status: "urgent" as const, time: "9:15 AM" },
  { id: "JOB-1039", customer: "Metro Office Park", type: "Commercial Install", tech: "Amy Davis", status: "open" as const, time: "Yesterday" },
  { id: "JOB-1038", customer: "David Park", type: "Residential Repair", tech: "Mike Johnson", status: "complete" as const, time: "Yesterday" },
];

const techActivity = [
  { name: "Mike Johnson", jobs: 8, rating: 4.9, status: "On Job" },
  { name: "Lisa Chen", jobs: 6, rating: 4.8, status: "Available" },
  { name: "Tom Brown", jobs: 7, rating: 4.7, status: "On Job" },
  { name: "Amy Davis", jobs: 5, rating: 4.9, status: "En Route" },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your HVAC operations</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Feb 27, 2026</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Active Jobs" value="24" change="+3 from yesterday" changeType="positive" icon={Briefcase} index={0} href="/jobs?status=active" />
        <MetricCard title="Revenue (MTD)" value="$58,420" change="+12.3% vs last month" changeType="positive" icon={DollarSign} index={1} href="/analytics" />
        <MetricCard title="Technicians Active" value="8/12" change="4 available" changeType="neutral" icon={Users} index={2} href="/technicians" />
        <MetricCard title="Avg Completion" value="3.2 hrs" change="-8% improvement" changeType="positive" icon={Clock} index={3} href="/analytics" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="metric-card lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(215, 14%, 46%)" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(215, 14%, 46%)" }} tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]} contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(214, 20%, 90%)", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="revenue" fill="hsl(36, 95%, 54%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Job Type Distribution */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="metric-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Job Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={jobTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {jobTypeData.map((_, index) => (<Cell key={index} fill={CHART_COLORS[index]} />))}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(214, 20%, 90%)", borderRadius: "8px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {jobTypeData.map((item, i) => (
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

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Jobs */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="metric-card lg:col-span-2 !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Recent Jobs</h3>
            <Link to="/jobs" className="text-xs text-accent hover:underline">View all →</Link>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Job ID</th><th>Customer</th><th>Type</th><th>Technician</th><th>Status</th><th>Time</th></tr>
            </thead>
            <tbody>
              {recentJobs.map((job) => (
                <tr key={job.id} className="cursor-pointer group">
                  <td>
                    <Link to={`/jobs/${job.id}`} className="font-mono text-xs font-medium text-accent hover:underline">{job.id}</Link>
                  </td>
                  <td>{job.customer}</td>
                  <td className="text-muted-foreground">{job.type}</td>
                  <td>
                    <Link to="/technicians" className="hover:text-accent transition-colors">{job.tech}</Link>
                  </td>
                  <td><StatusBadge status={job.status} /></td>
                  <td className="text-muted-foreground">{job.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Tech Activity */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Technician Activity</h3>
            <Link to="/technicians" className="text-xs text-accent hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {techActivity.map((tech) => (
              <Link key={tech.name} to="/technicians" className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 hover:bg-muted/20 -mx-2 px-2 rounded transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground">{tech.name}</p>
                  <p className="text-xs text-muted-foreground">{tech.jobs} jobs this week · ⭐ {tech.rating}</p>
                </div>
                <StatusBadge status={tech.status === "Available" ? "open" : tech.status === "En Route" ? "pending" : "in_progress"} label={tech.status} />
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
