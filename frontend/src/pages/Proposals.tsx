import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  FileText,
  TrendingUp,
  DollarSign,
  Clock,
  MoreVertical,
  Send,
  CheckCircle,
  Star,
  Eye,
} from "lucide-react";
import { proposalsApi, Proposal, ProposalOption } from "@/lib/api";
import { toast } from "sonner";

const statusConfig: { [key: string]: { label: string; color: string } } = {
  draft: { label: "Draft", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  sent: { label: "Sent", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  viewed: { label: "Viewed", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  accepted: { label: "Accepted", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  expired: { label: "Expired", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
};

const tierConfig: { [key: string]: { label: string; color: string } } = {
  good: { label: "Good", color: "bg-slate-500/20 text-slate-400" },
  better: { label: "Better", color: "bg-blue-500/20 text-blue-400" },
  best: { label: "Best", color: "bg-emerald-500/20 text-emerald-400" },
};

export default function Proposals() {
  const [showNewProposalDialog, setShowNewProposalDialog] = useState(false);
  const [showAddOptionDialog, setShowAddOptionDialog] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const queryClient = useQueryClient();

  // Queries
  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["proposals", statusFilter],
    queryFn: () => proposalsApi.getAll({
      status: statusFilter !== "all" ? statusFilter : undefined,
    }),
  });

  const { data: metrics } = useQuery({
    queryKey: ["proposalMetrics"],
    queryFn: () => proposalsApi.getMetrics(),
  });

  // Mutations
  const createProposalMutation = useMutation({
    mutationFn: proposalsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposalMetrics"] });
      setShowNewProposalDialog(false);
      toast.success("Proposal created successfully");
    },
    onError: () => {
      toast.error("Failed to create proposal");
    },
  });

  const updateProposalMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Proposal> }) => proposalsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposalMetrics"] });
      toast.success("Proposal updated successfully");
    },
  });

  const addOptionMutation = useMutation({
    mutationFn: ({ id, option }: { id: string; option: { tier: string; name: string; description?: string; is_recommended?: boolean } }) => 
      proposalsApi.addOption(id, option),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      setShowAddOptionDialog(false);
      toast.success("Option added to proposal");
    },
  });

  const handleCreateProposal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createProposalMutation.mutate({
      customer_name: formData.get("customer_name") as string,
      customer_email: formData.get("customer_email") as string || undefined,
      customer_phone: formData.get("customer_phone") as string || undefined,
      site_address: formData.get("site_address") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string || undefined,
      valid_until: formData.get("valid_until") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    });
  };

  const handleAddOption = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProposal) return;
    
    const formData = new FormData(e.currentTarget);
    addOptionMutation.mutate({
      id: selectedProposal.id,
      option: {
        tier: formData.get("tier") as string,
        name: formData.get("option_name") as string,
        description: formData.get("option_description") as string || undefined,
        is_recommended: formData.get("is_recommended") === "on",
      },
    });
  };

  const filteredProposals = proposals.filter(p => 
    searchQuery === "" || 
    p.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.proposal_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Proposals</h1>
          <p className="text-sm text-muted-foreground">
            Good/Better/Best proposal management (RFC-002 Section 4.1.3)
          </p>
        </div>
        <Dialog open={showNewProposalDialog} onOpenChange={setShowNewProposalDialog}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" data-testid="new-proposal-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Proposal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Proposal</DialogTitle>
              <DialogDescription>
                Create a Good/Better/Best proposal for your customer
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateProposal} className="space-y-4">
              <div>
                <Label htmlFor="title">Proposal Title *</Label>
                <Input id="title" name="title" required placeholder="New AC System Installation" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer_name">Customer Name *</Label>
                  <Input id="customer_name" name="customer_name" required placeholder="John Smith" />
                </div>
                <div>
                  <Label htmlFor="customer_email">Email</Label>
                  <Input id="customer_email" name="customer_email" type="email" placeholder="john@example.com" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer_phone">Phone</Label>
                  <Input id="customer_phone" name="customer_phone" placeholder="(555) 123-4567" />
                </div>
                <div>
                  <Label htmlFor="valid_until">Valid Until</Label>
                  <Input id="valid_until" name="valid_until" type="date" />
                </div>
              </div>
              <div>
                <Label htmlFor="site_address">Site Address *</Label>
                <Input id="site_address" name="site_address" required placeholder="123 Main St, City, State 12345" />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" placeholder="Proposal details..." />
              </div>
              <div>
                <Label htmlFor="proposal_notes">Internal Notes</Label>
                <Textarea id="proposal_notes" name="notes" placeholder="Notes for internal use..." />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowNewProposalDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createProposalMutation.isPending}>
                  {createProposalMutation.isPending ? "Creating..." : "Create Proposal"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <FileText className="w-4 h-4" />
            Total Proposals
          </div>
          <div className="text-2xl font-bold">{metrics?.total_proposals || 0}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Clock className="w-4 h-4" />
            Open Quotes
          </div>
          <div className="text-2xl font-bold text-yellow-400">{metrics?.open_quotes || 0}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            Win Rate
          </div>
          <div className="text-2xl font-bold text-emerald-400">{metrics?.win_rate || 0}%</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            Accepted
          </div>
          <div className="text-2xl font-bold text-cyan-400">{metrics?.by_status?.accepted || 0}</div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search proposals..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="proposal-search-input"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="proposal-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="viewed">Viewed</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Proposals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            Loading proposals...
          </div>
        ) : filteredProposals.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No proposals found. Create your first proposal!
          </div>
        ) : (
          filteredProposals.map((proposal) => {
            const statusCfg = statusConfig[proposal.status] || statusConfig.draft;
            return (
              <motion.div
                key={proposal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="hover:border-accent/50 transition-colors cursor-pointer" data-testid={`proposal-card-${proposal.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-mono text-xs text-muted-foreground">{proposal.proposal_number}</div>
                        <CardTitle className="text-lg">{proposal.title}</CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedProposal(proposal);
                            setShowAddOptionDialog(true);
                          }}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Option
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            updateProposalMutation.mutate({ id: proposal.id, data: { status: "sent" } });
                          }}>
                            <Send className="w-4 h-4 mr-2" />
                            Mark as Sent
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            updateProposalMutation.mutate({ id: proposal.id, data: { status: "accepted" } });
                          }}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Mark Accepted
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription>{proposal.customer_name}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className={`${statusCfg.color} border`}>
                        {statusCfg.label}
                      </Badge>
                      {proposal.valid_until && (
                        <span className="text-xs text-muted-foreground">
                          Valid until: {new Date(proposal.valid_until).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    
                    {/* Options summary */}
                    {proposal.options.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground font-medium">Options ({proposal.options.length})</div>
                        <div className="flex flex-wrap gap-1">
                          {proposal.options.map((option) => {
                            const tierCfg = tierConfig[option.tier] || tierConfig.good;
                            return (
                              <Badge key={option.id} className={`${tierCfg.color} text-xs`}>
                                {option.is_recommended && <Star className="w-3 h-3 mr-1" />}
                                {option.name}
                                {option.total > 0 && ` - $${option.total.toLocaleString()}`}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">
                        No options added yet
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground">
                      Created: {new Date(proposal.created_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Add Option Dialog */}
      <Dialog open={showAddOptionDialog} onOpenChange={setShowAddOptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Proposal Option</DialogTitle>
            <DialogDescription>
              Add a Good/Better/Best option to this proposal
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddOption} className="space-y-4">
            <div>
              <Label htmlFor="tier">Option Tier *</Label>
              <Select name="tier" defaultValue="good">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="better">Better</SelectItem>
                  <SelectItem value="best">Best</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="option_name">Option Name *</Label>
              <Input id="option_name" name="option_name" required placeholder="Standard System" />
            </div>
            <div>
              <Label htmlFor="option_description">Description</Label>
              <Textarea id="option_description" name="option_description" placeholder="Option details..." />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_recommended" name="is_recommended" className="rounded" />
              <Label htmlFor="is_recommended" className="cursor-pointer">Mark as recommended</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddOptionDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addOptionMutation.isPending}>
                {addOptionMutation.isPending ? "Adding..." : "Add Option"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
