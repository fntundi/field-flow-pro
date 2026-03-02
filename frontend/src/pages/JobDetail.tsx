import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KanbanBoard } from "@/components/kanban";
import { JobChat } from "@/components/JobChat";
import {
  ArrowLeft,
  Phone,
  PhoneCall,
  MapPin,
  Calendar,
  User,
  Wrench,
  Settings,
  Plus,
  Mail,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { jobsApi, tasksApi, boardConfigApi, techniciansApi, voipApi, Job, Task, BoardConfig, StatusColumn, Technician } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const JobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [boardConfig, setBoardConfig] = useState<BoardConfig | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("board");
  
  // New Task Dialog
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState("lead");
  const [newTaskForm, setNewTaskForm] = useState({
    title: "",
    description: "",
    task_type: "service" as const,
    priority: "normal" as const,
    assigned_technician_id: "",
    scheduled_date: "",
    estimated_duration: "",
  });

  // Board Config Dialog
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editingColumns, setEditingColumns] = useState<StatusColumn[]>([]);

  useEffect(() => {
    if (id) {
      fetchJobData(id);
    }
  }, [id]);

  const fetchJobData = async (jobId: string) => {
    try {
      setLoading(true);
      const [jobData, tasksData, configData, techsData] = await Promise.all([
        jobsApi.getById(jobId),
        tasksApi.getAll({ job_id: jobId }),
        boardConfigApi.getDefault(),
        techniciansApi.getAll(),
      ]);
      setJob(jobData);
      setTasks(tasksData);
      setBoardConfig(configData);
      setTechnicians(techsData);
    } catch (error) {
      console.error("Error fetching job:", error);
      toast({
        title: "Error",
        description: "Failed to load job details",
        variant: "destructive",
      });
      navigate("/jobs");
    } finally {
      setLoading(false);
    }
  };

  const handleTaskMove = useCallback(async (taskId: string, newStatus: string, newOrder: number) => {
    try {
      await tasksApi.move(taskId, newStatus, newOrder);
      // Refresh tasks
      if (job) {
        const updatedTasks = await tasksApi.getAll({ job_id: job.id });
        setTasks(updatedTasks);
      }
    } catch (error) {
      console.error("Error moving task:", error);
      toast({
        title: "Error",
        description: "Failed to move task",
        variant: "destructive",
      });
    }
  }, [job, toast]);

  const handleAddTask = (status: string) => {
    setNewTaskStatus(status);
    setNewTaskForm({
      title: "",
      description: "",
      task_type: "service",
      priority: "normal",
      assigned_technician_id: "",
      scheduled_date: "",
      estimated_duration: "",
    });
    setIsNewTaskOpen(true);
  };

  const handleCreateTask = async () => {
    if (!job || !newTaskForm.title.trim()) {
      toast({
        title: "Error",
        description: "Task title is required",
        variant: "destructive",
      });
      return;
    }

    try {
      await tasksApi.create({
        job_id: job.id,
        title: newTaskForm.title,
        description: newTaskForm.description || undefined,
        task_type: newTaskForm.task_type,
        status: newTaskStatus,
        priority: newTaskForm.priority,
        assigned_technician_id: newTaskForm.assigned_technician_id || undefined,
        scheduled_date: newTaskForm.scheduled_date || undefined,
        estimated_duration: newTaskForm.estimated_duration || undefined,
      });
      
      const updatedTasks = await tasksApi.getAll({ job_id: job.id });
      setTasks(updatedTasks);
      setIsNewTaskOpen(false);
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    } catch (error) {
      console.error("Error creating task:", error);
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    }
  };

  const handleSaveColumns = async () => {
    if (!boardConfig) return;
    
    try {
      await boardConfigApi.update(boardConfig.id, {
        columns: editingColumns,
      });
      setBoardConfig({ ...boardConfig, columns: editingColumns });
      setIsConfigOpen(false);
      toast({
        title: "Success",
        description: "Board configuration saved",
      });
    } catch (error) {
      console.error("Error saving columns:", error);
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive",
      });
    }
  };

  const addNewColumn = () => {
    const newColumn: StatusColumn = {
      id: crypto.randomUUID(),
      name: "New Status",
      key: `status_${Date.now()}`,
      color: "#6366f1",
      order: editingColumns.length,
      is_default: false,
    };
    setEditingColumns([...editingColumns, newColumn]);
  };

  const updateColumn = (index: number, updates: Partial<StatusColumn>) => {
    const updated = [...editingColumns];
    updated[index] = { ...updated[index], ...updates };
    setEditingColumns(updated);
  };

  const removeColumn = (index: number) => {
    if (editingColumns[index].is_default) {
      toast({
        title: "Cannot Remove",
        description: "Default columns cannot be removed",
        variant: "destructive",
      });
      return;
    }
    setEditingColumns(editingColumns.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading job details...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Job not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/jobs")} className="self-start">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{job.job_number}</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{job.title}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Board Config Button - Manager Only */}
          <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setEditingColumns(boardConfig?.columns || [])}
              >
                <Settings className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Configure Board</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configure Board Columns</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {editingColumns.map((col, index) => (
                  <div key={col.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input
                        value={col.name}
                        onChange={(e) => updateColumn(index, { name: e.target.value })}
                        placeholder="Column name"
                        disabled={col.is_default}
                      />
                      <Input
                        type="color"
                        value={col.color}
                        onChange={(e) => updateColumn(index, { color: e.target.value })}
                        className="h-10 cursor-pointer"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Order: {col.order}</span>
                        {col.is_default && (
                          <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeColumn(index)}
                      disabled={col.is_default}
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addNewColumn} className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Add Column
                </Button>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsConfigOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveColumns}>Save Changes</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            Edit Job
          </Button>
        </div>
      </div>

      {/* Job Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="metric-card"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <User className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Customer</h3>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">{job.customer_name}</p>
            {job.customer_phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-3 h-3" />
                <a href={`tel:${job.customer_phone}`} className="hover:text-accent">
                  {job.customer_phone}
                </a>
              </div>
            )}
            {job.customer_email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-3 h-3" />
                <a href={`mailto:${job.customer_email}`} className="hover:text-accent truncate">
                  {job.customer_email}
                </a>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="metric-card"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Location</h3>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-foreground">{job.site_address}</p>
            {job.site_city && (
              <p className="text-muted-foreground">
                {job.site_city}, {job.site_state} {job.site_zip}
              </p>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="metric-card"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Job Info</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Type</p>
              <p className="font-medium text-foreground">{job.job_type}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Priority</p>
              <p className="font-medium text-foreground capitalize">{job.priority}</p>
            </div>
            {job.scheduled_date && (
              <div className="col-span-2">
                <p className="text-muted-foreground text-xs">Scheduled</p>
                <p className="font-medium text-foreground">{job.scheduled_date}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Tabs: Board / Details */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="metric-card"
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <TabsList className="h-auto p-1">
              <TabsTrigger value="board" className="text-xs sm:text-sm">
                Task Board ({tasks.length})
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-xs sm:text-sm" data-testid="job-chat-tab">
                <MessageSquare className="w-3 h-3 mr-1" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="details" className="text-xs sm:text-sm">
                Details
              </TabsTrigger>
            </TabsList>
            {activeTab === "board" && (
              <Button size="sm" onClick={() => handleAddTask("lead")}>
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            )}
          </div>

          <TabsContent value="board" className="mt-0">
            {boardConfig && (
              <KanbanBoard
                tasks={tasks}
                columns={boardConfig.columns}
                onTaskMove={handleTaskMove}
                onAddTask={handleAddTask}
              />
            )}
          </TabsContent>

          <TabsContent value="chat" className="mt-0">
            <JobChat jobId={job.id} jobNumber={job.job_number} />
          </TabsContent>

          <TabsContent value="details" className="mt-0 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">
                {job.description || "No description provided"}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Estimated Hours</p>
                <p className="text-sm font-medium text-foreground">
                  {job.estimated_hours || "—"} hrs
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Actual Hours</p>
                <p className="text-sm font-medium text-foreground">
                  {job.actual_hours || "—"} hrs
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm font-medium text-foreground">
                  {new Date(job.created_at).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Tasks</p>
                <p className="text-sm font-medium text-foreground">{tasks.length}</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* New Task Dialog */}
      <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={newTaskForm.title}
                onChange={(e) => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
                placeholder="Enter task title"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newTaskForm.description}
                onChange={(e) => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                placeholder="Enter task description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Task Type</Label>
                <Select
                  value={newTaskForm.task_type}
                  onValueChange={(v: any) => setNewTaskForm({ ...newTaskForm, task_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tech_call">Tech Call</SelectItem>
                    <SelectItem value="sales_call">Sales Call</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={newTaskForm.priority}
                  onValueChange={(v: any) => setNewTaskForm({ ...newTaskForm, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Assign Technician</Label>
              <Select
                value={newTaskForm.assigned_technician_id}
                onValueChange={(v) => setNewTaskForm({ ...newTaskForm, assigned_technician_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name} - {tech.specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="scheduled_date">Scheduled Date</Label>
                <Input
                  id="scheduled_date"
                  type="date"
                  value={newTaskForm.scheduled_date}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, scheduled_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="duration">Est. Duration</Label>
                <Input
                  id="duration"
                  value={newTaskForm.estimated_duration}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, estimated_duration: e.target.value })}
                  placeholder="e.g., 2 hours"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsNewTaskOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTask}>Create Task</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JobDetail;
