import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  FileText,
  Briefcase,
  Shield,
  LogIn,
  LogOut,
  Plus,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Send,
  Home,
} from "lucide-react";
import {
  customerPortalApi,
  CustomerAccount,
  ServiceRequest,
  MaintenanceAgreement,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const CustomerPortal = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  const [token, setToken] = useState<string | null>(null);
  
  // Auth form state
  const [authMode, setAuthMode] = useState<"login" | "register" | "magic">("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    address: "",
  });
  
  // Data state
  const [loading, setLoading] = useState(false);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [agreements, setAgreements] = useState<MaintenanceAgreement[]>([]);
  
  // New request form
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    service_type: "repair" as const,
    description: "",
    urgency: "normal" as const,
    preferred_dates: [] as string[],
    preferred_time_of_day: "anytime" as const,
    service_address: "",
    access_instructions: "",
  });

  // Check for magic link token in URL
  useEffect(() => {
    const magicToken = searchParams.get("token");
    if (magicToken) {
      verifyMagicLink(magicToken);
    }
    
    // Check for stored session
    const storedToken = localStorage.getItem("customerToken");
    const storedCustomerId = localStorage.getItem("customerId");
    if (storedToken && storedCustomerId) {
      setToken(storedToken);
      fetchCustomerData(storedCustomerId);
    }
  }, [searchParams]);

  const verifyMagicLink = async (magicToken: string) => {
    setAuthLoading(true);
    try {
      const result = await customerPortalApi.verifyMagicLink(magicToken);
      setToken(result.token);
      localStorage.setItem("customerToken", result.token);
      localStorage.setItem("customerId", result.customer.id);
      await fetchCustomerData(result.customer.id);
      toast({ title: "Login Successful", description: `Welcome back, ${result.customer.name}!` });
      navigate("/customer", { replace: true });
    } catch (error: any) {
      toast({
        title: "Invalid Link",
        description: "This login link is invalid or has expired.",
        variant: "destructive",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchCustomerData = async (customerId: string) => {
    setLoading(true);
    try {
      const [profile, requests, customerJobs, customerAgreements] = await Promise.all([
        customerPortalApi.getProfile(customerId),
        customerPortalApi.getServiceRequests(customerId),
        customerPortalApi.getJobs(customerId),
        customerPortalApi.getAgreements(customerId),
      ]);
      setCustomer(profile);
      setServiceRequests(requests);
      setJobs(customerJobs);
      setAgreements(customerAgreements);
      setIsLoggedIn(true);
      
      // Set default address for new requests
      if (profile.addresses?.length > 0) {
        const primary = profile.addresses.find(a => a.is_primary) || profile.addresses[0];
        setNewRequest(prev => ({ ...prev, service_address: primary.address }));
      }
    } catch (error) {
      console.error("Error fetching customer data:", error);
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!authForm.email || !authForm.password) {
      toast({ title: "Missing Fields", description: "Please enter email and password", variant: "destructive" });
      return;
    }
    
    setAuthLoading(true);
    try {
      const result = await customerPortalApi.login(authForm.email, authForm.password);
      setToken(result.token);
      localStorage.setItem("customerToken", result.token);
      localStorage.setItem("customerId", result.customer.id);
      await fetchCustomerData(result.customer.id);
      toast({ title: "Login Successful", description: `Welcome back, ${result.customer.name}!` });
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!authForm.email || !authForm.password || !authForm.name) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    setAuthLoading(true);
    try {
      const result = await customerPortalApi.register({
        email: authForm.email,
        password: authForm.password,
        name: authForm.name,
        phone: authForm.phone,
        address: authForm.address,
      });
      toast({
        title: "Account Created",
        description: "Your account has been created. Please login.",
      });
      setAuthMode("login");
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!authForm.email) {
      toast({ title: "Email Required", description: "Please enter your email address", variant: "destructive" });
      return;
    }
    
    setAuthLoading(true);
    try {
      await customerPortalApi.requestMagicLink(authForm.email);
      toast({
        title: "Link Sent",
        description: "If an account exists, a login link has been sent to your email.",
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCustomer(null);
    setToken(null);
    localStorage.removeItem("customerToken");
    localStorage.removeItem("customerId");
    setAuthForm({ email: "", password: "", name: "", phone: "", address: "" });
  };

  const handleSubmitRequest = async () => {
    if (!customer || !newRequest.description || !newRequest.service_address) {
      toast({ title: "Missing Fields", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    try {
      const result = await customerPortalApi.createServiceRequest(customer.id, newRequest);
      toast({
        title: "Request Submitted",
        description: `Your request ${result.request_number} has been submitted.`,
      });
      setNewRequestOpen(false);
      setNewRequest({
        service_type: "repair",
        description: "",
        urgency: "normal",
        preferred_dates: [],
        preferred_time_of_day: "anytime",
        service_address: customer.addresses?.[0]?.address || "",
        access_instructions: "",
      });
      // Refresh requests
      const requests = await customerPortalApi.getServiceRequests(customer.id);
      setServiceRequests(requests);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      case "scheduled": return <Badge className="bg-blue-100 text-blue-700">Scheduled</Badge>;
      case "in_progress": return <Badge className="bg-yellow-100 text-yellow-700">In Progress</Badge>;
      case "pending": return <Badge className="bg-gray-100 text-gray-700">Pending</Badge>;
      case "cancelled": return <Badge className="bg-red-100 text-red-700">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Auth Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Home className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle>Customer Portal</CardTitle>
              <CardDescription>
                Access your service history, request appointments, and manage your HVAC maintenance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as any)}>
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="login" className="flex-1">Login</TabsTrigger>
                  <TabsTrigger value="register" className="flex-1">Register</TabsTrigger>
                  <TabsTrigger value="magic" className="flex-1">Magic Link</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login" className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                  <Button onClick={handleLogin} disabled={authLoading} className="w-full">
                    {authLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                    Login
                  </Button>
                </TabsContent>
                
                <TabsContent value="register" className="space-y-4">
                  <div>
                    <Label>Full Name *</Label>
                    <Input
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <Label>Password *</Label>
                    <Input
                      type="password"
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={authForm.phone}
                      onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <Label>Service Address</Label>
                    <Input
                      value={authForm.address}
                      onChange={(e) => setAuthForm({ ...authForm, address: e.target.value })}
                      placeholder="123 Main St, City, ST"
                    />
                  </div>
                  <Button onClick={handleRegister} disabled={authLoading} className="w-full">
                    {authLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <User className="w-4 h-4 mr-2" />}
                    Create Account
                  </Button>
                </TabsContent>
                
                <TabsContent value="magic" className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Enter your email and we'll send you a secure login link. No password needed!
                  </p>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      placeholder="you@example.com"
                    />
                  </div>
                  <Button onClick={handleMagicLink} disabled={authLoading} className="w-full">
                    {authLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Send Magic Link
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Main Portal
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Home className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="font-bold">BreezeFlow</h1>
              <p className="text-xs text-muted-foreground">Customer Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">Welcome, {customer?.name}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-4">
              <Button onClick={() => setNewRequestOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Request Service
              </Button>
            </div>

            {/* Dashboard Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Appointments</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{jobs.filter(j => j.status === "scheduled").length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Agreements</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{agreements.filter(a => a.status === "active").length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{serviceRequests.filter(r => r.status === "pending").length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="jobs">
              <TabsList>
                <TabsTrigger value="jobs">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Jobs & Appointments
                </TabsTrigger>
                <TabsTrigger value="requests">
                  <FileText className="w-4 h-4 mr-2" />
                  Service Requests
                </TabsTrigger>
                <TabsTrigger value="agreements">
                  <Shield className="w-4 h-4 mr-2" />
                  Agreements
                </TabsTrigger>
                <TabsTrigger value="profile">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </TabsTrigger>
              </TabsList>

              <TabsContent value="jobs" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Your Jobs & Appointments</CardTitle>
                    <CardDescription>View your scheduled and past service appointments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {jobs.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No appointments found</p>
                    ) : (
                      <div className="space-y-4">
                        {jobs.map((job) => (
                          <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-muted-foreground">{job.job_number}</span>
                                {getStatusBadge(job.status)}
                              </div>
                              <p className="font-medium mt-1">{job.description || job.category || "Service Call"}</p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                {job.scheduled_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {new Date(job.scheduled_date).toLocaleDateString()}
                                  </span>
                                )}
                                {job.assigned_technician_name && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-4 h-4" />
                                    {job.assigned_technician_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="requests" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Service Requests</CardTitle>
                    <CardDescription>Track your service requests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {serviceRequests.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No service requests</p>
                    ) : (
                      <div className="space-y-4">
                        {serviceRequests.map((request) => (
                          <div key={request.id} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-sm text-muted-foreground">{request.request_number}</span>
                              {getStatusBadge(request.status)}
                            </div>
                            <p className="font-medium mt-2">{request.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <Badge variant="outline">{request.service_type}</Badge>
                              <Badge variant="outline">{request.urgency}</Badge>
                              <span>{new Date(request.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="agreements" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Maintenance Agreements</CardTitle>
                    <CardDescription>Your active maintenance contracts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {agreements.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No maintenance agreements</p>
                    ) : (
                      <div className="space-y-4">
                        {agreements.map((agreement) => (
                          <div key={agreement.id} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-sm">{agreement.agreement_number}</span>
                              {getStatusBadge(agreement.status)}
                            </div>
                            <p className="font-medium mt-2">{agreement.template_name || `${agreement.frequency} Maintenance`}</p>
                            <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                              <div>
                                <p className="text-muted-foreground">Next Service</p>
                                <p>{agreement.next_service_date || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Expires</p>
                                <p>{agreement.end_date}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="profile" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Your Profile</CardTitle>
                    <CardDescription>Manage your account information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Name</Label>
                        <p className="font-medium">{customer?.name}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Email</Label>
                        <p className="font-medium">{customer?.email}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Phone</Label>
                        <p className="font-medium">{customer?.phone || "Not provided"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Status</Label>
                        <p className="font-medium capitalize">{customer?.status}</p>
                      </div>
                    </div>
                    
                    {customer?.addresses && customer.addresses.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Addresses</Label>
                        {customer.addresses.map((addr, i) => (
                          <p key={i} className="font-medium flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {addr.address}
                            {addr.is_primary && <Badge variant="outline" className="text-xs">Primary</Badge>}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      {/* New Request Modal */}
      {newRequestOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-xl font-bold mb-4">Request Service</h2>
            
            <div className="space-y-4">
              <div>
                <Label>Service Type *</Label>
                <Select
                  value={newRequest.service_type}
                  onValueChange={(v) => setNewRequest({ ...newRequest, service_type: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="installation">Installation</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Description *</Label>
                <Textarea
                  value={newRequest.description}
                  onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                  placeholder="Describe the issue or service needed..."
                  rows={3}
                />
              </div>
              
              <div>
                <Label>Urgency</Label>
                <Select
                  value={newRequest.urgency}
                  onValueChange={(v) => setNewRequest({ ...newRequest, urgency: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Flexible timing</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High - Soon as possible</SelectItem>
                    <SelectItem value="emergency">Emergency - ASAP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Service Address *</Label>
                <Input
                  value={newRequest.service_address}
                  onChange={(e) => setNewRequest({ ...newRequest, service_address: e.target.value })}
                  placeholder="123 Main St, City, ST"
                />
              </div>
              
              <div>
                <Label>Preferred Time of Day</Label>
                <Select
                  value={newRequest.preferred_time_of_day}
                  onValueChange={(v) => setNewRequest({ ...newRequest, preferred_time_of_day: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anytime">Anytime</SelectItem>
                    <SelectItem value="morning">Morning (8am-12pm)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (12pm-5pm)</SelectItem>
                    <SelectItem value="evening">Evening (5pm-8pm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Access Instructions</Label>
                <Textarea
                  value={newRequest.access_instructions}
                  onChange={(e) => setNewRequest({ ...newRequest, access_instructions: e.target.value })}
                  placeholder="Gate code, pet info, parking instructions..."
                  rows={2}
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setNewRequestOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSubmitRequest} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Submit Request
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CustomerPortal;
