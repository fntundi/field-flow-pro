import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
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
  Percent,
  Timer,
  ArrowRight,
  FileText,
  Calculator,
  Package,
  Wrench,
  Shield,
  BarChart3,
  Play,
  Pause,
  Navigation,
  Camera,
  ClipboardCheck,
  PhoneIncoming,
  Sparkles,
  Settings,
  RefreshCw,
  LogIn,
  LogOut,
  Car,
  MapPinned,
  Loader2,
  Smartphone,
} from "lucide-react";
import { jobsApi, techniciansApi, seedApi, timeTrackingApi, Job, Technician, GeoLocation, ShiftSession, JobTimeEntry } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import TechnicianMobileDashboard from "@/components/technician/TechnicianMobileDashboard";

// Role-based dashboard views (Section 8.1)
type UserRole = "owner" | "dispatcher" | "technician" | "sales";

interface MetricCard {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
}

interface QuickAction {
  label: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color?: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [role, setRole] = useState<UserRole>("owner");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  
  // Technician time tracking state
  const [activeShift, setActiveShift] = useState<ShiftSession | null>(null);
  const [activeJobEntry, setActiveJobEntry] = useState<JobTimeEntry | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GeoLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);

  // Get current location
  const getCurrentLocation = useCallback((): Promise<GeoLocation | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast({
          title: "Location Not Available",
          description: "Geolocation is not supported by your browser.",
          variant: "destructive",
        });
        resolve(null);
        return;
      }

      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: GeoLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setCurrentLocation(loc);
          setLocationLoading(false);
          resolve(loc);
        },
        (error) => {
          console.error("Location error:", error);
          setLocationLoading(false);
          toast({
            title: "Location Error",
            description: "Could not get your current location. Continuing without location data.",
          });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }, [toast]);

  // Fetch time tracking status for technician
  const fetchTimeTrackingStatus = useCallback(async (techId: string) => {
    try {
      const [shiftResult, jobResult] = await Promise.all([
        timeTrackingApi.getActiveShift(techId),
        timeTrackingApi.getActiveJobEntry(techId),
      ]);
      setActiveShift(shiftResult.active ? shiftResult.session : null);
      setActiveJobEntry(jobResult.active ? jobResult.entry : null);
    } catch (error) {
      console.error("Error fetching time tracking status:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // When role is technician, set up tech-specific state
  useEffect(() => {
    if (role === "technician" && technicians.length > 0) {
      // For demo, use the first available technician
      const demoTech = technicians[0];
      setSelectedTechId(demoTech.id);
      fetchTimeTrackingStatus(demoTech.id);
    }
  }, [role, technicians, fetchTimeTrackingStatus]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [jobsData, techsData] = await Promise.all([
        jobsApi.getAll({ limit: 20 }),
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

  // Clock-in/out handlers
  const handleStartShift = async () => {
    if (!selectedTechId) return;
    setClockLoading(true);
    try {
      const location = await getCurrentLocation();
      const result = await timeTrackingApi.startShift(selectedTechId, location || undefined);
      toast({
        title: "Shift Started",
        description: `You are now clocked in. ${result.location_captured ? "Location recorded." : ""}`,
      });
      await fetchTimeTrackingStatus(selectedTechId);
      await fetchData(); // Refresh technician status
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start shift",
        variant: "destructive",
      });
    } finally {
      setClockLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!selectedTechId) return;
    setClockLoading(true);
    try {
      const location = await getCurrentLocation();
      const result = await timeTrackingApi.endShift(selectedTechId, location || undefined);
      toast({
        title: "Shift Ended",
        description: `Total shift: ${result.total_shift_hours} hours. Jobs completed: ${result.jobs_completed}`,
      });
      setActiveShift(null);
      setActiveJobEntry(null);
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to end shift",
        variant: "destructive",
      });
    } finally {
      setClockLoading(false);
    }
  };

  const handleDispatchToJob = async (jobId: string) => {
    if (!selectedTechId) return;
    setClockLoading(true);
    try {
      const location = await getCurrentLocation();
      const result = await timeTrackingApi.dispatchToJob(selectedTechId, jobId, location || undefined);
      toast({
        title: "Dispatched",
        description: `En route to ${result.job_number}. ${result.estimated_travel_minutes ? `ETA: ${result.estimated_travel_minutes} min` : ""}`,
      });
      await fetchTimeTrackingStatus(selectedTechId);
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to dispatch",
        variant: "destructive",
      });
    } finally {
      setClockLoading(false);
    }
  };

  const handleArriveAtJob = async () => {
    if (!activeJobEntry) return;
    setClockLoading(true);
    try {
      const location = await getCurrentLocation();
      const result = await timeTrackingApi.arriveAtJob(activeJobEntry.id, location || undefined);
      const variance = result.travel_variance_minutes;
      const varianceText = variance !== null 
        ? (variance > 0 ? `(+${variance.toFixed(1)} min over estimate)` : `(${variance.toFixed(1)} min under estimate)`)
        : "";
      toast({
        title: "Arrived On Site",
        description: `Travel time: ${result.actual_travel_minutes} min ${varianceText}`,
      });
      await fetchTimeTrackingStatus(selectedTechId!);
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record arrival",
        variant: "destructive",
      });
    } finally {
      setClockLoading(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!activeJobEntry) return;
    setClockLoading(true);
    try {
      const location = await getCurrentLocation();
      const result = await timeTrackingApi.completeJob(activeJobEntry.id, location || undefined);
      toast({
        title: "Job Completed",
        description: `Job time: ${result.actual_job_hours} hours. Great work!`,
      });
      await fetchTimeTrackingStatus(selectedTechId!);
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete job",
        variant: "destructive",
      });
    } finally {
      setClockLoading(false);
    }
  };

  const handleSeedDemoData = async () => {
    try {
      const result = await seedApi.seed();
      toast({
        title: "Demo Data Loaded",
        description: `Created ${result.technicians} technicians, ${result.jobs} jobs, and ${result.tasks} tasks for demonstration.`,
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load demo data.",
        variant: "destructive",
      });
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
          { label: "Agreement Base", value: "342", change: "+15", changeType: "positive", icon: <Shield className="w-5 h-5" /> },
          { label: "Call Volume", value: "89 today", change: "+5%", changeType: "neutral", icon: <Phone className="w-5 h-5" /> },
        ];
      case "dispatcher":
        return [
          { label: "Same-Day Capacity", value: "23%", change: "3 slots", changeType: "neutral", icon: <Calendar className="w-5 h-5" /> },
          { label: "Job Aging", value: "2.3 days", change: "-0.5 days", changeType: "positive", icon: <Clock className="w-5 h-5" /> },
          { label: "Late Jobs", value: "4", change: "+2", changeType: "negative", icon: <AlertTriangle className="w-5 h-5" /> },
          { label: "Unassigned Calls", value: "7", change: "Normal", changeType: "neutral", icon: <PhoneIncoming className="w-5 h-5" /> },
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
          { label: "Open Quotes", value: "23", change: "$156K value", changeType: "neutral", icon: <Calculator className="w-5 h-5" /> },
          { label: "Close Rate", value: "42%", change: "+3%", changeType: "positive", icon: <Percent className="w-5 h-5" /> },
          { label: "Time to Close", value: "4.2 days", change: "-0.8 days", changeType: "positive", icon: <Timer className="w-5 h-5" /> },
          { label: "By Web Lead", value: "28%", icon: <TrendingUp className="w-5 h-5" /> },
          { label: "By Phone", value: "45%", icon: <Phone className="w-5 h-5" /> },
          { label: "Revenue (MTD)", value: "$45,200", change: "+22%", changeType: "positive", icon: <DollarSign className="w-5 h-5" /> },
        ];
    }
  };

  // Role-specific quick actions based on permissions
  const getQuickActionsForRole = (role: UserRole): QuickAction[] => {
    switch (role) {
      case "owner":
        // Owner can do everything - focus on high-level oversight
        return [
          { label: "Analytics", description: "View reports", icon: <BarChart3 className="w-4 h-4" />, path: "/analytics" },
          { label: "Agreements", description: "Manage contracts", icon: <Shield className="w-4 h-4" />, path: "/agreements" },
          { label: "Invoices", description: "Review billing", icon: <FileText className="w-4 h-4" />, path: "/invoices" },
          { label: "Inventory", description: "Stock levels", icon: <Package className="w-4 h-4" />, path: "/inventory" },
          { label: "Team", description: "Manage techs", icon: <Users className="w-4 h-4" />, path: "/technicians" },
          { label: "Settings", description: "Configuration", icon: <Settings className="w-4 h-4" />, path: "/settings" },
        ];
      case "dispatcher":
        // Dispatcher focuses on scheduling and assignment
        return [
          { label: "Log Call", description: "New intake", icon: <PhoneIncoming className="w-4 h-4" />, path: "/call-intake", color: "text-green-600" },
          { label: "Dispatch", description: "Assign techs", icon: <MapPin className="w-4 h-4" />, path: "/dispatch", color: "text-blue-600" },
          { label: "Schedule", description: "View calendar", icon: <Calendar className="w-4 h-4" />, path: "/schedule" },
          { label: "Jobs", description: "All jobs", icon: <Briefcase className="w-4 h-4" />, path: "/jobs" },
          { label: "Technicians", description: "Team status", icon: <Users className="w-4 h-4" />, path: "/technicians" },
          { label: "Maintenance", description: "Recurring jobs", icon: <Wrench className="w-4 h-4" />, path: "/maintenance" },
        ];
      case "technician":
        // Technician focuses on field work
        return [
          { label: "My Jobs", description: "Today's work", icon: <Briefcase className="w-4 h-4" />, path: "/jobs?status=active", color: "text-blue-600" },
          { label: "Start Job", description: "Clock in", icon: <Play className="w-4 h-4" />, path: "/jobs", color: "text-green-600" },
          { label: "Add Photos", description: "Job evidence", icon: <Camera className="w-4 h-4" />, path: "/checklists" },
          { label: "Checklist", description: "QC items", icon: <ClipboardCheck className="w-4 h-4" />, path: "/checklists" },
          { label: "Inventory", description: "Truck stock", icon: <Package className="w-4 h-4" />, path: "/inventory" },
          { label: "My Profile", description: "Update info", icon: <Users className="w-4 h-4" />, path: "/technicians" },
        ];
      case "sales":
        // Sales focuses on quotes and customer acquisition
        return [
          { label: "New Quote", description: "Create estimate", icon: <Calculator className="w-4 h-4" />, path: "/estimates", color: "text-green-600" },
          { label: "Leads", description: "Follow up", icon: <Phone className="w-4 h-4" />, path: "/leads", color: "text-blue-600" },
          { label: "Customers", description: "Contact list", icon: <Users className="w-4 h-4" />, path: "/customers" },
          { label: "Estimates", description: "Open quotes", icon: <FileText className="w-4 h-4" />, path: "/estimates" },
          { label: "Agreements", description: "Service plans", icon: <Shield className="w-4 h-4" />, path: "/agreements" },
          { label: "Analytics", description: "Sales metrics", icon: <BarChart3 className="w-4 h-4" />, path: "/analytics" },
        ];
    }
  };

  const metrics = getMetricsForRole(role);
  const quickActions = getQuickActionsForRole(role);

  const getChangeColor = (type?: "positive" | "negative" | "neutral") => {
    switch (type) {
      case "positive": return "text-green-600";
      case "negative": return "text-red-600";
      default: return "text-muted-foreground";
    }
  };

  // Role-specific job filters
  const getJobsForRole = () => {
    switch (role) {
      case "dispatcher":
        return jobs.filter(j => j.status === "open" || j.status === "in_progress");
      case "technician":
        // Show both active jobs and jobs available for dispatch
        return jobs.filter(j => j.status === "in_progress" || j.status === "open" || j.status === "urgent").slice(0, 6);
      case "sales":
        return jobs.filter(j => j.status === "pending" || j.priority === "high").slice(0, 4);
      default:
        return jobs.filter(j => j.status === "in_progress" || j.status === "open").slice(0, 4);
    }
  };

  // Jobs available for dispatch (for technician time tracking)
  const availableJobsForDispatch = jobs.filter(j => 
    j.status === "open" || j.status === "in_progress" || j.status === "urgent"
  ).slice(0, 6);

  const urgentJobs = jobs.filter(j => j.priority === "urgent" || j.status === "urgent");
  const displayJobs = getJobsForRole();

  // Role-specific list titles
  const getListTitle = () => {
    switch (role) {
      case "dispatcher": return "Needs Dispatch";
      case "technician": return "My Active Jobs";
      case "sales": return "Follow-up Required";
      default: return "Active Jobs";
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header with Role Selector and Settings */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome to BreezeFlow
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Demo Mode Toggle */}
          {demoMode && (
            <Button variant="outline" size="sm" onClick={handleSeedDemoData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Load Demo Data
            </Button>
          )}
          
          {/* AI Features Toggle - Only visible to Owner/Admin */}
          {role === "owner" && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
              <Sparkles className={`w-4 h-4 ${aiEnabled ? "text-purple-500" : "text-muted-foreground"}`} />
              <Label htmlFor="ai-toggle" className="text-xs cursor-pointer">AI</Label>
              <Switch
                id="ai-toggle"
                checked={aiEnabled}
                onCheckedChange={setAiEnabled}
                className="scale-75"
              />
            </div>
          )}

          {/* Role Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">View as:</span>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger className="w-[140px]">
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
      </div>

      {/* AI Features Banner */}
      {aiEnabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-200 dark:border-purple-800 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">AI Features Enabled</p>
              <p className="text-xs text-muted-foreground">
                Smart scheduling suggestions, automated job summaries, and predictive maintenance alerts are now active.
              </p>
            </div>
            <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
              Beta
            </Badge>
          </div>
        </motion.div>
      )}

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

      {/* Technician Time Clock Section - Only for technician role */}
      {role === "technician" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          {/* Shift Clock Card */}
          <div className="metric-card border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-semibold text-foreground">Shift Time Clock</h2>
              {activeShift && (
                <Badge className="bg-green-100 text-green-700 border-green-300 ml-auto">
                  On Shift
                </Badge>
              )}
            </div>
            
            {!activeShift ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Clock in to start your shift. Your location will be recorded for travel analytics.
                </p>
                <Button
                  onClick={handleStartShift}
                  disabled={clockLoading || locationLoading}
                  className="w-full bg-green-600 hover:bg-green-700"
                  data-testid="shift-clock-in-btn"
                >
                  {clockLoading || locationLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4 mr-2" />
                  )}
                  Clock In for Shift
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Shift Started</p>
                      <p className="font-medium text-foreground">
                        {new Date(activeShift.shift_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-medium text-foreground">
                        {(() => {
                          const start = new Date(activeShift.shift_start);
                          const now = new Date();
                          const diff = Math.floor((now.getTime() - start.getTime()) / 60000);
                          const hours = Math.floor(diff / 60);
                          const mins = diff % 60;
                          return `${hours}h ${mins}m`;
                        })()}
                      </p>
                    </div>
                  </div>
                  {activeShift.shift_start_location && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      Location recorded
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleEndShift}
                  disabled={clockLoading || !!activeJobEntry}
                  variant="destructive"
                  className="w-full"
                  data-testid="shift-clock-out-btn"
                >
                  {clockLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4 mr-2" />
                  )}
                  Clock Out from Shift
                </Button>
                {activeJobEntry && (
                  <p className="text-xs text-amber-600 text-center">
                    Complete your current job before ending shift
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Job Time Clock Card */}
          <div className="metric-card border-2 border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-orange-600" />
              <h2 className="text-sm font-semibold text-foreground">Job Time Tracking</h2>
              {activeJobEntry && (
                <Badge className={`ml-auto ${
                  activeJobEntry.status === "traveling" ? "bg-yellow-100 text-yellow-700 border-yellow-300" :
                  "bg-blue-100 text-blue-700 border-blue-300"
                }`}>
                  {activeJobEntry.status === "traveling" ? "En Route" : "On Site"}
                </Badge>
              )}
            </div>

            {!activeShift ? (
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Clock in for your shift first to start tracking job time.
                </p>
              </div>
            ) : !activeJobEntry ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Select a job to dispatch to. Travel time will be tracked from your current location.
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableJobsForDispatch.length > 0 ? availableJobsForDispatch.map((job) => (
                    <div
                      key={job.id}
                      className="p-3 bg-muted/50 rounded-lg flex items-center justify-between hover:bg-muted transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">{job.job_number}</span>
                        </div>
                        <p className="font-medium text-foreground text-sm">{job.customer_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{job.site_address}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleDispatchToJob(job.id)}
                        disabled={clockLoading}
                        className="ml-2 bg-orange-600 hover:bg-orange-700"
                        data-testid={`dispatch-to-job-${job.job_number}`}
                      >
                        {clockLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Car className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No jobs assigned. Load demo data to see sample jobs.
                    </p>
                  )}
                </div>
              </div>
            ) : activeJobEntry.status === "traveling" ? (
              <div className="space-y-3">
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Car className="w-4 h-4 text-yellow-600" />
                    <p className="font-medium text-foreground">En Route to Job</p>
                  </div>
                  <p className="text-sm text-foreground font-mono">{activeJobEntry.job_number}</p>
                  {activeJobEntry.estimated_travel_minutes && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Estimated: {activeJobEntry.estimated_travel_minutes.toFixed(0)} min
                      {activeJobEntry.estimated_route_distance_miles && (
                        <> ({activeJobEntry.estimated_route_distance_miles.toFixed(1)} mi)</>
                      )}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Timer className="w-3 h-3" />
                    Departed: {new Date(activeJobEntry.dispatch_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <Button
                  onClick={handleArriveAtJob}
                  disabled={clockLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  data-testid="arrive-at-job-btn"
                >
                  {clockLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <MapPinned className="w-4 h-4 mr-2" />
                  )}
                  I've Arrived On Site
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="w-4 h-4 text-blue-600" />
                    <p className="font-medium text-foreground">Working On Site</p>
                  </div>
                  <p className="text-sm text-foreground font-mono">{activeJobEntry.job_number}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Travel Time</p>
                      <p className="text-sm font-medium">{activeJobEntry.actual_travel_minutes?.toFixed(0) || "N/A"} min</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">On Site Since</p>
                      <p className="text-sm font-medium">
                        {new Date(activeJobEntry.job_start!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  {activeJobEntry.travel_variance_minutes !== null && activeJobEntry.travel_variance_minutes !== undefined && (
                    <div className={`mt-2 text-xs flex items-center gap-1 ${
                      activeJobEntry.travel_variance_minutes > 5 ? "text-red-600" :
                      activeJobEntry.travel_variance_minutes < -5 ? "text-green-600" : "text-muted-foreground"
                    }`}>
                      {activeJobEntry.travel_variance_minutes > 0 ? "+" : ""}
                      {activeJobEntry.travel_variance_minutes.toFixed(1)} min vs estimate
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleCompleteJob}
                  disabled={clockLoading}
                  className="w-full bg-green-600 hover:bg-green-700"
                  data-testid="complete-job-btn"
                >
                  {clockLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Complete Job
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Urgent Items - Show for dispatcher and owner */}
        {(role === "owner" || role === "dispatcher") && urgentJobs.length > 0 && (
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

        {/* Jobs List - Role specific */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="metric-card"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              {getListTitle()}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/jobs")}>
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="space-y-2">
            {displayJobs.length > 0 ? displayJobs.map((job) => (
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
                        job.status === "in_progress" ? "bg-blue-100 text-blue-700" : 
                        job.status === "urgent" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
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
            )) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No jobs to display. Click "Load Demo Data" to see sample data.
              </p>
            )}
          </div>
        </motion.div>

        {/* Team Status - Show for dispatcher and owner */}
        {(role === "owner" || role === "dispatcher") && (
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
              {technicians.length > 0 ? technicians.slice(0, 4).map((tech) => (
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
              )) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No technicians. Load demo data to see team.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Role-Specific Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="metric-card"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Quick Actions
            <span className="text-xs font-normal text-muted-foreground ml-2">
              ({role === "owner" ? "Admin" : role.charAt(0).toUpperCase() + role.slice(1)})
            </span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                className="justify-start h-auto py-3 px-3"
                onClick={() => navigate(action.path)}
              >
                <span className={action.color || "text-muted-foreground"}>
                  {action.icon}
                </span>
                <div className="text-left ml-2">
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground">{action.description}</p>
                </div>
              </Button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
