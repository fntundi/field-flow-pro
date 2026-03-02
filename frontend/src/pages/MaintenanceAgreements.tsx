import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  Plus,
  Calendar,
  User,
  MapPin,
  DollarSign,
  Loader2,
  RefreshCw,
  Play,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { maintenanceApi, MaintenanceAgreement } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const MaintenanceAgreements = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [agreements, setAgreements] = useState<MaintenanceAgreement[]>([]);
  const [dueRenewals, setDueRenewals] = useState<MaintenanceAgreement[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<MaintenanceAgreement | null>(null);
  
  // Filter
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // New agreement form
  const [newAgreement, setNewAgreement] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    service_address: "",
    frequency: "annual" as const,
    start_date: new Date().toISOString().split("T")[0],
    annual_price: 299,
    payment_frequency: "annual" as const,
    auto_renew: true,
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allAgreements, renewals] = await Promise.all([
        maintenanceApi.getAgreements(),
        maintenanceApi.getDueRenewals(30),
      ]);
      setAgreements(allAgreements);
      setDueRenewals(renewals);
    } catch (error) {
      console.error("Error fetching agreements:", error);
      toast({
        title: "Error",
        description: "Failed to load maintenance agreements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newAgreement.customer_name || !newAgreement.service_address) {
      toast({ title: "Missing Fields", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    
    try {
      await maintenanceApi.createAgreement(newAgreement);
      toast({ title: "Agreement Created", description: "New maintenance agreement has been created" });
      setCreateOpen(false);
      setNewAgreement({
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        service_address: "",
        frequency: "annual",
        start_date: new Date().toISOString().split("T")[0],
        annual_price: 299,
        payment_frequency: "annual",
        auto_renew: true,
        notes: "",
      });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleGenerateJobs = async (agreementId: string) => {
    try {
      const result = await maintenanceApi.generateJobs(agreementId);
      toast({
        title: "Jobs Generated",
        description: `${result.job_ids.length} maintenance jobs have been scheduled`,
      });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (agreementId: string, status: string) => {
    try {
      await maintenanceApi.updateAgreement(agreementId, { status: status as any });
      toast({ title: "Status Updated" });
      fetchData();
      setSelectedAgreement(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filteredAgreements = statusFilter === "all" 
    ? agreements 
    : agreements.filter(a => a.status === statusFilter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>;
      case "pending": return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Pending</Badge>;
      case "expired": return <Badge className="bg-red-100 text-red-700 border-red-200">Expired</Badge>;
      case "cancelled": return <Badge className="bg-gray-100 text-gray-700 border-gray-200">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case "monthly": return "Monthly";
      case "quarterly": return "Quarterly";
      case "semi_annual": return "Semi-Annual";
      case "annual": return "Annual";
      default: return freq;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Maintenance Agreements</h1>
          <p className="text-muted-foreground">Manage recurring maintenance contracts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Agreement
          </Button>
        </div>
      </div>

      {/* Renewals Alert */}
      {dueRenewals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-lg p-4"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">{dueRenewals.length} agreements due for renewal</p>
              <p className="text-sm text-amber-600">Review and process renewals before expiration</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Shield className="w-4 h-4" />
            <span className="text-xs">Total Agreements</span>
          </div>
          <p className="text-2xl font-bold">{agreements.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs">Active</span>
          </div>
          <p className="text-2xl font-bold">{agreements.filter(a => a.status === "active").length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-xs">Due for Renewal</span>
          </div>
          <p className="text-2xl font-bold">{dueRenewals.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs">Annual Revenue</span>
          </div>
          <p className="text-2xl font-bold">
            ${agreements.filter(a => a.status === "active").reduce((sum, a) => sum + a.annual_price, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Agreements Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agreement #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Next Service</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAgreements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No agreements found
                </TableCell>
              </TableRow>
            ) : (
              filteredAgreements.map((agreement) => (
                <TableRow
                  key={agreement.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedAgreement(agreement)}
                >
                  <TableCell className="font-mono text-sm">{agreement.agreement_number}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{agreement.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{agreement.service_address}</p>
                    </div>
                  </TableCell>
                  <TableCell>{getFrequencyLabel(agreement.frequency)}</TableCell>
                  <TableCell>{agreement.next_service_date || "—"}</TableCell>
                  <TableCell>{agreement.end_date}</TableCell>
                  <TableCell>${agreement.annual_price}/yr</TableCell>
                  <TableCell>{getStatusBadge(agreement.status)}</TableCell>
                  <TableCell>
                    {agreement.status === "active" && agreement.generated_job_ids.length === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateJobs(agreement.id);
                        }}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Generate Jobs
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Agreement Sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Maintenance Agreement</SheetTitle>
            <SheetDescription>Create a recurring maintenance contract</SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <div>
              <Label>Customer Name *</Label>
              <Input
                value={newAgreement.customer_name}
                onChange={(e) => setNewAgreement({ ...newAgreement, customer_name: e.target.value })}
                placeholder="John Smith"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newAgreement.customer_email}
                  onChange={(e) => setNewAgreement({ ...newAgreement, customer_email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={newAgreement.customer_phone}
                  onChange={(e) => setNewAgreement({ ...newAgreement, customer_phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            
            <div>
              <Label>Service Address *</Label>
              <Input
                value={newAgreement.service_address}
                onChange={(e) => setNewAgreement({ ...newAgreement, service_address: e.target.value })}
                placeholder="123 Main St, City, ST 12345"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Frequency</Label>
                <Select
                  value={newAgreement.frequency}
                  onValueChange={(v) => setNewAgreement({ ...newAgreement, frequency: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={newAgreement.start_date}
                  onChange={(e) => setNewAgreement({ ...newAgreement, start_date: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Annual Price ($)</Label>
                <Input
                  type="number"
                  value={newAgreement.annual_price}
                  onChange={(e) => setNewAgreement({ ...newAgreement, annual_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Payment</Label>
                <Select
                  value={newAgreement.payment_frequency}
                  onValueChange={(v) => setNewAgreement({ ...newAgreement, payment_frequency: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_renew"
                checked={newAgreement.auto_renew}
                onChange={(e) => setNewAgreement({ ...newAgreement, auto_renew: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="auto_renew">Auto-renew agreement</Label>
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea
                value={newAgreement.notes}
                onChange={(e) => setNewAgreement({ ...newAgreement, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
            
            <Button onClick={handleCreate} className="w-full">
              Create Agreement
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Agreement Detail Sheet */}
      <Sheet open={!!selectedAgreement} onOpenChange={() => setSelectedAgreement(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedAgreement?.agreement_number}</SheetTitle>
            <SheetDescription>{selectedAgreement?.customer_name}</SheetDescription>
          </SheetHeader>
          
          {selectedAgreement && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium">{getStatusBadge(selectedAgreement.status)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Frequency</p>
                  <p className="font-medium">{getFrequencyLabel(selectedAgreement.frequency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Start Date</p>
                  <p className="font-medium">{selectedAgreement.start_date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">End Date</p>
                  <p className="font-medium">{selectedAgreement.end_date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Next Service</p>
                  <p className="font-medium">{selectedAgreement.next_service_date || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Annual Price</p>
                  <p className="font-medium">${selectedAgreement.annual_price}</p>
                </div>
              </div>
              
              <div>
                <p className="text-muted-foreground text-sm">Service Address</p>
                <p className="font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {selectedAgreement.service_address}
                </p>
              </div>
              
              {selectedAgreement.customer_email && (
                <div>
                  <p className="text-muted-foreground text-sm">Email</p>
                  <p className="font-medium">{selectedAgreement.customer_email}</p>
                </div>
              )}
              
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Actions</p>
                <div className="space-y-2">
                  {selectedAgreement.status === "active" && selectedAgreement.generated_job_ids.length === 0 && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleGenerateJobs(selectedAgreement.id)}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Generate Scheduled Jobs
                    </Button>
                  )}
                  {selectedAgreement.status === "pending" && (
                    <Button
                      className="w-full"
                      onClick={() => handleUpdateStatus(selectedAgreement.id, "active")}
                    >
                      Activate Agreement
                    </Button>
                  )}
                  {selectedAgreement.status === "active" && (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => handleUpdateStatus(selectedAgreement.id, "cancelled")}
                    >
                      Cancel Agreement
                    </Button>
                  )}
                </div>
              </div>
              
              {selectedAgreement.generated_job_ids.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-sm">Generated Jobs</p>
                  <p className="font-medium">{selectedAgreement.generated_job_ids.length} jobs scheduled</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MaintenanceAgreements;
