import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  Phone,
  Calendar,
  MapPin,
  Star,
  Target,
  BarChart3,
  Percent,
  Timer,
  ArrowRight,
} from "lucide-react";
import { jobsApi, techniciansApi, Job, Technician } from "@/lib/api";

// Role-based dashboard views (Section 8.1)
type UserRole = "owner" | "dispatcher" | "technician" | "sales";

interface MetricCard {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>("owner");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [jobsData, techsData] = await Promise.all([
        jobsApi.getAll({ limit: 10 }),
        techniciansApi.getAll(),
      ]);
      setJobs(jobsData);
      setTechnicians(techsData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Role-specific metrics (Section 8.1)
  const getMetricsForRole = (role: UserRole): MetricCard[] => {
    switch (role) {
      case "owner":
        return [
          { label: "Revenue (MTD)", value: "$127,450", change: "+12.5%", changeType: "positive", icon: <DollarSign className="w-5 h-5" /> },
          { label: "Profitability", value: "34.2%", change: "+2.1%", changeType: "positive", icon: <Percent className="w-5 h-5" /> },
          { label: "FTFR Rate", value: "87%", change: "-1.2%", changeType: "negative", icon: <Target className="w-5 h-5" /> },
          { label: "Avg Ticket", value: "$485", change: "+8.3%", changeType: "positive", icon: <TrendingUp className="w-5 h-5" /> },
          { label: "Agreement Base", value: "342", change: "+15", changeType: "positive", icon: <Users className="w-5 h-5" /> },
          { label: "Call Volume", value: "89 today", change: "+5%", changeType: "neutral", icon: <Phone className="w-5 h-5" /> },
        ];
      case "dispatcher":
        return [
          { label: "Same-Day Capacity", value: "23%", change: "3 slots", changeType: "neutral", icon: <Calendar className="w-5 h-5" /> },
          { label: "Job Aging", value: "2.3 days", change: "-0.5 days", changeType: "positive", icon: <Clock className="w-5 h-5" /> },
          { label: "Late Jobs", value: "4", change: "+2", changeType: "negative", icon: <AlertTriangle className="w-5 h-5" /> },
          { label: "Unassigned Calls", value: "7", change: "Normal", changeType: "neutral", icon: <Phone className="w-5 h-5" /> },
          { label: "Techs Available", value: `${technicians.filter(t => t.status === "available").length}/${technicians.length}`, icon: <Users className="w-5 h-5" /> },
          { label: "Active Jobs", value: `${jobs.filter(j => j.status === "in_progress").length}`, icon: <MapPin className="w-5 h-5" /> },
        ];
      case "technician":
        return [
          { label: "My Jobs Today", value: "4", icon: <Briefcase className="w-5 h-5" /> },
          { label: "Callbacks", value: "0", change: "Great!", changeType: "positive", icon: <CheckCircle className="w-5 h-5" /> },
          { label: "Upsells (MTD)", value: "$4,250", change: "+15%", changeType: "positive", icon: <TrendingUp className="w-5 h-5" /> },
          { label: "Completed Jobs", value: "87", change: "This month", changeType: "neutral", icon: <Target className="w-5 h-5" /> },
          { label: "Avg Ticket", value: "$520", change: "+$35", changeType: "positive", icon: <DollarSign className="w-5 h-5" /> },
          { label: "Rating", value: "4.9", icon: <Star className="w-5 h-5" /> },
        ];
      case "sales":
        return [
          { label: "Open Quotes", value: "23", change: "$156K value", changeType: "neutral", icon: <Briefcase className="w-5 h-5" /> },
          { label: "Close Rate", value: "42%", change: "+3%", changeType: "positive", icon: <Percent className="w-5 h-5" /> },
          { label: "Time to Close", value: "4.2 days", change: "-0.8 days", changeType: "positive", icon: <Timer className="w-5 h-5" /> },
          { label: "By Web Lead", value: "28%", icon: <TrendingUp className="w-5 h-5" /> },
          { label: "By Phone", value: "45%", icon: <Phone className="w-5 h-5" /> },
          { label: "Revenue (MTD)", value: "$45,200", change: "+22%", changeType: "positive", icon: <DollarSign className="w-5 h-5" /> },
        ];
    }
  };

  const metrics = getMetricsForRole(role);

  const getChangeColor = (type?: "positive" | "negative" | "neutral") => {
    switch (type) {
      case "positive": return "text-green-600";
      case "negative": return "text-red-600";
      default: return "text-muted-foreground";
    }
  };

  // Today's urgent items
  const urgentJobs = jobs.filter(j => j.priority === "urgent" || j.status === "urgent");
  const activeJobs = jobs.filter(j => j.status === "in_progress" || j.status === "open");

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header with Role Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome to BreezeFlow
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">View as:</span>
          <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner / GM</SelectItem>
              <SelectItem value="dispatcher">Dispatcher</SelectItem>
              <SelectItem value="technician">Technician</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="metric-card"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground">{metric.icon}</span>
              {metric.change && (
                <span className={`text-xs font-medium ${getChangeColor(metric.changeType)}`}>
                  {metric.change}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-foreground">{metric.value}</p>
            <p className="text-xs text-muted-foreground">{metric.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Urgent Items */}
        {urgentJobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="metric-card border-red-200 dark:border-red-900"
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="text-sm font-semibold text-foreground">Urgent Attention Required</h2>
            </div>
            <div className="space-y-2">
              {urgentJobs.slice(0, 3).map((job) => (
                <div
                  key={job.id}
                  className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  onClick={() => navigate(`/jobs/${job.job_number}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground text-sm">{job.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{job.title}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent Jobs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="metric-card"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Active Jobs
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/jobs")}>
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="space-y-2">
            {activeJobs.slice(0, 4).map((job) => (
              <div
                key={job.id}
                className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                onClick={() => navigate(`/jobs/${job.job_number}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{job.job_number}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        job.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                      }`}>
                        {job.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="font-medium text-foreground text-sm">{job.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{job.site_address}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Team Status */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="metric-card"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Team Status
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/technicians")}>
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="space-y-2">
            {technicians.slice(0, 4).map((tech) => (
              <div
                key={tech.id}
                className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                onClick={() => navigate(`/technicians/${tech.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      tech.status === "available" ? "bg-green-500" :
                      tech.status === "on_job" ? "bg-blue-500" :
                      tech.status === "en_route" ? "bg-yellow-500" : "bg-gray-400"
                    }`} />
                    <div>
                      <p className="font-medium text-foreground text-sm">{tech.name}</p>
                      <p className="text-xs text-muted-foreground">{tech.specialty}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {tech.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="metric-card"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate("/call-intake")}>
              <Phone className="w-4 h-4 mr-2" />
              <div className="text-left">
                <p className="text-sm font-medium">Log Call</p>
                <p className="text-xs text-muted-foreground">New intake</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate("/jobs")}>
              <Briefcase className="w-4 h-4 mr-2" />
              <div className="text-left">
                <p className="text-sm font-medium">New Job</p>
                <p className="text-xs text-muted-foreground">Create job</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate("/dispatch")}>
              <MapPin className="w-4 h-4 mr-2" />
              <div className="text-left">
                <p className="text-sm font-medium">Dispatch</p>
                <p className="text-xs text-muted-foreground">Assign techs</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate("/schedule")}>
              <Calendar className="w-4 h-4 mr-2" />
              <div className="text-left">
                <p className="text-sm font-medium">Schedule</p>
                <p className="text-xs text-muted-foreground">View calendar</p>
              </div>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
