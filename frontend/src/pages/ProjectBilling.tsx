import React, { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  FolderKanban,
  Plus,
  Receipt,
  ArrowRight,
  Settings,
  Pencil,
} from "lucide-react";
import { projectsApi, milestoneTemplatesApi, projectBillingApi, MilestoneTemplate, ProjectBillingMilestone } from "@/lib/api";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  pending: "bg-gray-500/20 text-gray-400",
  ready_to_bill: "bg-yellow-500/20 text-yellow-400",
  invoiced: "bg-blue-500/20 text-blue-400",
  paid: "bg-emerald-500/20 text-emerald-400",
};

export default function ProjectBilling() {
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showTemplateManageDialog, setShowTemplateManageDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MilestoneTemplate | null>(null);
  
  const queryClient = useQueryClient();

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getAll(),
  });

  // Fetch milestone templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["milestoneTemplates"],
    queryFn: () => milestoneTemplatesApi.getAll(),
  });

  // Apply template mutation
  const applyTemplateMutation = useMutation({
    mutationFn: ({ projectId, templateId }: { projectId: string; templateId: string }) =>
      projectBillingApi.applyTemplate(projectId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setShowTemplateDialog(false);
      toast.success("Billing template applied");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to apply template");
    },
  });

  // Update milestone mutation
  const updateMilestoneMutation = useMutation({
    mutationFn: ({ projectId, milestoneId, data }: { projectId: string; milestoneId: string; data: any }) =>
      projectBillingApi.updateMilestone(projectId, milestoneId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Milestone updated");
    },
  });

  // Invoice milestone mutation
  const invoiceMilestoneMutation = useMutation({
    mutationFn: ({ projectId, milestoneId }: { projectId: string; milestoneId: string }) =>
      projectBillingApi.invoiceMilestone(projectId, milestoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice created");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create invoice");
    },
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: (data: Partial<MilestoneTemplate>) => milestoneTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestoneTemplates"] });
      setEditingTemplate(null);
      toast.success("Template created");
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MilestoneTemplate> }) =>
      milestoneTemplatesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestoneTemplates"] });
      setEditingTemplate(null);
      toast.success("Template updated");
    },
  });

  const getProjectBillingProgress = (project: any) => {
    const milestones = project.billing_milestones || [];
    if (milestones.length === 0) return { billed: 0, paid: 0, total: project.estimated_cost || 0 };
    
    const billed = milestones.filter((m: any) => m.status === 'invoiced' || m.status === 'paid')
      .reduce((sum: number, m: any) => sum + (m.amount || 0), 0);
    const paid = milestones.filter((m: any) => m.status === 'paid')
      .reduce((sum: number, m: any) => sum + (m.amount || 0), 0);
    
    return { billed, paid, total: project.estimated_cost || 0 };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Install Project Billing</h1>
          <p className="text-sm text-muted-foreground">
            Milestone-based billing for multi-day projects (RFC-002 Section 4.5.3)
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowTemplateManageDialog(true)}
          data-testid="manage-templates-btn"
        >
          <Settings className="w-4 h-4 mr-2" />
          Manage Templates
        </Button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects List */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Install Projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {projectsLoading ? (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent" />
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No projects found
                </div>
              ) : (
                projects.map((project: any) => {
                  const progress = getProjectBillingProgress(project);
                  const hasMilestones = (project.billing_milestones || []).length > 0;
                  return (
                    <motion.div
                      key={project.id}
                      whileHover={{ scale: 1.01 }}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedProject?.id === project.id
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/50"
                      }`}
                      onClick={() => setSelectedProject(project)}
                      data-testid={`project-${project.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">{project.name}</div>
                        <Badge variant="outline" className="text-xs">
                          {project.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {project.customer_name}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          ${progress.total.toLocaleString()}
                        </span>
                        {hasMilestones ? (
                          <span className="text-emerald-400">
                            ${progress.paid.toLocaleString()} paid
                          </span>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">
                            No billing setup
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Project Billing Details */}
        <div className="lg:col-span-2">
          {!selectedProject ? (
            <Card>
              <CardContent className="py-16 text-center">
                <FolderKanban className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Select a project to view billing details</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Project Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{selectedProject.name}</CardTitle>
                      <CardDescription>{selectedProject.project_number}</CardDescription>
                    </div>
                    {(selectedProject.billing_milestones || []).length === 0 && (
                      <Button
                        onClick={() => setShowTemplateDialog(true)}
                        data-testid="apply-template-btn"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Setup Billing
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Total Value</div>
                      <div className="text-xl font-bold">
                        ${(selectedProject.estimated_cost || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Billed</div>
                      <div className="text-xl font-bold text-blue-400">
                        ${getProjectBillingProgress(selectedProject).billed.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Paid</div>
                      <div className="text-xl font-bold text-emerald-400">
                        ${getProjectBillingProgress(selectedProject).paid.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <Progress 
                    value={(getProjectBillingProgress(selectedProject).paid / 
                      (selectedProject.estimated_cost || 1)) * 100} 
                    className="h-2"
                  />
                </CardContent>
              </Card>

              {/* Billing Milestones */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Billing Milestones</CardTitle>
                </CardHeader>
                <CardContent>
                  {(selectedProject.billing_milestones || []).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Receipt className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>No billing milestones configured</p>
                      <p className="text-xs">Click "Setup Billing" to apply a template</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(selectedProject.billing_milestones || []).map((milestone: ProjectBillingMilestone, idx: number) => (
                        <div
                          key={milestone.id}
                          className="p-4 rounded-lg border border-border bg-card"
                          data-testid={`milestone-${milestone.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                                {idx + 1}
                              </div>
                              <span className="font-medium">{milestone.name}</span>
                              <Badge className={statusColors[milestone.status]}>
                                {milestone.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">${milestone.amount.toLocaleString()}</div>
                              <div className="text-xs text-muted-foreground">
                                {milestone.percentage}%
                              </div>
                            </div>
                          </div>
                          
                          {milestone.description && (
                            <p className="text-xs text-muted-foreground mb-3">{milestone.description}</p>
                          )}
                          
                          <div className="flex gap-2">
                            {milestone.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateMilestoneMutation.mutate({
                                  projectId: selectedProject.id,
                                  milestoneId: milestone.id,
                                  data: { status: 'ready_to_bill' }
                                })}
                                disabled={updateMilestoneMutation.isPending}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Mark Ready to Bill
                              </Button>
                            )}
                            {milestone.status === 'ready_to_bill' && (
                              <Button
                                size="sm"
                                onClick={() => invoiceMilestoneMutation.mutate({
                                  projectId: selectedProject.id,
                                  milestoneId: milestone.id,
                                })}
                                disabled={invoiceMilestoneMutation.isPending}
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                Create Invoice
                              </Button>
                            )}
                            {milestone.status === 'invoiced' && milestone.invoice_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(`/invoices?id=${milestone.invoice_id}`, '_blank')}
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                View Invoice
                              </Button>
                            )}
                            {milestone.status === 'paid' && (
                              <div className="flex items-center gap-1 text-xs text-emerald-400">
                                <CheckCircle className="w-4 h-4" />
                                Paid
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Apply Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Billing Template</DialogTitle>
            <DialogDescription>
              Select a milestone template for {selectedProject?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-4 rounded-lg border border-border hover:border-accent cursor-pointer transition-colors"
                onClick={() => {
                  if (selectedProject) {
                    applyTemplateMutation.mutate({
                      projectId: selectedProject.id,
                      templateId: template.id,
                    });
                  }
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{template.name}</span>
                  {template.is_default && (
                    <Badge variant="outline" className="text-xs">Default</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                <div className="flex gap-2 flex-wrap">
                  {template.milestones.map((m, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {m.name}: {m.percentage}%
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Templates Dialog */}
      <Dialog open={showTemplateManageDialog} onOpenChange={setShowTemplateManageDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Billing Templates</DialogTitle>
            <DialogDescription>
              Configure predefined milestone templates
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto py-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-4 rounded-lg border border-border"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{template.name}</span>
                    {template.is_default && (
                      <Badge variant="outline" className="text-xs">Default</Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingTemplate(template)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                <div className="flex gap-2 flex-wrap">
                  {template.milestones.map((m, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {m.name}: {m.percentage}%
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingTemplate({
                id: '',
                name: '',
                description: '',
                milestones: [{ id: '', name: '', percentage: 100, trigger: 'manual' }],
                is_default: false,
                is_active: true,
                created_at: '',
                updated_at: '',
              })}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
