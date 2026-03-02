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
  Card,
  CardContent,
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
  DollarSign,
  FileText,
  CreditCard,
  Building2,
  MoreVertical,
  Send,
  CheckCircle,
  Clock,
  AlertTriangle,
  Banknote,
  Receipt,
} from "lucide-react";
import { invoicesApi, paymentsApi, stripePaymentsApi, InvoiceRecord, PaymentRecord } from "@/lib/api";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const invoiceStatusConfig: { [key: string]: { label: string; color: string; icon: React.ElementType } } = {
  draft: { label: "Draft", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: FileText },
  sent: { label: "Sent", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Send },
  partially_paid: { label: "Partial", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  paid: { label: "Paid", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle },
  void: { label: "Void", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertTriangle },
  overdue: { label: "Overdue", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: AlertTriangle },
};

const paymentMethodConfig: { [key: string]: { label: string; icon: React.ElementType } } = {
  card: { label: "Credit Card", icon: CreditCard },
  ach: { label: "ACH/Bank", icon: Building2 },
  check: { label: "Check", icon: FileText },
  cash: { label: "Cash", icon: Banknote },
  financing: { label: "Financing", icon: DollarSign },
  other: { label: "Other", icon: Receipt },
};

export default function Invoices() {
  const [activeTab, setActiveTab] = useState("invoices");
  const [showNewInvoiceDialog, setShowNewInvoiceDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  
  const queryClient = useQueryClient();

  // Check for payment return from Stripe
  React.useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const paymentSuccess = searchParams.get('payment_success');
    const paymentCancelled = searchParams.get('payment_cancelled');
    
    if (paymentCancelled) {
      toast.info("Payment was cancelled");
      setSearchParams({});
      return;
    }
    
    if (sessionId && paymentSuccess) {
      // Poll for payment status
      const pollStatus = async (attempts = 0) => {
        const maxAttempts = 5;
        const pollInterval = 2000;
        
        if (attempts >= maxAttempts) {
          toast.warning("Payment status check timed out. Please check your email for confirmation.");
          setSearchParams({});
          return;
        }
        
        try {
          const status = await stripePaymentsApi.getCheckoutStatus(sessionId);
          
          if (status.payment_status === 'paid') {
            toast.success("Payment successful! Thank you.");
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            queryClient.invalidateQueries({ queryKey: ["payments"] });
            setSearchParams({});
            return;
          } else if (status.status === 'expired') {
            toast.error("Payment session expired. Please try again.");
            setSearchParams({});
            return;
          }
          
          // Continue polling if still pending
          setTimeout(() => pollStatus(attempts + 1), pollInterval);
        } catch (error) {
          console.error('Error checking payment status:', error);
          setSearchParams({});
        }
      };
      
      pollStatus();
    }
  }, [searchParams, setSearchParams, queryClient]);

  // Queries
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: () => invoicesApi.getAll({
      status: statusFilter !== "all" ? statusFilter : undefined,
    }),
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: () => paymentsApi.getAll(),
  });

  // Handle Pay Online
  const handlePayOnline = async (invoice: InvoiceRecord) => {
    setIsProcessingPayment(true);
    try {
      const session = await stripePaymentsApi.createCheckoutSession(invoice.id);
      // Redirect to Stripe checkout
      window.location.href = session.checkout_url;
    } catch (error: any) {
      toast.error(error?.message || "Failed to initiate payment");
      setIsProcessingPayment(false);
    }
  };

  // Queries
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: () => invoicesApi.getAll({
      status: statusFilter !== "all" ? statusFilter : undefined,
    }),
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: () => paymentsApi.getAll(),
  });

  // Mutations
  const createInvoiceMutation = useMutation({
    mutationFn: invoicesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setShowNewInvoiceDialog(false);
      toast.success("Invoice created successfully");
    },
    onError: () => {
      toast.error("Failed to create invoice");
    },
  });

  const updateInvoiceStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => invoicesApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice status updated");
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: paymentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setShowPaymentDialog(false);
      setSelectedInvoice(null);
      toast.success("Payment recorded successfully");
    },
    onError: () => {
      toast.error("Failed to record payment");
    },
  });

  const handleCreateInvoice = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const lineItems = [];
    const laborHours = parseFloat(formData.get("labor_hours") as string) || 0;
    const laborRate = parseFloat(formData.get("labor_rate") as string) || 95;
    const partsTotal = parseFloat(formData.get("parts_total") as string) || 0;
    const tripCharge = parseFloat(formData.get("trip_charge") as string) || 89;
    
    if (laborHours > 0) {
      lineItems.push({
        line_type: "labor",
        description: "Labor",
        quantity: laborHours,
        unit: "hours",
        unit_price: laborRate,
      });
    }
    if (partsTotal > 0) {
      lineItems.push({
        line_type: "parts",
        description: "Parts & Materials",
        quantity: 1,
        unit: "lot",
        unit_price: partsTotal,
      });
    }
    if (tripCharge > 0) {
      lineItems.push({
        line_type: "trip",
        description: "Trip Charge",
        quantity: 1,
        unit: "each",
        unit_price: tripCharge,
      });
    }
    
    createInvoiceMutation.mutate({
      customer_name: formData.get("customer_name") as string,
      customer_email: formData.get("customer_email") as string || undefined,
      billing_address: formData.get("billing_address") as string || undefined,
      line_items: lineItems,
      tax_rate: parseFloat(formData.get("tax_rate") as string) || 0,
      due_date: formData.get("due_date") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    });
  };

  const handleRecordPayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    
    const formData = new FormData(e.currentTarget);
    createPaymentMutation.mutate({
      invoice_id: selectedInvoice.id,
      payment_method: formData.get("payment_method") as string,
      amount: parseFloat(formData.get("amount") as string),
      card_last_four: formData.get("card_last_four") as string || undefined,
      check_number: formData.get("check_number") as string || undefined,
      notes: formData.get("payment_notes") as string || undefined,
    });
  };

  // Calculate totals
  const totalOutstanding = invoices
    .filter(inv => !["paid", "void"].includes(inv.status))
    .reduce((sum, inv) => sum + inv.balance_due, 0);
  
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  
  const overdueCount = invoices.filter(inv => inv.status === "overdue" || 
    (inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== "paid")).length;

  const filteredInvoices = invoices.filter(inv =>
    searchQuery === "" ||
    inv.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices & Payments</h1>
          <p className="text-sm text-muted-foreground">
            Billing and payment management (RFC-002 Section 4.6)
          </p>
        </div>
        <Dialog open={showNewInvoiceDialog} onOpenChange={setShowNewInvoiceDialog}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" data-testid="new-invoice-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
              <DialogDescription>
                Create an invoice using RFC-002 pricing formula
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
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
              <div>
                <Label htmlFor="billing_address">Billing Address</Label>
                <Input id="billing_address" name="billing_address" placeholder="123 Main St, City, State 12345" />
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Line Items (RFC-002 Formula)</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Price = (Labor Rate x Hours) + Parts + Trip Fee
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="labor_hours">Labor Hours</Label>
                    <Input id="labor_hours" name="labor_hours" type="number" step="0.5" placeholder="0" />
                  </div>
                  <div>
                    <Label htmlFor="labor_rate">Labor Rate ($/hr)</Label>
                    <Input id="labor_rate" name="labor_rate" type="number" step="0.01" defaultValue="95" />
                  </div>
                  <div>
                    <Label htmlFor="parts_total">Parts & Materials ($)</Label>
                    <Input id="parts_total" name="parts_total" type="number" step="0.01" placeholder="0" />
                  </div>
                  <div>
                    <Label htmlFor="trip_charge">Trip Charge ($)</Label>
                    <Input id="trip_charge" name="trip_charge" type="number" step="0.01" defaultValue="89" />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                  <Input id="tax_rate" name="tax_rate" type="number" step="0.01" defaultValue="0" />
                </div>
                <div>
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input id="due_date" name="due_date" type="date" />
                </div>
              </div>
              <div>
                <Label htmlFor="invoice_notes">Notes</Label>
                <Textarea id="invoice_notes" name="notes" placeholder="Invoice notes..." />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowNewInvoiceDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createInvoiceMutation.isPending}>
                  {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
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
            Total Invoices
          </div>
          <div className="text-2xl font-bold">{invoices.length}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Clock className="w-4 h-4" />
            Outstanding
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            ${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <CheckCircle className="w-4 h-4" />
            Collected
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <AlertTriangle className="w-4 h-4" />
            Overdue
          </div>
          <div className="text-2xl font-bold text-red-400">{overdueCount}</div>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="invoices" className="data-[state=active]:bg-background">
            Invoices ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="data-[state=active]:bg-background">
            Payments ({payments.length})
          </TabsTrigger>
        </TabsList>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="invoice-search-input"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="invoice-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="partially_paid">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="void">Void</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            {invoicesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading invoices...</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No invoices found. Create your first invoice!
              </div>
            ) : (
              filteredInvoices.map((invoice) => {
                const statusCfg = invoiceStatusConfig[invoice.status] || invoiceStatusConfig.draft;
                const StatusIcon = statusCfg.icon;
                const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== "paid";
                
                return (
                  <motion.div key={invoice.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="hover:border-accent/50 transition-colors" data-testid={`invoice-card-${invoice.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-sm font-medium">{invoice.invoice_number}</span>
                              <Badge className={`${statusCfg.color} border`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusCfg.label}
                              </Badge>
                              {isOverdue && (
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border">OVERDUE</Badge>
                              )}
                            </div>
                            <div className="font-medium">{invoice.customer_name}</div>
                            {invoice.job_number && (
                              <div className="text-xs text-muted-foreground">Job: {invoice.job_number}</div>
                            )}
                          </div>
                          
                          <div className="text-right">
                            <div className="text-xl font-bold">
                              ${invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            {invoice.balance_due > 0 && invoice.balance_due !== invoice.total && (
                              <div className="text-sm text-yellow-400">
                                Due: ${invoice.balance_due.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                            )}
                            {invoice.due_date && (
                              <div className={`text-xs ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
                                Due: {new Date(invoice.due_date).toLocaleDateString()}
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
                              {invoice.status !== "paid" && invoice.balance_due > 0 && (
                                <DropdownMenuItem 
                                  onClick={() => handlePayOnline(invoice)}
                                  disabled={isProcessingPayment}
                                  className="text-emerald-400"
                                  data-testid={`pay-online-${invoice.id}`}
                                >
                                  <CreditCard className="w-4 h-4 mr-2" />
                                  Pay Online
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => { setSelectedInvoice(invoice); setShowPaymentDialog(true); }}>
                                <CreditCard className="w-4 h-4 mr-2" />Record Payment
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateInvoiceStatusMutation.mutate({ id: invoice.id, status: "sent" })}>
                                <Send className="w-4 h-4 mr-2" />Mark as Sent
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateInvoiceStatusMutation.mutate({ id: invoice.id, status: "paid" })}>
                                <CheckCircle className="w-4 h-4 mr-2" />Mark as Paid
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateInvoiceStatusMutation.mutate({ id: invoice.id, status: "void" })} className="text-red-400">
                                <AlertTriangle className="w-4 h-4 mr-2" />Void Invoice
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {invoice.labor_total > 0 && <span>Labor: ${invoice.labor_total.toFixed(2)}</span>}
                          {invoice.parts_total > 0 && <span>Parts: ${invoice.parts_total.toFixed(2)}</span>}
                          {invoice.trip_total > 0 && <span>Trip: ${invoice.trip_total.toFixed(2)}</span>}
                          {invoice.tax_amount > 0 && <span>Tax: ${invoice.tax_amount.toFixed(2)}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <div className="grid gap-4">
            {paymentsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading payments...</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No payments recorded yet.</div>
            ) : (
              payments.map((payment) => {
                const methodCfg = paymentMethodConfig[payment.payment_method] || paymentMethodConfig.other;
                const MethodIcon = methodCfg.icon;
                
                return (
                  <motion.div key={payment.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card data-testid={`payment-card-${payment.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/20 rounded-lg">
                              <MethodIcon className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                              <div className="font-mono text-sm">{payment.payment_number}</div>
                              <div className="font-medium">{payment.customer_name}</div>
                              <div className="text-xs text-muted-foreground">
                                Invoice: {payment.invoice_number} - {methodCfg.label}
                                {payment.card_last_four && ` ****${payment.card_last_four}`}
                                {payment.check_number && ` #${payment.check_number}`}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-emerald-400">
                              +${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(payment.created_at).toLocaleDateString()}
                            </div>
                          </div>
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

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={(open) => { setShowPaymentDialog(open); if (!open) setSelectedInvoice(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {selectedInvoice && <>Invoice {selectedInvoice.invoice_number} - Balance: ${selectedInvoice.balance_due.toFixed(2)}</>}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div>
              <Label htmlFor="payment_method">Payment Method *</Label>
              <Select name="payment_method" defaultValue="card">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Credit Card</SelectItem>
                  <SelectItem value="ach">ACH/Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="financing">Financing</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required defaultValue={selectedInvoice?.balance_due} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="card_last_four">Card Last 4 (if card)</Label>
                <Input id="card_last_four" name="card_last_four" maxLength={4} placeholder="1234" />
              </div>
              <div>
                <Label htmlFor="check_number">Check # (if check)</Label>
                <Input id="check_number" name="check_number" placeholder="1001" />
              </div>
            </div>
            <div>
              <Label htmlFor="payment_notes">Notes</Label>
              <Textarea id="payment_notes" name="payment_notes" placeholder="Payment notes..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createPaymentMutation.isPending}>
                {createPaymentMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
