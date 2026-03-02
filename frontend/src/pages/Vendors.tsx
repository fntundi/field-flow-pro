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
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Building2,
  Package,
  FileText,
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  Clock,
  Truck,
  Send,
} from "lucide-react";
import { vendorsApi, purchaseOrdersApi, Vendor, PurchaseOrder } from "@/lib/api";
import { toast } from "sonner";

const poStatusConfig: { [key: string]: { label: string; color: string } } = {
  draft: { label: "Draft", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  submitted: { label: "Submitted", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  confirmed: { label: "Confirmed", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  partial: { label: "Partial", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  received: { label: "Received", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  cancelled: { label: "Cancelled", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function Vendors() {
  const [activeTab, setActiveTab] = useState("vendors");
  const [showNewVendorDialog, setShowNewVendorDialog] = useState(false);
  const [showNewPODialog, setShowNewPODialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const queryClient = useQueryClient();

  // Queries
  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => vendorsApi.getAll(),
  });

  const { data: purchaseOrders = [], isLoading: posLoading } = useQuery({
    queryKey: ["purchaseOrders", statusFilter],
    queryFn: () => purchaseOrdersApi.getAll({
      status: statusFilter !== "all" ? statusFilter : undefined,
    }),
  });

  // Mutations
  const createVendorMutation = useMutation({
    mutationFn: vendorsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setShowNewVendorDialog(false);
      toast.success("Vendor created successfully");
    },
    onError: () => {
      toast.error("Failed to create vendor");
    },
  });

  const updateVendorMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Vendor> }) => vendorsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor updated");
    },
  });

  const createPOMutation = useMutation({
    mutationFn: purchaseOrdersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      setShowNewPODialog(false);
      toast.success("Purchase order created");
    },
    onError: () => {
      toast.error("Failed to create purchase order");
    },
  });

  const updatePOStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => purchaseOrdersApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      toast.success("PO status updated");
    },
  });

  const handleCreateVendor = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createVendorMutation.mutate({
      name: formData.get("name") as string,
      contact_name: formData.get("contact_name") as string || undefined,
      email: formData.get("email") as string || undefined,
      phone: formData.get("phone") as string || undefined,
      address: formData.get("address") as string || undefined,
      city: formData.get("city") as string || undefined,
      state: formData.get("state") as string || undefined,
      zip_code: formData.get("zip_code") as string || undefined,
      payment_terms: formData.get("payment_terms") as string || "Net 30",
      account_number: formData.get("account_number") as string || undefined,
      notes: formData.get("vendor_notes") as string || undefined,
    });
  };

  const handleCreatePO = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createPOMutation.mutate({
      vendor_id: formData.get("vendor_id") as string,
      expected_date: formData.get("expected_date") as string || undefined,
      notes: formData.get("po_notes") as string || undefined,
    });
  };

  const filteredVendors = vendors.filter(v =>
    searchQuery === "" ||
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.vendor_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPOs = purchaseOrders.length;
  const pendingPOs = purchaseOrders.filter(po => ["draft", "submitted", "confirmed"].includes(po.status)).length;
  const totalValue = purchaseOrders.reduce((sum, po) => sum + po.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendors & Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">
            Vendor and procurement management (RFC-002 Section 4.7.2)
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showNewPODialog} onOpenChange={setShowNewPODialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="new-po-btn">
                <FileText className="w-4 h-4 mr-2" />
                New PO
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
                <DialogDescription>Create a new purchase order for a vendor</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreatePO} className="space-y-4">
                <div>
                  <Label htmlFor="vendor_id">Vendor *</Label>
                  <Select name="vendor_id" required>
                    <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                    <SelectContent>
                      {vendors.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="expected_date">Expected Delivery Date</Label>
                  <Input id="expected_date" name="expected_date" type="date" />
                </div>
                <div>
                  <Label htmlFor="po_notes">Notes</Label>
                  <Textarea id="po_notes" name="po_notes" placeholder="PO notes..." />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowNewPODialog(false)}>Cancel</Button>
                  <Button type="submit" disabled={createPOMutation.isPending}>
                    {createPOMutation.isPending ? "Creating..." : "Create PO"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showNewVendorDialog} onOpenChange={setShowNewVendorDialog}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90" data-testid="new-vendor-btn">
                <Plus className="w-4 h-4 mr-2" />
                New Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Vendor</DialogTitle>
                <DialogDescription>Add a new supplier to your vendor list</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateVendor} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Vendor Name *</Label>
                    <Input id="name" name="name" required placeholder="HVAC Supply Co." />
                  </div>
                  <div>
                    <Label htmlFor="contact_name">Contact Name</Label>
                    <Input id="contact_name" name="contact_name" placeholder="John Smith" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="orders@vendor.com" />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" placeholder="(555) 123-4567" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" placeholder="123 Industrial Blvd" />
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="payment_terms">Payment Terms</Label>
                    <Select name="payment_terms" defaultValue="Net 30">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COD">COD</SelectItem>
                        <SelectItem value="Net 15">Net 15</SelectItem>
                        <SelectItem value="Net 30">Net 30</SelectItem>
                        <SelectItem value="Net 45">Net 45</SelectItem>
                        <SelectItem value="Net 60">Net 60</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="account_number">Account Number</Label>
                    <Input id="account_number" name="account_number" placeholder="Optional" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="vendor_notes">Notes</Label>
                  <Textarea id="vendor_notes" name="vendor_notes" placeholder="Additional notes..." />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowNewVendorDialog(false)}>Cancel</Button>
                  <Button type="submit" disabled={createVendorMutation.isPending}>
                    {createVendorMutation.isPending ? "Creating..." : "Add Vendor"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Building2 className="w-4 h-4" />
            Active Vendors
          </div>
          <div className="text-2xl font-bold">{vendors.filter(v => v.is_active).length}</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <FileText className="w-4 h-4" />
            Total POs
          </div>
          <div className="text-2xl font-bold">{totalPOs}</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Clock className="w-4 h-4" />
            Pending
          </div>
          <div className="text-2xl font-bold text-yellow-400">{pendingPOs}</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Package className="w-4 h-4" />
            Total Value
          </div>
          <div className="text-2xl font-bold text-cyan-400">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="vendors" className="data-[state=active]:bg-background">
            Vendors ({vendors.length})
          </TabsTrigger>
          <TabsTrigger value="pos" className="data-[state=active]:bg-background">
            Purchase Orders ({purchaseOrders.length})
          </TabsTrigger>
        </TabsList>

        {/* Vendors Tab */}
        <TabsContent value="vendors" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="vendor-search-input"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vendorsLoading ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">Loading vendors...</div>
            ) : filteredVendors.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">No vendors found.</div>
            ) : (
              filteredVendors.map((vendor) => (
                <motion.div key={vendor.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="hover:border-accent/50 transition-colors" data-testid={`vendor-card-${vendor.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Building2 className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <div className="font-mono text-xs text-muted-foreground">{vendor.vendor_number}</div>
                            <div className="font-medium">{vendor.name}</div>
                            {vendor.contact_name && (
                              <div className="text-xs text-muted-foreground">{vendor.contact_name}</div>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateVendorMutation.mutate({ id: vendor.id, data: { is_active: !vendor.is_active } })}>
                              {vendor.is_active ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                        {vendor.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3" />{vendor.email}
                          </div>
                        )}
                        {vendor.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" />{vendor.phone}
                          </div>
                        )}
                        {vendor.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3" />
                            {vendor.city ? `${vendor.city}, ${vendor.state}` : vendor.address}
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                        <Badge className={vendor.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"}>
                          {vendor.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{vendor.payment_terms}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Purchase Orders Tab */}
        <TabsContent value="pos" className="space-y-4">
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="po-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            {posLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading purchase orders...</div>
            ) : purchaseOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No purchase orders found.</div>
            ) : (
              purchaseOrders.map((po) => {
                const statusCfg = poStatusConfig[po.status] || poStatusConfig.draft;
                return (
                  <motion.div key={po.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="hover:border-accent/50 transition-colors" data-testid={`po-card-${po.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                              <FileText className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium">{po.po_number}</span>
                                <Badge className={`${statusCfg.color} border`}>{statusCfg.label}</Badge>
                              </div>
                              <div className="font-medium">{po.vendor_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {po.line_items.length} items
                                {po.expected_date && ` • Expected: ${new Date(po.expected_date).toLocaleDateString()}`}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-xl font-bold">
                              ${po.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            {po.receive_to_location_name && (
                              <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                <Truck className="w-3 h-3" />{po.receive_to_location_name}
                              </div>
                            )}
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updatePOStatusMutation.mutate({ id: po.id, status: "submitted" })}>
                                <Send className="w-4 h-4 mr-2" />Submit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updatePOStatusMutation.mutate({ id: po.id, status: "confirmed" })}>
                                <CheckCircle className="w-4 h-4 mr-2" />Confirm
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updatePOStatusMutation.mutate({ id: po.id, status: "received" })}>
                                <Truck className="w-4 h-4 mr-2" />Mark Received
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updatePOStatusMutation.mutate({ id: po.id, status: "cancelled" })} className="text-red-400">
                                Cancel
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
