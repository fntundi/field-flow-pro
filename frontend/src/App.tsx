import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Index";
import Jobs from "@/pages/Jobs";
import JobDetail from "@/pages/JobDetail";
import Estimates from "@/pages/Estimates";
import Dispatch from "@/pages/Dispatch";
import Leads from "@/pages/Leads";
import Customers from "@/pages/Customers";
import Technicians from "@/pages/Technicians";
import TechnicianDetail from "@/pages/TechnicianDetail";
import AppointmentConfirmation from "@/pages/AppointmentConfirmation";
import CallIntake from "@/pages/CallIntake";
import Schedule from "@/pages/Schedule";
import MaintenanceSchedules from "@/pages/MaintenanceSchedules";
import ServiceAgreements from "@/pages/ServiceAgreements";
import Invoices from "@/pages/Invoices";
import Inventory from "@/pages/Inventory";
import Vendors from "@/pages/Vendors";
import Analytics from "@/pages/Analytics";
import PlaceholderPage from "@/pages/PlaceholderPage";
import NotFound from "./pages/NotFound";
import GanttChart from "@/pages/GanttChart";
import CustomerPortal from "@/pages/CustomerPortal";
import MaintenanceAgreements from "@/pages/MaintenanceAgreements";
import Proposals from "@/pages/Proposals";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Login Route - redirect if already logged in
function LoginRoute() {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Login onLogin={login} />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/customer" element={<CustomerPortal />} />
      <Route path="/appointment/:token" element={<AppointmentConfirmation />} />
      
      {/* Protected App Routes */}
      <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/call-intake" element={<ProtectedRoute><AppLayout><CallIntake /></AppLayout></ProtectedRoute>} />
      <Route path="/jobs" element={<ProtectedRoute><AppLayout><Jobs /></AppLayout></ProtectedRoute>} />
      <Route path="/jobs/:id" element={<ProtectedRoute><AppLayout><JobDetail /></AppLayout></ProtectedRoute>} />
      <Route path="/projects/:projectId" element={<ProtectedRoute><AppLayout><GanttChart /></AppLayout></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><AppLayout><PlaceholderPage title="Projects" subtitle="Multi-day install projects and phases" /></AppLayout></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute><AppLayout><Proposals /></AppLayout></ProtectedRoute>} />
      <Route path="/proposals" element={<ProtectedRoute><AppLayout><Proposals /></AppLayout></ProtectedRoute>} />
      <Route path="/estimates" element={<ProtectedRoute><AppLayout><Estimates /></AppLayout></ProtectedRoute>} />
      <Route path="/dispatch" element={<ProtectedRoute><AppLayout><Dispatch /></AppLayout></ProtectedRoute>} />
      <Route path="/leads" element={<ProtectedRoute><AppLayout><Leads /></AppLayout></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><AppLayout><Customers /></AppLayout></ProtectedRoute>} />
      <Route path="/sites" element={<ProtectedRoute><AppLayout><PlaceholderPage title="Sites" subtitle="Multi-site locations and access instructions" /></AppLayout></ProtectedRoute>} />
      <Route path="/technicians" element={<ProtectedRoute><AppLayout><Technicians /></AppLayout></ProtectedRoute>} />
      <Route path="/technicians/:id" element={<ProtectedRoute><AppLayout><TechnicianDetail /></AppLayout></ProtectedRoute>} />
      <Route path="/schedule" element={<ProtectedRoute><AppLayout><Schedule /></AppLayout></ProtectedRoute>} />
      <Route path="/maintenance" element={<ProtectedRoute><AppLayout><MaintenanceSchedules /></AppLayout></ProtectedRoute>} />
      <Route path="/maintenance-agreements" element={<ProtectedRoute><AppLayout><MaintenanceAgreements /></AppLayout></ProtectedRoute>} />
      <Route path="/checklists" element={<ProtectedRoute><AppLayout><PlaceholderPage title="Checklists" subtitle="Installation evidence and quality verification" /></AppLayout></ProtectedRoute>} />
      <Route path="/agreements" element={<ProtectedRoute><AppLayout><ServiceAgreements /></AppLayout></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><AppLayout><Invoices /></AppLayout></ProtectedRoute>} />
      <Route path="/vendors" element={<ProtectedRoute><AppLayout><Vendors /></AppLayout></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><AppLayout><Inventory /></AppLayout></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AppLayout><Analytics /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<ProtectedRoute><AppLayout><NotFound /></AppLayout></ProtectedRoute>} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
