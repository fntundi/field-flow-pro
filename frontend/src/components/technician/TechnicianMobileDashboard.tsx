import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Clock,
  Briefcase,
  Package,
  Calculator,
  LogIn,
  LogOut,
  Car,
  MapPinned,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Wrench,
  ClipboardCheck,
  ChevronRight,
  Plus,
  Minus,
  Thermometer,
  Home,
  Building,
  Snowflake,
  Flame,
  Save,
  RotateCcw,
} from "lucide-react";
import {
  timeTrackingApi,
  stockCheckApi,
  jloadApi,
  trucksApi,
  jobsApi,
  GeoLocation,
  ShiftSession,
  JobTimeEntry,
  Truck,
  TruckInventoryItem,
  JLoadQuickEstimate,
  Job,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface TechnicianMobileDashboardProps {
  technicianId: string;
  technicianName: string;
}

export const TechnicianMobileDashboard = ({
  technicianId,
  technicianName,
}: TechnicianMobileDashboardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State
  const [activeTab, setActiveTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(false);
  
  // Time tracking state
  const [activeShift, setActiveShift] = useState<ShiftSession | null>(null);
  const [activeJobEntry, setActiveJobEntry] = useState<JobTimeEntry | null>(null);
  
  // Stock check state
  const [stockCheckRequired, setStockCheckRequired] = useState(false);
  const [truck, setTruck] = useState<Truck | null>(null);
  const [truckInventory, setTruckInventory] = useState<TruckInventoryItem[]>([]);
  const [stockCheckItems, setStockCheckItems] = useState<Record<string, number>>({});
  const [stockCheckOpen, setStockCheckOpen] = useState(false);
  
  // J-Load state
  const [jloadOpen, setJloadOpen] = useState(false);
  const [jloadResult, setJloadResult] = useState<JLoadQuickEstimate | null>(null);
  const [jloadForm, setJloadForm] = useState({
    square_footage: 2000,
    climate_zone: "3",
    building_type: "residential" as const,
    building_age: "20_years" as const,
    insulation_quality: "average" as const,
    num_floors: 1,
    ceiling_height: 8,
    num_windows: 10,
    window_type: "double" as const,
  });
  
  // Jobs state
  const [jobs, setJobs] = useState<Job[]>([]);

  // Get current location
  const getCurrentLocation = useCallback((): Promise<GeoLocation | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }, []);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Check active shift
        const shiftResult = await timeTrackingApi.getActiveShift(technicianId);
        setActiveShift(shiftResult.active ? shiftResult.session : null);
        
        // Check active job
        const jobResult = await timeTrackingApi.getActiveJobEntry(technicianId);
        setActiveJobEntry(jobResult.active ? jobResult.entry : null);
        
        // Check if stock check required
        const stockResult = await stockCheckApi.checkRequired(technicianId);
        setStockCheckRequired(stockResult.required);
        if (stockResult.truck_id) {
          setTruck({ id: stockResult.truck_id, truck_number: "", name: stockResult.truck_name || "", status: "active" } as Truck);
          if (stockResult.items) {
            setTruckInventory(stockResult.items);
            // Initialize stock check items with current quantities
            const initial: Record<string, number> = {};
            stockResult.items.forEach(item => {
              initial[item.item_id] = item.quantity;
            });
            setStockCheckItems(initial);
          }
        }
        
        // Fetch jobs
        const jobsData = await jobsApi.getAll({ limit: 10 });
        setJobs(jobsData.filter(j => j.status === "open" || j.status === "in_progress" || j.status === "urgent"));
        
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [technicianId]);

  // Clock handlers
  const handleStartShift = async () => {
    setClockLoading(true);
    try {
      const location = await getCurrentLocation();
      const result = await timeTrackingApi.startShift(technicianId, location || undefined);
      toast({
        title: "Shift Started",
        description: `You are now clocked in. ${result.location_captured ? "Location recorded." : ""}`,
      });
      const shiftResult = await timeTrackingApi.getActiveShift(technicianId);
      setActiveShift(shiftResult.active ? shiftResult.session : null);
      
      // Check stock check again
      const stockResult = await stockCheckApi.checkRequired(technicianId);
      setStockCheckRequired(stockResult.required);
      if (stockResult.required) {
        setStockCheckOpen(true);
      }
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
    if (activeJobEntry) {
      toast({
        title: "Cannot End Shift",
        description: "Please complete your current job first.",
        variant: "destructive",
      });
      return;
    }
    
    setClockLoading(true);
    try {
      const location = await getCurrentLocation();
      const result = await timeTrackingApi.endShift(technicianId, location || undefined);
      toast({
        title: "Shift Ended",
        description: `Total: ${result.total_shift_hours} hours, ${result.jobs_completed} jobs completed.`,
      });
      setActiveShift(null);
      setActiveJobEntry(null);
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
    setClockLoading(true);
    try {
      const location = await getCurrentLocation();
      const result = await timeTrackingApi.dispatchToJob(technicianId, jobId, location || undefined);
      toast({
        title: "Dispatched",
        description: `En route to ${result.job_number}. ${result.estimated_travel_minutes ? `ETA: ${result.estimated_travel_minutes} min` : ""}`,
      });
      const jobResult = await timeTrackingApi.getActiveJobEntry(technicianId);
      setActiveJobEntry(jobResult.active ? jobResult.entry : null);
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
      toast({
        title: "Arrived On Site",
        description: `Travel time: ${result.actual_travel_minutes} min`,
      });
      const jobResult = await timeTrackingApi.getActiveJobEntry(technicianId);
      setActiveJobEntry(jobResult.active ? jobResult.entry : null);
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
      setActiveJobEntry(null);
      // Refresh jobs
      const jobsData = await jobsApi.getAll({ limit: 10 });
      setJobs(jobsData.filter(j => j.status === "open" || j.status === "in_progress" || j.status === "urgent"));
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

  // Stock check handlers
  const handleStockCheckSubmit = async () => {
    if (!truck) return;
    
    setClockLoading(true);
    try {
      const itemsChecked = truckInventory.map(item => ({
        item_id: item.item_id,
        item_name: item.item_name,
        sku: item.sku,
        expected_qty: item.quantity,
        actual_qty: stockCheckItems[item.item_id] || 0,
        min_threshold: item.min_threshold,
        variance: (stockCheckItems[item.item_id] || 0) - item.quantity,
      }));
      
      await stockCheckApi.submit({
        truck_id: truck.id,
        technician_id: technicianId,
        shift_session_id: activeShift?.id,
        check_type: "shift_start",
        items_checked: itemsChecked,
      });
      
      toast({
        title: "Stock Check Complete",
        description: "Your truck inventory has been updated.",
      });
      
      setStockCheckRequired(false);
      setStockCheckOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit stock check",
        variant: "destructive",
      });
    } finally {
      setClockLoading(false);
    }
  };

  // J-Load handlers
  const handleJLoadCalculate = async () => {
    setClockLoading(true);
    try {
      const result = await jloadApi.quickEstimate(jloadForm, technicianId);
      setJloadResult(result);
      toast({
        title: "Load Calculation Complete",
        description: `Recommended: ${result.recommended_tonnage} ton system`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to calculate load",
        variant: "destructive",
      });
    } finally {
      setClockLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Greeting & Status */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-4">
        <p className="text-sm opacity-80">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"},</p>
        <h1 className="text-xl font-bold">{technicianName}</h1>
        <div className="flex items-center gap-2 mt-2">
          {activeShift ? (
            <Badge className="bg-green-500 text-white border-green-400">On Shift</Badge>
          ) : (
            <Badge variant="outline" className="bg-white/20 text-white border-white/40">Off Duty</Badge>
          )}
          {activeJobEntry && (
            <Badge className={activeJobEntry.status === "traveling" ? "bg-yellow-500" : "bg-blue-500"}>
              {activeJobEntry.status === "traveling" ? "En Route" : "On Site"}
            </Badge>
          )}
        </div>
      </div>

      {/* Stock Check Alert */}
      {stockCheckRequired && activeShift && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium text-amber-800">Stock Check Required</p>
              <p className="text-sm text-amber-600">Complete your truck inventory check before starting jobs.</p>
            </div>
            <Button size="sm" onClick={() => setStockCheckOpen(true)} className="bg-amber-600 hover:bg-amber-700">
              Start
            </Button>
          </div>
        </motion.div>
      )}

      {/* Main Clock-In Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold">Time Clock</h2>
        </div>
        
        {!activeShift ? (
          <Button
            onClick={handleStartShift}
            disabled={clockLoading}
            className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
            data-testid="mobile-clock-in-btn"
          >
            {clockLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <LogIn className="w-5 h-5 mr-2" />}
            Clock In for Shift
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <div>
                <p className="text-xs text-muted-foreground">Shift Started</p>
                <p className="font-medium">{new Date(activeShift.shift_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-medium">
                  {(() => {
                    const start = new Date(activeShift.shift_start);
                    const diff = Math.floor((Date.now() - start.getTime()) / 60000);
                    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
                  })()}
                </p>
              </div>
            </div>
            
            <Button
              onClick={handleEndShift}
              disabled={clockLoading || !!activeJobEntry}
              variant="destructive"
              className="w-full"
              data-testid="mobile-clock-out-btn"
            >
              {clockLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <LogOut className="w-5 h-5 mr-2" />}
              End Shift
            </Button>
          </div>
        )}
      </div>

      {/* Active Job Card */}
      {activeJobEntry && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="w-5 h-5 text-orange-600" />
            <h2 className="font-semibold">Current Job</h2>
            <Badge className={activeJobEntry.status === "traveling" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}>
              {activeJobEntry.status === "traveling" ? "En Route" : "On Site"}
            </Badge>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-3 mb-3">
            <p className="font-mono text-sm text-muted-foreground">{activeJobEntry.job_number}</p>
            {activeJobEntry.status === "traveling" ? (
              <div className="mt-2">
                {activeJobEntry.estimated_travel_minutes && (
                  <p className="text-sm">ETA: {activeJobEntry.estimated_travel_minutes.toFixed(0)} min</p>
                )}
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Travel</p>
                  <p className="font-medium">{activeJobEntry.actual_travel_minutes?.toFixed(0) || 0} min</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Started</p>
                  <p className="font-medium">{new Date(activeJobEntry.job_start!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            )}
          </div>
          
          {activeJobEntry.status === "traveling" ? (
            <Button onClick={handleArriveAtJob} disabled={clockLoading} className="w-full bg-blue-600 hover:bg-blue-700">
              {clockLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <MapPinned className="w-5 h-5 mr-2" />}
              I've Arrived
            </Button>
          ) : (
            <Button onClick={handleCompleteJob} disabled={clockLoading} className="w-full bg-green-600 hover:bg-green-700">
              {clockLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
              Complete Job
            </Button>
          )}
        </motion.div>
      )}

      {/* Jobs List */}
      {activeShift && !activeJobEntry && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold">Available Jobs</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/jobs")}>
              View All
            </Button>
          </div>
          
          <div className="space-y-2">
            {jobs.slice(0, 5).map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{job.job_number}</span>
                    <Badge variant="outline" className="text-xs">
                      {job.status === "urgent" ? "Urgent" : job.priority}
                    </Badge>
                  </div>
                  <p className="font-medium text-sm">{job.customer_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{job.site_address}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleDispatchToJob(job.id)}
                  disabled={clockLoading || stockCheckRequired}
                  className="ml-2 bg-orange-600 hover:bg-orange-700"
                >
                  <Car className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {jobs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No jobs available</p>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-20 flex-col"
          onClick={() => setJloadOpen(true)}
        >
          <Calculator className="w-6 h-6 mb-1" />
          <span className="text-xs">J-Load Calculator</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex-col"
          onClick={() => truck && setStockCheckOpen(true)}
        >
          <Package className="w-6 h-6 mb-1" />
          <span className="text-xs">Truck Inventory</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex-col"
          onClick={() => navigate("/technicians")}
        >
          <ClipboardCheck className="w-6 h-6 mb-1" />
          <span className="text-xs">Checklists</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex-col"
          onClick={() => navigate("/jobs")}
        >
          <Briefcase className="w-6 h-6 mb-1" />
          <span className="text-xs">All Jobs</span>
        </Button>
      </div>

      {/* Stock Check Sheet */}
      <Sheet open={stockCheckOpen} onOpenChange={setStockCheckOpen}>
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Truck Stock Check
            </SheetTitle>
            <SheetDescription>
              Verify your truck inventory before starting your shift.
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-4 space-y-4 overflow-y-auto max-h-[60vh]">
            {truckInventory.map((item) => (
              <div key={item.item_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.item_name}</p>
                  <p className="text-xs text-muted-foreground">{item.sku} • Min: {item.min_threshold}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => setStockCheckItems(prev => ({
                      ...prev,
                      [item.item_id]: Math.max(0, (prev[item.item_id] || 0) - 1)
                    }))}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    value={stockCheckItems[item.item_id] || 0}
                    onChange={(e) => setStockCheckItems(prev => ({
                      ...prev,
                      [item.item_id]: parseInt(e.target.value) || 0
                    }))}
                    className="w-16 h-8 text-center"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => setStockCheckItems(prev => ({
                      ...prev,
                      [item.item_id]: (prev[item.item_id] || 0) + 1
                    }))}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {truckInventory.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No inventory items found for your truck.
              </p>
            )}
          </div>
          
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setStockCheckOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleStockCheckSubmit} disabled={clockLoading} className="flex-1">
              {clockLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Submit Check
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* J-Load Calculator Sheet */}
      <Sheet open={jloadOpen} onOpenChange={setJloadOpen}>
        <SheetContent side="bottom" className="h-[90vh]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              J-Load Calculator
            </SheetTitle>
            <SheetDescription>
              Quick load estimate for HVAC sizing
            </SheetDescription>
          </SheetHeader>
          
          <Tabs defaultValue="quick" className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="quick" className="flex-1">Quick Estimate</TabsTrigger>
              <TabsTrigger value="manual" className="flex-1">Manual J</TabsTrigger>
            </TabsList>
            
            <TabsContent value="quick" className="space-y-4 mt-4 overflow-y-auto max-h-[55vh]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Square Footage</Label>
                  <Input
                    type="number"
                    value={jloadForm.square_footage}
                    onChange={(e) => setJloadForm(prev => ({ ...prev, square_footage: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Climate Zone</Label>
                  <select
                    className="w-full h-10 px-3 border rounded-md bg-background"
                    value={jloadForm.climate_zone}
                    onChange={(e) => setJloadForm(prev => ({ ...prev, climate_zone: e.target.value }))}
                  >
                    <option value="1">1 - Very Hot (Miami)</option>
                    <option value="2">2 - Hot (Houston)</option>
                    <option value="3">3 - Warm (Dallas)</option>
                    <option value="4">4 - Mixed (NYC)</option>
                    <option value="5">5 - Cold (Chicago)</option>
                    <option value="6">6 - Cold (Minneapolis)</option>
                    <option value="7">7 - Very Cold</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Building Type</Label>
                  <select
                    className="w-full h-10 px-3 border rounded-md bg-background"
                    value={jloadForm.building_type}
                    onChange={(e) => setJloadForm(prev => ({ ...prev, building_type: e.target.value as any }))}
                  >
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="mixed">Mixed Use</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Building Age</Label>
                  <select
                    className="w-full h-10 px-3 border rounded-md bg-background"
                    value={jloadForm.building_age}
                    onChange={(e) => setJloadForm(prev => ({ ...prev, building_age: e.target.value as any }))}
                  >
                    <option value="new">New Construction</option>
                    <option value="10_years">~10 Years</option>
                    <option value="20_years">~20 Years</option>
                    <option value="30_plus">30+ Years</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Insulation Quality</Label>
                  <select
                    className="w-full h-10 px-3 border rounded-md bg-background"
                    value={jloadForm.insulation_quality}
                    onChange={(e) => setJloadForm(prev => ({ ...prev, insulation_quality: e.target.value as any }))}
                  >
                    <option value="poor">Poor</option>
                    <option value="average">Average</option>
                    <option value="good">Good</option>
                    <option value="excellent">Excellent</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs"># of Floors</Label>
                  <Input
                    type="number"
                    value={jloadForm.num_floors}
                    onChange={(e) => setJloadForm(prev => ({ ...prev, num_floors: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Ceiling Height (ft)</Label>
                  <Input
                    type="number"
                    value={jloadForm.ceiling_height}
                    onChange={(e) => setJloadForm(prev => ({ ...prev, ceiling_height: parseFloat(e.target.value) || 8 }))}
                  />
                </div>
                <div>
                  <Label className="text-xs"># of Windows</Label>
                  <Input
                    type="number"
                    value={jloadForm.num_windows}
                    onChange={(e) => setJloadForm(prev => ({ ...prev, num_windows: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              
              <Button onClick={handleJLoadCalculate} disabled={clockLoading} className="w-full">
                {clockLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
                Calculate
              </Button>
              
              {/* Results */}
              <AnimatePresence>
                {jloadResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-3"
                  >
                    <h3 className="font-semibold flex items-center gap-2">
                      <Thermometer className="w-4 h-4" />
                      Load Calculation Results
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                          <Snowflake className="w-4 h-4" />
                          <span className="text-xs font-medium">Cooling</span>
                        </div>
                        <p className="text-lg font-bold">{(jloadResult.cooling_btuh / 1000).toFixed(0)}K BTU</p>
                        <p className="text-xs text-muted-foreground">{jloadResult.recommended_tonnage} Ton</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-orange-600 mb-1">
                          <Flame className="w-4 h-4" />
                          <span className="text-xs font-medium">Heating</span>
                        </div>
                        <p className="text-lg font-bold">{(jloadResult.heating_btuh / 1000).toFixed(0)}K BTU</p>
                        <p className="text-xs text-muted-foreground">{(jloadResult.recommended_furnace_btuh / 1000).toFixed(0)}K Furnace</p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-3">
                      <p className="text-xs font-medium mb-2">Recommended Equipment:</p>
                      {jloadResult.recommended_equipment.map((eq, i) => (
                        <div key={i} className="text-xs bg-white dark:bg-gray-800 rounded p-2 mb-1">
                          <span className="font-medium">{eq.type}:</span> {eq.size}
                          <span className="text-muted-foreground ml-2">({eq.model_suggestion})</span>
                        </div>
                      ))}
                    </div>
                    
                    <Button variant="outline" size="sm" className="w-full">
                      <Save className="w-4 h-4 mr-2" />
                      Save to Job/Quote
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>
            
            <TabsContent value="manual" className="mt-4">
              <div className="text-center py-8">
                <Building className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Full Manual J (ACCA) calculation with detailed building envelope analysis.
                </p>
                <Button className="mt-4" onClick={() => navigate("/jload/manual")}>
                  Start Manual J Calculation
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TechnicianMobileDashboard;
