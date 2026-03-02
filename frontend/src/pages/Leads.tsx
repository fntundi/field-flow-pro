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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Phone,
  Mail,
  Building2,
  User,
  Calendar,
  TrendingUp,
  Clock,
  Target,
  MoreVertical,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
} from "lucide-react";
import { leadsApi, pcbsApi, Lead, PCB, LeadMetrics, PCBMetrics } from "@/lib/api";
import { toast } from "sonner";

const leadStatusConfig = {
  new: { label: "New", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  contacted: { label: "Contacted", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  qualified: { label: "Qualified", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  quoted: { label: "Quoted", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  won: { label: "Won", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  lost: { label: "Lost", color: "bg-red-500/20 text-red-400 border-red-500/30" },
} as Record<string, { label: string; color: string }>;

const pcbStatusConfig = {
  created: { label: "Created", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  assigned: { label: "Assigned", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  follow_up: { label: "Follow Up", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  converted: { label: "Converted", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  closed: { label: "Closed", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
} as Record<string, { label: string; color: string }>;

const priorityConfig = {
  low: { label: "Low", color: "bg-slate-500/20 text-slate-400" },
  normal: { label: "Normal", color: "bg-blue-500/20 text-blue-400" },
  high: { label: "High", color: "bg-orange-500/20 text-orange-400" },
  urgent: { label: "Urgent", color: "bg-red-500/20 text-red-400" },
} as Record<string, { label: string; color: string }>;

const sourceOptions = [
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "google_ads", label: "Google Ads" },
  { value: "facebook", label: "Facebook" },
  { value: "phone", label: "Phone Call" },
  { value: "walk_in", label: "Walk-In" },
  { value: "other", label: "Other" },
];

export default function Leads() {
  const [activeTab, setActiveTab] = useState("leads");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
  const [showNewPCBDialog, setShowNewPCBDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  const queryClient = useQueryClient();

  // Queries
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads", statusFilter, sourceFilter, searchQuery],
    queryFn: () => leadsApi.getAll({
      status: statusFilter !== "all" ? statusFilter : undefined,
      source: sourceFilter !== "all" ? sourceFilter : undefined,
      search: searchQuery || undefined,
    }),
  });

  const { data: leadMetrics } = useQuery({
    queryKey: ["leadMetrics"],
    queryFn: () => leadsApi.getMetrics(),
  });

  const { data: pcbs = [], isLoading: pcbsLoading } = useQuery({
    queryKey: ["pcbs"],
    queryFn: () => pcbsApi.getAll(),
  });

  const { data: pcbMetrics } = useQuery({
    queryKey: ["pcbMetrics"],
    queryFn: () => pcbsApi.getMetrics(),
  });

  // Mutations
  const createLeadMutation = useMutation({
    mutationFn: leadsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leadMetrics"] });
      setShowNewLeadDialog(false);
      toast.success("Lead created successfully");
    },
    onError: () => {
      toast.error("Failed to create lead");
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Lead> }) => leadsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leadMetrics"] });
      toast.success("Lead updated successfully");
    },
  });

  const convertLeadMutation = useMutation({
    mutationFn: leadsApi.convert,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leadMetrics"] });
      toast.success(`Lead converted! Customer ID: ${data.customer_id}`);
    },
  });

  const createPCBMutation = useMutation({
    mutationFn: pcbsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pcbs"] });
      queryClient.invalidateQueries({ queryKey: ["pcbMetrics"] });
      setShowNewPCBDialog(false);
      toast.success("PCB created successfully");
    },
  });

  const updatePCBMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PCB> }) => pcbsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pcbs"] });
      queryClient.invalidateQueries({ queryKey: ["pcbMetrics"] });
      toast.success("PCB updated successfully");
    },
  });

  const convertPCBMutation = useMutation({
    mutationFn: pcbsApi.convert,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pcbs"] });
      queryClient.invalidateQueries({ queryKey: ["pcbMetrics"] });
      toast.success(`PCB converted to job ${data.job_number}`);
    },
  });

  const handleCreateLead = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createLeadMutation.mutate({
      contact_name: formData.get("contact_name") as string,
      contact_email: formData.get("contact_email") as string || undefined,
      contact_phone: formData.get("contact_phone") as string || undefined,
      company_name: formData.get("company_name") as string || undefined,
      address: formData.get("address") as string || undefined,
      city: formData.get("city") as string || undefined,
      state: formData.get("state") as string || undefined,
      zip_code: formData.get("zip_code") as string || undefined,
      source: formData.get("source") as string || "website",
      notes: formData.get("notes") as string || undefined,
      estimated_value: parseFloat(formData.get("estimated_value") as string) || 0,
      priority: formData.get("priority") as string || "normal",
    });
  };

  const handleCreatePCB = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createPCBMutation.mutate({
      customer_name: formData.get("customer_name") as string,
      reason: formData.get("reason") as string,
      reason_category: formData.get("reason_category") as string || "follow_up",
      follow_up_date: formData.get("follow_up_date") as string || undefined,
      priority: formData.get("priority") as string || "normal",
      notes: formData.get("notes") as string || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads & PCBs</h1>
          <p className="text-sm text-muted-foreground">
            Track leads and potential call-backs (RFC-002 Section 4.1)
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showNewPCBDialog} onOpenChange={setShowNewPCBDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="new-pcb-btn">
                <Phone className="w-4 h-4 mr-2" />
                New PCB
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Potential Callback (PCB)</DialogTitle>
                <DialogDescription>
                  Track follow-up items and potential callbacks
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreatePCB} className="space-y-4">
                <div>
                  <Label htmlFor="customer_name">Customer Name *</Label>
                  <Input id="customer_name" name="customer_name" required />
                </div>
                <div>
                  <Label htmlFor="reason">Reason *</Label>
                  <Textarea id="reason" name="reason" required placeholder="Why does this need follow-up?" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="reason_category">Category</Label>
                    <Select name="reason_category" defaultValue="follow_up">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                        <SelectItem value="upsell">Upsell Opportunity</SelectItem>
                        <SelectItem value="warranty">Warranty</SelectItem>
                        <SelectItem value="complaint">Complaint</SelectItem>
                        <SelectItem value="question">Question</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select name="priority" defaultValue="normal">
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Label htmlFor="follow_up_date">Follow Up Date</Label>
                  <Input id="follow_up_date" name="follow_up_date" type="date" />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" placeholder="Additional notes..." />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowNewPCBDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createPCBMutation.isPending}>
                    {createPCBMutation.isPending ? "Creating..." : "Create PCB"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showNewLeadDialog} onOpenChange={setShowNewLeadDialog}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90" data-testid="new-lead-btn">
                <Plus className="w-4 h-4 mr-2" />
                New Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Lead</DialogTitle>
                <DialogDescription>
                  Capture a new lead from any source
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateLead} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact_name">Contact Name *</Label>
                    <Input id="contact_name" name="contact_name" required placeholder="John Smith" />
                  </div>
                  <div>
                    <Label htmlFor="company_name">Company Name</Label>
                    <Input id="company_name" name="company_name" placeholder="Optional" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact_email">Email</Label>
                    <Input id="contact_email" name="contact_email" type="email" placeholder="john@example.com" />
                  </div>
                  <div>
                    <Label htmlFor="contact_phone">Phone</Label>
                    <Input id="contact_phone" name="contact_phone" placeholder="(555) 123-4567" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" placeholder="123 Main St" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input id="city" name="city" />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input id="state" name="state" />
                  </div>
                  <div>
                    <Label htmlFor="zip_code">ZIP</Label>
                    <Input id="zip_code" name="zip_code" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="source">Lead Source</Label>
                    <Select name="source" defaultValue="website">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {sourceOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select name="priority" defaultValue="normal">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="estimated_value">Est. Value ($)</Label>
                    <Input id="estimated_value" name="estimated_value" type="number" placeholder="0" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" placeholder="Additional information about this lead..." />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowNewLeadDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createLeadMutation.isPending}>
                    {createLeadMutation.isPending ? "Creating..." : "Create Lead"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-4"
          data-testid="lead-metrics-total"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Target className="w-4 h-4" />
            Total Leads
          </div>
          <div className="text-2xl font-bold">{leadMetrics?.total_leads || 0}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {leadMetrics?.by_status?.new || 0} new
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-lg p-4"
          data-testid="lead-metrics-conversion"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            Conversion Rate
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {leadMetrics?.lead_to_close_ratio || 0}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Lead to close
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-lg p-4"
          data-testid="pcb-metrics-open"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Phone className="w-4 h-4" />
            Open PCBs
          </div>
          <div className="text-2xl font-bold text-yellow-400">{pcbMetrics?.open_pcbs || 0}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {pcbMetrics?.overdue_count || 0} overdue
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-lg p-4"
          data-testid="pcb-metrics-conversion"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Clock className="w-4 h-4" />
            PCB Conversion
          </div>
          <div className="text-2xl font-bold text-cyan-400">
            {pcbMetrics?.conversion_rate || 0}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Converted to jobs
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="leads" className="data-[state=active]:bg-background">
            Leads ({leads.length})
          </TabsTrigger>
          <TabsTrigger value="pcbs" className="data-[state=active]:bg-background">
            PCBs ({pcbs.length})
          </TabsTrigger>
        </TabsList>

        {/* Leads Tab */}
        <TabsContent value="leads" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="lead-search-input"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="lead-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="quoted">Quoted</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[140px]" data-testid="lead-source-filter">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sourceOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Leads Table */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-lg overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Lead</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Contact</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Source</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Value</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Priority</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Created</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leadsLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        Loading leads...
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        No leads found. Create your first lead!
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => {
                      const statusCfg = leadStatusConfig[lead.status] || leadStatusConfig.new;
                      const priorityCfg = priorityConfig[lead.priority] || priorityConfig.normal;
                      return (
                        <tr
                          key={lead.id}
                          className="hover:bg-muted/20 transition-colors cursor-pointer"
                          onClick={() => setSelectedLead(lead)}
                          data-testid={`lead-row-${lead.id}`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs text-muted-foreground">{lead.lead_number}</div>
                            <div className="font-medium">{lead.contact_name}</div>
                            {lead.company_name && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {lead.company_name}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {lead.contact_email && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {lead.contact_email}
                              </div>
                            )}
                            {lead.contact_phone && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {lead.contact_phone}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                            {lead.source.replace("_", " ")}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            {lead.estimated_value > 0 ? `$${lead.estimated_value.toLocaleString()}` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`${statusCfg.color} border`}>
                              {statusCfg.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={priorityCfg.color}>
                              {priorityCfg.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateLeadMutation.mutate({ id: lead.id, data: { status: "contacted" } });
                                  }}
                                >
                                  Mark Contacted
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateLeadMutation.mutate({ id: lead.id, data: { status: "qualified" } });
                                  }}
                                >
                                  Mark Qualified
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    convertLeadMutation.mutate(lead.id);
                                  }}
                                >
                                  <ArrowRight className="w-4 h-4 mr-2" />
                                  Convert to Customer
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateLeadMutation.mutate({ id: lead.id, data: { status: "lost" } });
                                  }}
                                  className="text-red-400"
                                >
                                  Mark Lost
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </TabsContent>

        {/* PCBs Tab */}
        <TabsContent value="pcbs" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-lg overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">PCB #</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Reason</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Follow Up</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Priority</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pcbsLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        Loading PCBs...
                      </td>
                    </tr>
                  ) : pcbs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        No PCBs found. Create a potential callback!
                      </td>
                    </tr>
                  ) : (
                    pcbs.map((pcb) => {
                      const statusCfg = pcbStatusConfig[pcb.status] || pcbStatusConfig.created;
                      const priorityCfg = priorityConfig[pcb.priority] || priorityConfig.normal;
                      const isOverdue = pcb.follow_up_date && 
                        new Date(pcb.follow_up_date) < new Date() && 
                        !["converted", "closed"].includes(pcb.status);
                      
                      return (
                        <tr
                          key={pcb.id}
                          className="hover:bg-muted/20 transition-colors"
                          data-testid={`pcb-row-${pcb.id}`}
                        >
                          <td className="px-4 py-3 font-mono text-xs font-medium">
                            {pcb.pcb_number}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {pcb.customer_name || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                            {pcb.reason}
                          </td>
                          <td className="px-4 py-3 text-sm capitalize">
                            {pcb.reason_category.replace("_", " ")}
                          </td>
                          <td className="px-4 py-3">
                            {pcb.follow_up_date ? (
                              <div className={`text-xs ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
                                <Calendar className="w-3 h-3 inline mr-1" />
                                {new Date(pcb.follow_up_date).toLocaleDateString()}
                                {isOverdue && <span className="ml-1 font-medium">OVERDUE</span>}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`${statusCfg.color} border`}>
                              {statusCfg.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={priorityCfg.color}>
                              {priorityCfg.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => updatePCBMutation.mutate({ id: pcb.id, data: { status: "follow_up" } })}
                                >
                                  Mark Follow Up
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => convertPCBMutation.mutate(pcb.id)}
                                >
                                  <ArrowRight className="w-4 h-4 mr-2" />
                                  Convert to Job
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updatePCBMutation.mutate({ id: pcb.id, data: { status: "closed" } })}
                                  className="text-muted-foreground"
                                >
                                  Close PCB
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-lg">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {selectedLead.contact_name}
                </DialogTitle>
                <DialogDescription>
                  {selectedLead.lead_number}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Status</div>
                    <Badge className={`${leadStatusConfig[selectedLead.status]?.color} border`}>
                      {leadStatusConfig[selectedLead.status]?.label}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Priority</div>
                    <Badge className={priorityConfig[selectedLead.priority]?.color}>
                      {priorityConfig[selectedLead.priority]?.label}
                    </Badge>
                  </div>
                  {selectedLead.contact_email && (
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">Email</div>
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {selectedLead.contact_email}
                      </div>
                    </div>
                  )}
                  {selectedLead.contact_phone && (
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">Phone</div>
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {selectedLead.contact_phone}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Source</div>
                    <div className="capitalize">{selectedLead.source.replace("_", " ")}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Est. Value</div>
                    <div>${selectedLead.estimated_value.toLocaleString()}</div>
                  </div>
                </div>
                {selectedLead.address && (
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Address</div>
                    <div className="text-sm">
                      {selectedLead.address}
                      {selectedLead.city && `, ${selectedLead.city}`}
                      {selectedLead.state && `, ${selectedLead.state}`}
                      {selectedLead.zip_code && ` ${selectedLead.zip_code}`}
                    </div>
                  </div>
                )}
                {selectedLead.notes && (
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Notes</div>
                    <div className="text-sm bg-muted/30 p-2 rounded">{selectedLead.notes}</div>
                  </div>
                )}
              </div>
              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setSelectedLead(null)}>
                  Close
                </Button>
                {selectedLead.status !== "won" && (
                  <Button
                    onClick={() => {
                      convertLeadMutation.mutate(selectedLead.id);
                      setSelectedLead(null);
                    }}
                  >
                    Convert to Customer
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
