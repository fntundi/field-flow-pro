import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  ClipboardCheck,
  Camera,
  CheckCircle,
  Clock,
  AlertTriangle,
  Image,
  FileText,
  Ruler,
  PenTool,
  Loader2,
  ChevronRight,
  Upload,
  X,
  Eye,
} from "lucide-react";
import { jobsApi, jobChecklistApi, jobTypesApi, Job, JobChecklist, JobChecklistItem, ChecklistItemEvidence } from "@/lib/api";
import { toast } from "sonner";

export default function Checklists() {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedItem, setSelectedItem] = useState<JobChecklistItem | null>(null);
  const [showEvidenceDialog, setShowEvidenceDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  const queryClient = useQueryClient();

  // Fetch jobs that have checklists or are in progress
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs", "with-checklists"],
    queryFn: () => jobsApi.getAll({ status: "in_progress,dispatched,out_for_service" }),
  });

  // Fetch job types for templates
  const { data: jobTypes = [] } = useQuery({
    queryKey: ["jobTypes"],
    queryFn: () => jobTypesApi.getAll(),
  });

  // Fetch checklist for selected job
  const { data: checklistData, isLoading: checklistLoading } = useQuery({
    queryKey: ["checklist", selectedJob?.id],
    queryFn: () => selectedJob ? jobChecklistApi.get(selectedJob.id) : Promise.resolve({ checklist: null }),
    enabled: !!selectedJob,
  });

  // Create checklist mutation
  const createChecklistMutation = useMutation({
    mutationFn: (params: { jobId: string; templateId?: string }) => 
      jobChecklistApi.create(params.jobId, params.templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist", selectedJob?.id] });
      toast.success("Checklist created");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create checklist");
    },
  });

  // Update checklist item mutation
  const updateItemMutation = useMutation({
    mutationFn: (params: { jobId: string; itemId: string; data: any }) =>
      jobChecklistApi.updateItem(params.jobId, params.itemId, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist", selectedJob?.id] });
      toast.success("Item updated");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update item");
    },
  });

  // Handle photo upload (convert to base64)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file || !selectedJob || !selectedItem) return;

    setUploadingPhoto(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        
        const evidence: Partial<ChecklistItemEvidence> = {
          type: type === 'before' ? 'photo_before' : 'photo_after',
          value: base64,
          captured_at: new Date().toISOString(),
        };

        await updateItemMutation.mutateAsync({
          jobId: selectedJob.id,
          itemId: selectedItem.id,
          data: { evidence },
        });
        
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setUploadingPhoto(false);
      toast.error("Failed to upload photo");
    }
  };

  // Handle adding note/measurement
  const handleAddEvidence = async (type: string, value: string) => {
    if (!selectedJob || !selectedItem || !value) return;

    const evidence: Partial<ChecklistItemEvidence> = {
      type: type as any,
      value,
      captured_at: new Date().toISOString(),
    };

    await updateItemMutation.mutateAsync({
      jobId: selectedJob.id,
      itemId: selectedItem.id,
      data: { evidence },
    });
  };

  // Mark item complete
  const handleToggleComplete = async (item: JobChecklistItem) => {
    if (!selectedJob) return;
    
    await updateItemMutation.mutateAsync({
      jobId: selectedJob.id,
      itemId: item.id,
      data: { is_completed: !item.is_completed },
    });
  };

  const checklist = checklistData?.checklist;
  const completedItems = checklist?.items.filter(i => i.is_completed).length || 0;
  const totalItems = checklist?.items.length || 0;
  const progressPercent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = searchQuery === "" || 
      job.job_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customer_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && job.status === statusFilter;
  });

  const getItemIcon = (item: JobChecklistItem) => {
    if (item.requires_before_photo || item.requires_after_photo) return Camera;
    if (item.requires_measurement) return Ruler;
    if (item.requires_signature) return PenTool;
    if (item.requires_note) return FileText;
    return ClipboardCheck;
  };

  const getItemStatus = (item: JobChecklistItem) => {
    if (item.is_completed) return { color: "text-emerald-400", label: "Complete" };
    
    const missingEvidence = [];
    if (item.requires_before_photo && !item.evidence.find(e => e.type === 'photo_before')) {
      missingEvidence.push("before photo");
    }
    if (item.requires_after_photo && !item.evidence.find(e => e.type === 'photo_after')) {
      missingEvidence.push("after photo");
    }
    if (item.requires_measurement && !item.evidence.find(e => e.type === 'measurement')) {
      missingEvidence.push("measurement");
    }
    if (item.requires_note && !item.evidence.find(e => e.type === 'note')) {
      missingEvidence.push("note");
    }
    
    if (missingEvidence.length > 0) {
      return { color: "text-yellow-400", label: `Missing: ${missingEvidence.join(", ")}` };
    }
    
    return { color: "text-muted-foreground", label: "Ready to complete" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Evidence-Based Checklists</h1>
        <p className="text-sm text-muted-foreground">
          Quality verification with photo evidence (RFC-002 Section 4.2.2)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Active Jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs..."
                  className="pl-10 h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="checklist-search"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9" data-testid="status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="out_for_service">Out for Service</SelectItem>
              </SelectContent>
            </Select>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {jobsLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No active jobs found
                </div>
              ) : (
                filteredJobs.map((job) => (
                  <motion.div
                    key={job.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedJob?.id === job.id
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-accent/50"
                    }`}
                    onClick={() => setSelectedJob(job)}
                    data-testid={`job-card-${job.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-xs text-muted-foreground">{job.job_number}</div>
                        <div className="font-medium text-sm">{job.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{job.job_type}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Checklist Panel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                {selectedJob ? `Checklist: ${selectedJob.job_number}` : "Select a Job"}
              </CardTitle>
              {checklist && (
                <Badge className={progressPercent === 100 ? "bg-emerald-500/20 text-emerald-400" : "bg-yellow-500/20 text-yellow-400"}>
                  {completedItems}/{totalItems} Complete
                </Badge>
              )}
            </div>
            {checklist && (
              <Progress value={progressPercent} className="h-2 mt-2" />
            )}
          </CardHeader>
          <CardContent>
            {!selectedJob ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a job to view its checklist</p>
              </div>
            ) : checklistLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent" />
              </div>
            ) : !checklist ? (
              <div className="text-center py-12">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No checklist assigned to this job</p>
                <Select onValueChange={(templateId) => createChecklistMutation.mutate({ jobId: selectedJob.id, templateId })}>
                  <SelectTrigger className="w-[250px] mx-auto" data-testid="create-checklist-select">
                    <SelectValue placeholder="Create from template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jobTypes.map((jt) => (
                      <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                {checklist.items.map((item) => {
                  const ItemIcon = getItemIcon(item);
                  const status = getItemStatus(item);
                  
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-lg border ${
                        item.is_completed ? "bg-emerald-500/5 border-emerald-500/30" : "border-border"
                      }`}
                      data-testid={`checklist-item-${item.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={item.is_completed}
                          onCheckedChange={() => handleToggleComplete(item)}
                          disabled={updateItemMutation.isPending}
                          className="mt-1"
                          data-testid={`item-checkbox-${item.id}`}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <ItemIcon className={`w-4 h-4 ${status.color}`} />
                            <span className={`font-medium ${item.is_completed ? "line-through text-muted-foreground" : ""}`}>
                              {item.description}
                            </span>
                            {item.is_required && (
                              <Badge variant="outline" className="text-xs">Required</Badge>
                            )}
                          </div>
                          <p className={`text-xs ${status.color}`}>{status.label}</p>
                          
                          {/* Evidence Thumbnails */}
                          {item.evidence.length > 0 && (
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {item.evidence.map((ev, idx) => (
                                <div key={idx} className="relative group">
                                  {ev.type.includes('photo') ? (
                                    <img
                                      src={ev.value}
                                      alt={ev.type}
                                      className="w-16 h-16 object-cover rounded border border-border"
                                    />
                                  ) : (
                                    <div className="w-16 h-16 bg-muted rounded border border-border flex items-center justify-center">
                                      <span className="text-xs text-center px-1">{ev.type.replace('_', ' ')}</span>
                                    </div>
                                  )}
                                  <Badge className="absolute -top-1 -right-1 text-[10px] px-1">
                                    {ev.type.includes('before') ? 'B' : ev.type.includes('after') ? 'A' : ev.type[0].toUpperCase()}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Action Buttons */}
                          {!item.is_completed && (
                            <div className="flex gap-2 mt-3 flex-wrap">
                              {item.requires_before_photo && !item.evidence.find(e => e.type === 'photo_before') && (
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      setSelectedItem(item);
                                      handlePhotoUpload(e, 'before');
                                    }}
                                    disabled={uploadingPhoto}
                                  />
                                  <Button size="sm" variant="outline" className="gap-1" asChild>
                                    <span>
                                      <Camera className="w-3 h-3" />
                                      Before Photo
                                    </span>
                                  </Button>
                                </label>
                              )}
                              {item.requires_after_photo && !item.evidence.find(e => e.type === 'photo_after') && (
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      setSelectedItem(item);
                                      handlePhotoUpload(e, 'after');
                                    }}
                                    disabled={uploadingPhoto}
                                  />
                                  <Button size="sm" variant="outline" className="gap-1" asChild>
                                    <span>
                                      <Camera className="w-3 h-3" />
                                      After Photo
                                    </span>
                                  </Button>
                                </label>
                              )}
                              {(item.requires_note || item.requires_measurement) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => {
                                    setSelectedItem(item);
                                    setShowEvidenceDialog(true);
                                  }}
                                >
                                  {item.requires_measurement ? <Ruler className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                  {item.requires_measurement ? "Add Measurement" : "Add Note"}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evidence Dialog */}
      <Dialog open={showEvidenceDialog} onOpenChange={setShowEvidenceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Evidence</DialogTitle>
            <DialogDescription>
              {selectedItem?.description}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const type = selectedItem?.requires_measurement ? 'measurement' : 'note';
              const value = formData.get("value") as string;
              handleAddEvidence(type, value);
              setShowEvidenceDialog(false);
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="value">
                {selectedItem?.requires_measurement ? "Measurement" : "Note"}
              </Label>
              {selectedItem?.requires_measurement ? (
                <Input
                  id="value"
                  name="value"
                  placeholder="e.g., 18°F temperature split"
                  required
                />
              ) : (
                <Textarea
                  id="value"
                  name="value"
                  placeholder="Enter your notes..."
                  required
                />
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEvidenceDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateItemMutation.isPending}>
                {updateItemMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
