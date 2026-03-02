import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderKanban,
  Plus,
  Search,
  Calendar,
  Users,
  Clock,
  DollarSign,
  Loader2,
  MoreVertical,
  GanttChart,
  Play,
  Pause,
  CheckCircle,
  AlertTriangle,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { projectsApi, jobsApi, techniciansApi, InstallProject, Job, Technician } from "@/lib/api";
import { toast } from "sonner";
import { format, differenceInDays, parseISO, isAfter, isBefore } from "date-fns";

const statusColors: Record<string, string> = {
  planning: "bg-slate-500",
  scheduled: "bg-blue-500",
  in_progress: "bg-yellow-500",
  completed: "bg-green-500",
  on_hold: "bg-orange-500",
  cancelled: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  planning: "Planning",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

export default function Projects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  // Form state
  const [newProject, setNewProject] = useState({
    job_id: "",
    name: "",
    description: "",
    customer_name: "",
    site_address: "",
    planned_start_date: "",
    planned_end_date: "",
    estimated_hours: 0,
    estimated_cost: 0,
    notes: "",
  });

  // Queries
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", statusFilter],
    queryFn: () => projectsApi.getAll(statusFilter !== "all" ? statusFilter : undefined),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs-for-projects"],
    queryFn: () => jobsApi.getAll(),
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["technicians"],
    queryFn: () => techniciansApi.getAll(),
  });

  // Filter projects by search
  const filteredProjects = projects.filter(p => 
    !search || 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.project_number.toLowerCase().includes(search.toLowerCase()) ||
    p.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: typeof newProject) => projectsApi.create({
      job_id: data.job_id,
      name: data.name,
      description: data.description || undefined,
      customer_name: data.customer_name,
      site_address: data.site_address,
      planned_start_date: data.planned_start_date,
      planned_end_date: data.planned_end_date,
      estimated_hours: data.estimated_hours,
      estimated_cost: data.estimated_cost,
      notes: data.notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setCreateOpen(false);
      resetForm();
      toast.success("Project created successfully");
    },
    onError: () => toast.error("Failed to create project"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      projectsApi.update(id, { status } as Partial<InstallProject>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const resetForm = () => {
    setNewProject({
      job_id: "",
      name: "",
      description: "",
      customer_name: "",
      site_address: "",
      planned_start_date: "",
      planned_end_date: "",
      estimated_hours: 0,
      estimated_cost: 0,
      notes: "",
    });
  };

  // When job is selected, populate customer info
  const handleJobSelect = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      setNewProject(prev => ({
        ...prev,
        job_id: jobId,
        customer_name: job.customer_name,
        site_address: job.site_address,
        name: `${job.customer_name} - Install Project`,
      }));
    }
  };

  const handleCreate = () => {
    if (!newProject.job_id || !newProject.name || !newProject.planned_start_date || !newProject.planned_end_date) {
      toast.error("Please fill in required fields");
      return;
    }
    createMutation.mutate(newProject);
  };

  // Get project timeline status
  const getTimelineStatus = (project: InstallProject) => {
    const today = new Date();
    const start = parseISO(project.planned_start_date);
    const end = parseISO(project.planned_end_date);
    
    if (project.status === "completed") return { label: "Completed", color: "text-green-600" };
    if (project.status === "cancelled") return { label: "Cancelled", color: "text-red-600" };
    
    if (isBefore(today, start)) {
      const daysUntil = differenceInDays(start, today);
      return { label: `Starts in ${daysUntil}d`, color: "text-blue-600" };
    }
    
    if (isAfter(today, end)) {
      const daysOver = differenceInDays(today, end);
      return { label: `${daysOver}d overdue`, color: "text-red-600" };
    }
    
    const totalDays = differenceInDays(end, start);
    const elapsed = differenceInDays(today, start);
    const remaining = totalDays - elapsed;
    return { label: `${remaining}d remaining`, color: "text-yellow-600" };
  };

  // Stats
  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === "in_progress").length,
    scheduled: projects.filter(p => p.status === "scheduled").length,
    completed: projects.filter(p => p.status === "completed").length,
  };

  // Available jobs (not yet linked to a project)
  const availableJobs = jobs.filter(j => 
    j.type === "install" || j.job_type?.toLowerCase().includes("install")
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Multi-day install projects with Gantt scheduling
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-project-button">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Install Project</DialogTitle>
              <DialogDescription>
                Create a multi-day project from an install job
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Link to Job *</Label>
                <Select value={newProject.job_id} onValueChange={handleJobSelect}>
                  <SelectTrigger data-testid="job-select">
                    <SelectValue placeholder="Select an install job" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableJobs.length === 0 ? (
                      <SelectItem value="none" disabled>No install jobs available</SelectItem>
                    ) : (
                      availableJobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.job_number} - {job.customer_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Project Name *</Label>
                <Input
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="e.g., HVAC System Replacement"
                  data-testid="project-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Project details and scope"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Input value={newProject.customer_name} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Site Address</Label>
                  <Input value={newProject.site_address} disabled />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={newProject.planned_start_date}
                    onChange={(e) => setNewProject({ ...newProject, planned_start_date: e.target.value })}
                    data-testid="start-date-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={newProject.planned_end_date}
                    onChange={(e) => setNewProject({ ...newProject, planned_end_date: e.target.value })}
                    data-testid="end-date-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estimated Hours</Label>
                  <Input
                    type="number"
                    value={newProject.estimated_hours}
                    onChange={(e) => setNewProject({ ...newProject, estimated_hours: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estimated Cost ($)</Label>
                  <Input
                    type="number"
                    value={newProject.estimated_cost}
                    onChange={(e) => setNewProject({ ...newProject, estimated_cost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={newProject.notes}
                  onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })}
                  placeholder="Additional notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Play className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.scheduled}</p>
                <p className="text-xs text-muted-foreground">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="project-search-input"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-4">
              {search ? "Try a different search term" : "Create your first install project"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredProjects.map((project) => {
            const timeline = getTimelineStatus(project);
            const durationDays = differenceInDays(
              parseISO(project.planned_end_date),
              parseISO(project.planned_start_date)
            );
            
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card 
                  className="hover:border-primary/50 transition-colors"
                  data-testid={`project-card-${project.id}`}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Project Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={statusColors[project.status]}>
                            {statusLabels[project.status]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{project.project_number}</span>
                        </div>
                        <h3 className="font-semibold text-lg truncate">{project.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {project.customer_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {project.site_address}
                          </span>
                        </div>
                      </div>

                      {/* Timeline */}
                      <div className="lg:w-48 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{project.percent_complete}%</span>
                        </div>
                        <Progress value={project.percent_complete} className="h-2" />
                        <div className="flex items-center justify-between text-xs">
                          <span>{format(parseISO(project.planned_start_date), "MMM d")}</span>
                          <span className={timeline.color}>{timeline.label}</span>
                          <span>{format(parseISO(project.planned_end_date), "MMM d")}</span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 lg:gap-6 text-sm">
                        <div className="text-center">
                          <p className="font-semibold">{durationDays}</p>
                          <p className="text-xs text-muted-foreground">Days</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold">{project.phases?.length || 0}</p>
                          <p className="text-xs text-muted-foreground">Phases</p>
                        </div>
                        {project.estimated_cost > 0 && (
                          <div className="text-center">
                            <p className="font-semibold">${project.estimated_cost.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Budget</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/projects/${project.id}`)}
                          data-testid={`view-gantt-${project.id}`}
                        >
                          <GanttChart className="w-4 h-4 mr-1" />
                          Gantt
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}>
                              <GanttChart className="w-4 h-4 mr-2" />
                              View Gantt Chart
                            </DropdownMenuItem>
                            {project.status === "planning" && (
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: "scheduled" })}>
                                <Calendar className="w-4 h-4 mr-2" />
                                Mark as Scheduled
                              </DropdownMenuItem>
                            )}
                            {project.status === "scheduled" && (
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: "in_progress" })}>
                                <Play className="w-4 h-4 mr-2" />
                                Start Project
                              </DropdownMenuItem>
                            )}
                            {project.status === "in_progress" && (
                              <>
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: "on_hold" })}>
                                  <Pause className="w-4 h-4 mr-2" />
                                  Put On Hold
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: "completed" })}>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Mark Complete
                                </DropdownMenuItem>
                              </>
                            )}
                            {project.status === "on_hold" && (
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: project.id, status: "in_progress" })}>
                                <Play className="w-4 h-4 mr-2" />
                                Resume Project
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
