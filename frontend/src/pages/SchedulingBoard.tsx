import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  MapPin,
  Loader2,
  CalendarDays,
  GanttChart,
  Filter,
  Search,
  Plus,
} from "lucide-react";
import { jobsApi, techniciansApi, Job, Technician } from "@/lib/api";
import { toast } from "sonner";

interface TimeSlot {
  hour: number;
  minute: number;
  label: string;
}

const TIME_SLOTS: TimeSlot[] = [];
for (let h = 7; h <= 18; h++) {
  TIME_SLOTS.push({ hour: h, minute: 0, label: `${h}:00` });
  TIME_SLOTS.push({ hour: h, minute: 30, label: `${h}:30` });
}

const JOB_COLORS: { [key: string]: string } = {
  "HVAC Repair": "bg-blue-500/30 border-blue-500/50",
  "AC Installation": "bg-emerald-500/30 border-emerald-500/50",
  "Heating Repair": "bg-orange-500/30 border-orange-500/50",
  "Maintenance": "bg-purple-500/30 border-purple-500/50",
  "Inspection": "bg-cyan-500/30 border-cyan-500/50",
  "default": "bg-accent/30 border-accent/50",
};

export default function SchedulingBoard() {
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedJob, setDraggedJob] = useState<Job | null>(null);
  
  const queryClient = useQueryClient();

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get week dates
  const getWeekDates = (date: Date) => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  // Navigate date
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    }
    setCurrentDate(newDate);
  };

  // Query jobs
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs", "scheduled"],
    queryFn: () => jobsApi.getAll({ status: "scheduled,dispatched,in_progress,out_for_service" }),
  });

  // Query technicians
  const { data: technicians = [], isLoading: techsLoading } = useQuery({
    queryKey: ["technicians"],
    queryFn: () => techniciansApi.getAll(),
  });

  // Update job mutation
  const updateJobMutation = useMutation({
    mutationFn: ({ jobId, data }: { jobId: string; data: any }) =>
      jobsApi.update(jobId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job rescheduled");
    },
    onError: () => {
      toast.error("Failed to reschedule job");
    },
  });

  // Filter jobs for a specific date and technician
  const getJobsForDateAndTech = useCallback((date: Date, techId?: string) => {
    const dateStr = date.toISOString().split('T')[0];
    return jobs.filter(job => {
      const jobDate = job.scheduled_date?.split('T')[0];
      if (jobDate !== dateStr) return false;
      if (techId && job.assigned_technician_id !== techId) return false;
      if (selectedTechFilter !== "all" && job.assigned_technician_id !== selectedTechFilter) return false;
      return true;
    });
  }, [jobs, selectedTechFilter]);

  // Get job position/height based on scheduled time
  const getJobStyle = (job: Job) => {
    const startTime = job.scheduled_time || "08:00";
    const [hours, minutes] = startTime.split(':').map(Number);
    const duration = job.estimated_duration || 1;
    
    // Calculate top position (7am = 0, each hour = 60px)
    const topOffset = ((hours - 7) * 60 + (minutes / 60) * 60);
    const height = duration * 60;
    
    return {
      top: `${topOffset}px`,
      height: `${Math.max(height, 30)}px`,
    };
  };

  // Handle drag start
  const handleDragStart = (job: Job) => {
    setDraggedJob(job);
  };

  // Handle drop on a time slot
  const handleDrop = (techId: string, hour: number, minute: number, date: Date) => {
    if (!draggedJob) return;
    
    const newTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const newDate = date.toISOString().split('T')[0];
    
    updateJobMutation.mutate({
      jobId: draggedJob.id,
      data: {
        scheduled_date: newDate,
        scheduled_time: newTime,
        assigned_technician_id: techId,
      },
    });
    
    setDraggedJob(null);
  };

  // Filter technicians
  const filteredTechs = technicians.filter(tech => 
    searchQuery === "" || 
    tech.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const weekDates = getWeekDates(currentDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scheduling Board</h1>
          <p className="text-sm text-muted-foreground">
            Drag-and-drop job scheduling (RFC-002 Section 4.4)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "day" | "week")}>
            <TabsList>
              <TabsTrigger value="day" data-testid="view-day">
                <CalendarDays className="w-4 h-4 mr-1" />
                Day
              </TabsTrigger>
              <TabsTrigger value="week" data-testid="view-week">
                <GanttChart className="w-4 h-4 mr-1" />
                Week
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="font-medium text-sm sm:text-base">
          {viewMode === 'day' ? formatDate(currentDate) : `Week of ${formatDate(weekDates[0])}`}
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search technicians..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full sm:w-48"
            />
          </div>
          <Select value={selectedTechFilter} onValueChange={setSelectedTechFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="w-4 h-4 mr-2 hidden sm:block" />
              <SelectValue placeholder="All Technicians" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Technicians</SelectItem>
              {technicians.map((tech) => (
                <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mobile Scroll Hint */}
      <div className="sm:hidden text-xs text-muted-foreground text-center py-2 flex items-center justify-center gap-2">
        <span>←</span> Swipe to see more technicians <span>→</span>
      </div>

      {/* Schedule Grid */}
      <Card>
        <CardContent className="p-0">
          {jobsLoading || techsLoading ? (
            <div className="text-center py-16">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent" />
              <p className="text-muted-foreground mt-2">Loading schedule...</p>
            </div>
          ) : viewMode === 'day' ? (
            // Day View
            <ScrollArea className="h-[600px]">
              <div className="min-w-[800px]">
                {/* Header Row */}
                <div className="flex border-b border-border sticky top-0 bg-card z-10">
                  <div className="w-16 flex-shrink-0 p-2 text-xs text-muted-foreground">Time</div>
                  {filteredTechs.map((tech) => (
                    <div key={tech.id} className="flex-1 min-w-[150px] p-2 border-l border-border">
                      <div className="font-medium text-sm">{tech.name}</div>
                      <div className="text-xs text-muted-foreground">{tech.specialty || 'General'}</div>
                    </div>
                  ))}
                </div>
                
                {/* Time Rows */}
                <div className="relative" style={{ height: `${TIME_SLOTS.length * 30}px` }}>
                  {/* Time labels */}
                  {TIME_SLOTS.filter((_, i) => i % 2 === 0).map((slot, idx) => (
                    <div
                      key={slot.label}
                      className="absolute left-0 w-16 text-xs text-muted-foreground px-2"
                      style={{ top: `${idx * 60}px` }}
                    >
                      {slot.label}
                    </div>
                  ))}
                  
                  {/* Grid lines */}
                  {TIME_SLOTS.filter((_, i) => i % 2 === 0).map((slot, idx) => (
                    <div
                      key={`line-${slot.label}`}
                      className="absolute left-16 right-0 border-t border-border"
                      style={{ top: `${idx * 60}px` }}
                    />
                  ))}
                  
                  {/* Tech columns with jobs */}
                  <div className="absolute left-16 right-0 top-0 bottom-0 flex">
                    {filteredTechs.map((tech) => {
                      const techJobs = getJobsForDateAndTech(currentDate, tech.id);
                      return (
                        <div
                          key={tech.id}
                          className="flex-1 min-w-[150px] relative border-l border-border"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const y = e.clientY - rect.top;
                            const slotIndex = Math.floor(y / 30);
                            const slot = TIME_SLOTS[slotIndex] || TIME_SLOTS[0];
                            handleDrop(tech.id, slot.hour, slot.minute, currentDate);
                          }}
                        >
                          {techJobs.map((job) => {
                            const style = getJobStyle(job);
                            const colorClass = JOB_COLORS[job.job_type] || JOB_COLORS.default;
                            return (
                              <motion.div
                                key={job.id}
                                className={`absolute left-1 right-1 rounded border px-2 py-1 cursor-move overflow-hidden ${colorClass}`}
                                style={style}
                                draggable
                                onDragStart={() => handleDragStart(job)}
                                whileHover={{ scale: 1.02 }}
                                data-testid={`schedule-job-${job.id}`}
                              >
                                <div className="text-xs font-medium truncate">{job.customer_name}</div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {job.job_type}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : (
            // Week View
            <ScrollArea className="h-[600px]">
              <div className="min-w-[800px]">
                {/* Header Row */}
                <div className="flex border-b border-border sticky top-0 bg-card z-10">
                  <div className="w-32 flex-shrink-0 p-2 text-xs text-muted-foreground">Technician</div>
                  {weekDates.map((date) => (
                    <div key={date.toISOString()} className="flex-1 min-w-[100px] p-2 border-l border-border text-center">
                      <div className="text-xs text-muted-foreground">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className={`font-medium text-sm ${
                        date.toDateString() === new Date().toDateString() ? 'text-accent' : ''
                      }`}>
                        {date.getDate()}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Tech Rows */}
                {filteredTechs.map((tech) => (
                  <div key={tech.id} className="flex border-b border-border">
                    <div className="w-32 flex-shrink-0 p-2">
                      <div className="font-medium text-sm">{tech.name}</div>
                      <div className="text-xs text-muted-foreground">{tech.specialty}</div>
                    </div>
                    {weekDates.map((date) => {
                      const dayJobs = getJobsForDateAndTech(date, tech.id);
                      return (
                        <div
                          key={date.toISOString()}
                          className="flex-1 min-w-[100px] p-1 border-l border-border min-h-[80px]"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDrop(tech.id, 8, 0, date);
                          }}
                        >
                          {dayJobs.slice(0, 3).map((job) => {
                            const colorClass = JOB_COLORS[job.job_type] || JOB_COLORS.default;
                            return (
                              <div
                                key={job.id}
                                className={`text-xs p-1 mb-1 rounded border truncate cursor-move ${colorClass}`}
                                draggable
                                onDragStart={() => handleDragStart(job)}
                              >
                                {job.customer_name}
                              </div>
                            );
                          })}
                          {dayJobs.length > 3 && (
                            <div className="text-xs text-muted-foreground text-center">
                              +{dayJobs.length - 3} more
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Job Types</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-3">
            {Object.entries(JOB_COLORS).filter(([k]) => k !== 'default').map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border ${color}`} />
                <span className="text-xs">{type}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
