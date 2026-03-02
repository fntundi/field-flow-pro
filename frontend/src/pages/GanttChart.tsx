import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Briefcase,
} from "lucide-react";
import { projectsApi, techniciansApi, GanttData, InstallProject, ProjectPhase, Technician } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const GanttChart = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<InstallProject | null>(null);
  const [ganttData, setGanttData] = useState<GanttData | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<ProjectPhase | null>(null);
  
  // View settings
  const [viewStart, setViewStart] = useState<Date>(new Date());
  const [daysToShow] = useState(14);
  
  // New phase form
  const [newPhase, setNewPhase] = useState({
    name: "",
    start_date: "",
    end_date: "",
    assigned_technician_ids: [] as string[],
    color: "#3B82F6",
  });

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [projectData, gantt, techs] = await Promise.all([
        projectsApi.getById(projectId),
        projectsApi.getGanttData(projectId),
        techniciansApi.getAll(),
      ]);
      setProject(projectData);
      setGanttData(gantt);
      setTechnicians(techs);
      
      // Set view start to project start
      if (projectData.planned_start_date) {
        const start = new Date(projectData.planned_start_date);
        start.setDate(start.getDate() - 1); // Day before
        setViewStart(start);
      }
    } catch (error) {
      console.error("Error fetching project data:", error);
      toast({
        title: "Error",
        description: "Failed to load project data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate dates for the header
  const dates = useMemo(() => {
    const result = [];
    const current = new Date(viewStart);
    for (let i = 0; i < daysToShow; i++) {
      result.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [viewStart, daysToShow]);

  // Calculate bar position and width for a phase
  const getBarStyle = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const viewStartTime = viewStart.getTime();
    const dayWidth = 100 / daysToShow;
    
    const startOffset = (startDate.getTime() - viewStartTime) / (1000 * 60 * 60 * 24);
    const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1;
    
    const left = startOffset * dayWidth;
    const width = duration * dayWidth;
    
    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.min(100 - Math.max(0, left), width)}%`,
      display: left + width < 0 || left > 100 ? "none" : "block",
    };
  };

  const handleAddPhase = async () => {
    if (!projectId || !newPhase.name || !newPhase.start_date || !newPhase.end_date) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await projectsApi.addPhase(projectId, newPhase);
      toast({ title: "Phase Added", description: `${newPhase.name} has been added` });
      setAddPhaseOpen(false);
      setNewPhase({ name: "", start_date: "", end_date: "", assigned_technician_ids: [], color: "#3B82F6" });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add phase",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePhaseStatus = async (phaseId: string, status: string, percentComplete: number) => {
    if (!projectId) return;
    
    try {
      await projectsApi.updatePhase(projectId, phaseId, { status: status as any, percent_complete: percentComplete });
      toast({ title: "Phase Updated" });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update phase",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500";
      case "in_progress": return "bg-blue-500";
      case "blocked": return "bg-red-500";
      default: return "bg-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project || !ganttData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Project not found</p>
        <Button variant="outline" onClick={() => navigate("/jobs")} className="mt-4">
          Back to Jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Briefcase className="w-4 h-4" />
            <span>{project.project_number}</span>
          </div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">{project.customer_name} • {project.site_address}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {project.percent_complete}% Complete
          </Badge>
          <Button onClick={() => setAddPhaseOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Phase
          </Button>
        </div>
      </div>

      {/* Project Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-xs">Timeline</span>
          </div>
          <p className="font-medium">{project.planned_start_date} → {project.planned_end_date}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs">Hours</span>
          </div>
          <p className="font-medium">{project.actual_hours} / {project.estimated_hours} hrs</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs">Resources</span>
          </div>
          <p className="font-medium">{ganttData.resources.length} technicians</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs">Phases</span>
          </div>
          <p className="font-medium">
            {ganttData.phases.filter(p => p.status === "completed").length} / {ganttData.phases.length}
          </p>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border overflow-hidden">
        {/* Navigation */}
        <div className="flex items-center justify-between p-4 border-b">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newStart = new Date(viewStart);
              newStart.setDate(newStart.getDate() - 7);
              setViewStart(newStart);
            }}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Prev Week
          </Button>
          <span className="font-medium">
            {viewStart.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newStart = new Date(viewStart);
              newStart.setDate(newStart.getDate() + 7);
              setViewStart(newStart);
            }}
          >
            Next Week
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Date Header */}
        <div className="flex border-b">
          <div className="w-48 shrink-0 p-2 border-r font-medium text-sm bg-muted/50">
            Phase
          </div>
          <div className="flex-1 flex">
            {dates.map((date, i) => {
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div
                  key={i}
                  className={`flex-1 text-center p-2 text-xs border-r last:border-r-0 ${
                    isWeekend ? "bg-muted/30" : ""
                  } ${isToday ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                >
                  <div className="font-medium">{date.getDate()}</div>
                  <div className="text-muted-foreground">
                    {date.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Phases */}
        {ganttData.phases.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No phases defined yet. Add phases to see the Gantt chart.</p>
          </div>
        ) : (
          ganttData.phases.map((phase) => (
            <div key={phase.id} className="flex border-b last:border-b-0 hover:bg-muted/20">
              {/* Phase Name */}
              <div
                className="w-48 shrink-0 p-3 border-r cursor-pointer"
                onClick={() => setSelectedPhase(project?.phases.find(p => p.id === phase.id) || null)}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(phase.status)}`} />
                  <span className="font-medium text-sm truncate">{phase.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{phase.duration} days</span>
                  {phase.resources.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      • {phase.resources[0]}
                    </span>
                  )}
                </div>
              </div>

              {/* Gantt Bar */}
              <div className="flex-1 relative h-16">
                {/* Background grid */}
                <div className="absolute inset-0 flex">
                  {dates.map((date, i) => {
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <div
                        key={i}
                        className={`flex-1 border-r last:border-r-0 ${isWeekend ? "bg-muted/20" : ""}`}
                      />
                    );
                  })}
                </div>

                {/* Phase bar */}
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  className="absolute top-3 h-10 rounded-lg shadow-sm cursor-pointer overflow-hidden"
                  style={{
                    ...getBarStyle(phase.start, phase.end),
                    backgroundColor: phase.color || "#3B82F6",
                    transformOrigin: "left",
                  }}
                  onClick={() => setSelectedPhase(project?.phases.find(p => p.id === phase.id) || null)}
                >
                  {/* Progress fill */}
                  <div
                    className="absolute inset-y-0 left-0 bg-black/20"
                    style={{ width: `${phase.progress}%` }}
                  />
                  <div className="relative px-2 py-1 text-white text-xs font-medium truncate">
                    {phase.name} ({phase.progress}%)
                  </div>
                </motion.div>

                {/* Dependencies arrows would go here */}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Phase Sheet */}
      <Sheet open={addPhaseOpen} onOpenChange={setAddPhaseOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Project Phase</SheetTitle>
            <SheetDescription>Define a new phase for this install project</SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <div>
              <Label>Phase Name</Label>
              <Input
                value={newPhase.name}
                onChange={(e) => setNewPhase({ ...newPhase, name: e.target.value })}
                placeholder="e.g., Equipment Removal"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={newPhase.start_date}
                  onChange={(e) => setNewPhase({ ...newPhase, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={newPhase.end_date}
                  onChange={(e) => setNewPhase({ ...newPhase, end_date: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <Label>Assign Technicians</Label>
              <Select
                value={newPhase.assigned_technician_ids[0] || ""}
                onValueChange={(v) => setNewPhase({ ...newPhase, assigned_technician_ids: [v] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"].map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full ${
                      newPhase.color === color ? "ring-2 ring-offset-2 ring-black" : ""
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewPhase({ ...newPhase, color })}
                  />
                ))}
              </div>
            </div>
            
            <Button onClick={handleAddPhase} className="w-full">
              Add Phase
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Phase Detail Sheet */}
      <Sheet open={!!selectedPhase} onOpenChange={() => setSelectedPhase(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedPhase?.name}</SheetTitle>
            <SheetDescription>
              {selectedPhase?.start_date} → {selectedPhase?.end_date}
            </SheetDescription>
          </SheetHeader>
          
          {selectedPhase && (
            <div className="mt-6 space-y-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={selectedPhase.status}
                  onValueChange={(v) => handleUpdatePhaseStatus(selectedPhase.id, v, selectedPhase.percent_complete)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Progress: {selectedPhase.percent_complete}%</Label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={selectedPhase.percent_complete}
                  onChange={(e) => handleUpdatePhaseStatus(
                    selectedPhase.id,
                    selectedPhase.status,
                    parseInt(e.target.value)
                  )}
                  className="w-full mt-2"
                />
              </div>
              
              <div>
                <Label>Duration</Label>
                <p className="text-sm text-muted-foreground">{selectedPhase.duration_days} days</p>
              </div>
              
              {selectedPhase.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm text-muted-foreground">{selectedPhase.notes}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default GanttChart;
