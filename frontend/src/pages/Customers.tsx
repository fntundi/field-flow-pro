import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Phone,
  PhoneCall,
  Mail,
  MapPin,
  Building2,
  Home,
  Users,
  Briefcase,
  Loader2,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { customersApi, sitesApi, voipApi, Customer, Site, Job } from "@/lib/api";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

export default function Customers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailTab, setDetailTab] = useState("info");
  const [isCallingCustomer, setIsCallingCustomer] = useState<string | null>(null);

  // Queries
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => customersApi.getAll(search || undefined),
  });

  const { data: customerSites = [] } = useQuery({
    queryKey: ["customer-sites", selectedCustomer?.id],
    queryFn: () => selectedCustomer ? sitesApi.getAll({ customer_id: selectedCustomer.id }) : Promise.resolve([]),
    enabled: !!selectedCustomer,
  });

  // Click-to-call handler
  const handleClickToCall = async (phoneNumber: string, customerId: string, customerName: string) => {
    setIsCallingCustomer(customerId);
    try {
      const result = await voipApi.initiateCall({
        to_number: phoneNumber,
        customer_id: customerId,
        notes: `Call to customer: ${customerName}`,
      });
      
      if (result.success) {
        toast.success(result.demo_mode 
          ? `Demo call simulated to ${phoneNumber}` 
          : `Connecting to ${phoneNumber}`
        );
      } else {
        throw new Error("Call failed");
      }
    } catch (error) {
      toast.error("Could not initiate call");
    } finally {
      setIsCallingCustomer(null);
    }
  };

  // Send SMS handler
  const handleSendSMS = async (phoneNumber: string, customerId: string) => {
    // Navigate to communications page with pre-filled data
    navigate(`/communications?action=sms&to=${encodeURIComponent(phoneNumber)}&customer_id=${customerId}`);
  };

  // Stats
  const stats = {
    total: customers.length,
    residential: customers.filter(c => c.customer_type === "residential").length,
    commercial: customers.filter(c => c.customer_type === "commercial").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Manage customer accounts and service history
          </p>
        </div>
        <Button data-testid="add-customer-button">
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.residential}</p>
                <p className="text-xs text-muted-foreground">Residential</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats.commercial}</p>
                <p className="text-xs text-muted-foreground">Commercial</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search customers by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="customer-search-input"
        />
      </div>

      {/* Customers Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No customers found</h3>
            <p className="text-muted-foreground">
              {search ? "Try a different search term" : "Add your first customer to get started"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="hidden sm:table-cell">Actions</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setDetailTab("info");
                  }}
                  data-testid={`customer-row-${customer.id}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {customer.customer_type === "commercial" ? (
                          <Building2 className="w-5 h-5 text-primary" />
                        ) : (
                          <Home className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {customer.address}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="capitalize">
                      {customer.customer_type || "residential"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {customer.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span className="truncate max-w-[120px]">{customer.phone}</span>
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">{customer.email}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {customer.phone && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => handleClickToCall(customer.phone!, customer.id, customer.name)}
                          disabled={isCallingCustomer === customer.id}
                          data-testid={`call-customer-${customer.id}`}
                        >
                          {isCallingCustomer === customer.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <PhoneCall className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      {customer.phone && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => handleSendSMS(customer.phone!, customer.id)}
                          data-testid={`sms-customer-${customer.id}`}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      )}
                      {customer.email && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          asChild
                        >
                          <a href={`mailto:${customer.email}`}>
                            <Mail className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Customer Detail Sheet */}
      <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedCustomer && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    {selectedCustomer.customer_type === "commercial" ? (
                      <Building2 className="w-6 h-6 text-primary" />
                    ) : (
                      <Home className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <SheetTitle>{selectedCustomer.name}</SheetTitle>
                    <SheetDescription className="capitalize">
                      {selectedCustomer.customer_type || "Residential"} Customer
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              {/* Quick Actions */}
              <div className="flex gap-2 mt-4">
                {selectedCustomer.phone && (
                  <Button
                    size="sm"
                    onClick={() => handleClickToCall(
                      selectedCustomer.phone!,
                      selectedCustomer.id,
                      selectedCustomer.name
                    )}
                    disabled={isCallingCustomer === selectedCustomer.id}
                    data-testid="detail-call-button"
                  >
                    {isCallingCustomer === selectedCustomer.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <PhoneCall className="w-4 h-4 mr-2" />
                    )}
                    Call
                  </Button>
                )}
                {selectedCustomer.phone && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSendSMS(selectedCustomer.phone!, selectedCustomer.id)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    SMS
                  </Button>
                )}
                {selectedCustomer.email && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={`mailto:${selectedCustomer.email}`}>
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </a>
                  </Button>
                )}
              </div>

              <Tabs value={detailTab} onValueChange={setDetailTab} className="mt-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="sites">Sites ({customerSites.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-4">
                  {/* Contact Info */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Contact Information</h4>
                    {selectedCustomer.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedCustomer.phone}</span>
                      </div>
                    )}
                    {selectedCustomer.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedCustomer.email}</span>
                      </div>
                    )}
                    {selectedCustomer.address && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p>{selectedCustomer.address}</p>
                          {selectedCustomer.city && (
                            <p className="text-muted-foreground">
                              {selectedCustomer.city}, {selectedCustomer.state} {selectedCustomer.zip}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {selectedCustomer.notes && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Notes</h4>
                      <p className="text-sm text-muted-foreground">{selectedCustomer.notes}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="sites" className="mt-4">
                  {customerSites.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No sites registered</p>
                      <Button size="sm" variant="outline" className="mt-2" asChild>
                        <Link to="/sites">Add Site</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customerSites.map((site: Site) => (
                        <Card key={site.id} className="cursor-pointer hover:bg-muted/50">
                          <CardContent className="py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{site.name}</p>
                                <p className="text-xs text-muted-foreground">{site.address}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="capitalize text-xs">
                                  {site.site_type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {site.total_jobs} jobs
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
