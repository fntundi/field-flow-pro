import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, LayoutGrid, List, RefreshCw, Calendar, Clock, AlertTriangle } from "lucide-react";
import { jobsApi, Job, seedApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ContactQuickActions } from "@/components/ContactCustomerMenu";

// Job type categories per BreezeFlow requirements
const jobTypeCategories = {
  service: ["Residential Repair", "Commercial Repair", "Emergency Repair", "Maintenance", "Diagnostic"],
  install: ["Residential Install", "Commercial Install", "New Construction", "Replacement"],
};

const Jobs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(searchParams.get("status"));
  const [boardType, setBoardType] = useState<"all" | "service" | "install">(
    (searchParams.get("board") as "all" | "service" | "install") || "all"
  );
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  useEffect(() => {
    fetchJobs();
  }, [statusFilter, boardType]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const data = await jobsApi.getAll({
        status: statusFilter || undefined,
        search: search || undefined,
      });
      
      // Filter by board type
      let filteredData = data;
      if (boardType === "service") {
        filteredData = data.filter(job => 
          jobTypeCategories.service.some(t => job.job_type.toLowerCase().includes(t.toLowerCase()))
        );
      } else if (boardType === "install") {
        filteredData = data.filter(job => 
          jobTypeCategories.install.some(t => job.job_type.toLowerCase().includes(t.toLowerCase()))
        );
      }
      
      setJobs(filteredData);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch jobs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    try {
      const result = await seedApi.seed();
      toast({
        title: "Data Seeded",
        description: `Created ${result.technicians} technicians, ${result.jobs} jobs, and ${result.tasks} tasks.`,
      });
      fetchJobs();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to seed data.",
        variant: "destructive",
      });
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchJobs();
  };

  const handleBoardChange = (value: string) => {
    setBoardType(value as "all" | "service" | "install");
    setSearchParams(prev => {
      if (value === "all") {
        prev.delete("board");
      } else {
        prev.set("board", value);
      }
      return prev;
    });
  };

  const filteredJobs = jobs.filter((job) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      job.job_number.toLowerCase().includes(searchLower) ||
      job.customer_name.toLowerCase().includes(searchLower) ||
      job.site_address.toLowerCase().includes(searchLower) ||
      job.title.toLowerCase().includes(searchLower)
    );
  });

  const statusTabs = [
    { key: null, label: "All" },
    { key: "active", label: "Active" },
    { key: "open", label: "Open" },
    { key: "in_progress", label: "In Progress" },
    { key: "complete", label: "Complete" },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "text-red-500";
      case "high":
        return "text-orange-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getJobTypeBadge = (jobType: string) => {
    const isInstall = jobTypeCategories.install.some(t => 
      jobType.toLowerCase().includes(t.toLowerCase())
    );
    return isInstall ? (
      <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
        Install
      </Badge>
    ) : (
      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
        Service
      </Badge>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Manage service calls and install projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedData}
            className="hidden md:flex"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Seed Data
          </Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">New Job</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Board Type Tabs - Service vs Install (BreezeFlow 2.2) */}
      <Tabs value={boardType} onValueChange={handleBoardChange}>
        <TabsList className="h-auto p-1">
          <TabsTrigger value="all" className="text-xs sm:text-sm">
            All Jobs
          </TabsTrigger>
          <TabsTrigger value="service" className="text-xs sm:text-sm">
            <Clock className="w-3 h-3 mr-1.5" />
            Service Board
          </TabsTrigger>
          <TabsTrigger value="install" className="text-xs sm:text-sm">
            <Calendar className="w-3 h-3 mr-1.5" />
            Install Board
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </form>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 overflow-x-auto">
          {statusTabs.map((tab) => (
            <button
              key={tab.key || "all"}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                statusFilter === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="hidden md:flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === "list"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === "grid"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Jobs Display */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading jobs...</div>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-muted-foreground mb-4">No jobs found</p>
          <Button variant="outline" onClick={handleSeedData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Load Sample Data
          </Button>
        </div>
      ) : viewMode === "list" ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="metric-card !p-0 overflow-hidden"
        >
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Job ID</th>
                  <th className="text-left">Customer</th>
                  <th className="text-left">Address</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Scheduled</th>
                  <th className="text-left">Priority</th>
                  <th className="text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr
                    key={job.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/jobs/${job.job_number}`)}
                  >
                    <td className="font-mono text-xs font-medium">{job.job_number}</td>
                    <td className="font-medium">{job.customer_name}</td>
                    <td className="text-muted-foreground text-xs">
                      {job.site_address}{job.site_city ? `, ${job.site_city}` : ""}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {getJobTypeBadge(job.job_type)}
                        <span className="text-muted-foreground text-xs">{job.job_type}</span>
                      </div>
                    </td>
                    <td className="text-muted-foreground text-xs">
                      {job.scheduled_date || "Not scheduled"}
                    </td>
                    <td>
                      <span className={`text-xs font-medium capitalize flex items-center gap-1 ${getPriorityColor(job.priority)}`}>
                        {job.priority === "urgent" && <AlertTriangle className="w-3 h-3" />}
                        {job.priority}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={job.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden divide-y divide-border">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="p-4 cursor-pointer hover:bg-muted/50 active:bg-muted"
                onClick={() => navigate(`/jobs/${job.job_number}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {job.job_number}
                      </span>
                      {getJobTypeBadge(job.job_type)}
                    </div>
                    <h3 className="font-medium text-foreground">{job.customer_name}</h3>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                  {job.site_address}{job.site_city ? `, ${job.site_city}` : ""}
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{job.job_type}</span>
                  <span className={`font-medium capitalize flex items-center gap-1 ${getPriorityColor(job.priority)}`}>
                    {job.priority === "urgent" && <AlertTriangle className="w-3 h-3" />}
                    {job.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="metric-card cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/jobs/${job.job_number}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground">
                      {job.job_number}
                    </span>
                    {getJobTypeBadge(job.job_type)}
                  </div>
                  <h3 className="font-semibold text-foreground">{job.customer_name}</h3>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {job.title}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                {job.site_address}{job.site_city ? `, ${job.site_city}` : ""}
              </p>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">{job.job_type}</span>
                <span className={`text-xs font-medium capitalize flex items-center gap-1 ${getPriorityColor(job.priority)}`}>
                  {job.priority === "urgent" && <AlertTriangle className="w-3 h-3" />}
                  {job.priority}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Jobs;
