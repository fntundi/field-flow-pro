import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Analytics from "@/pages/Analytics";
import PlaceholderPage from "@/pages/PlaceholderPage";
import NotFound from "./pages/NotFound";
import GanttChart from "@/pages/GanttChart";
import CustomerPortal from "@/pages/CustomerPortal";
import MaintenanceAgreements from "@/pages/MaintenanceAgreements";
import Proposals from "@/pages/Proposals";
import Settings from "@/pages/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Customer Portal - No AppLayout */}
          <Route path="/customer" element={<CustomerPortal />} />
          <Route path="/appointment/:token" element={<AppointmentConfirmation />} />
          
          {/* Main App Routes - With AppLayout */}
          <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/call-intake" element={<AppLayout><CallIntake /></AppLayout>} />
          <Route path="/jobs" element={<AppLayout><Jobs /></AppLayout>} />
          <Route path="/jobs/:id" element={<AppLayout><JobDetail /></AppLayout>} />
          <Route path="/projects/:projectId" element={<AppLayout><GanttChart /></AppLayout>} />
          <Route path="/projects" element={<AppLayout><PlaceholderPage title="Projects" subtitle="Multi-day install projects and phases" /></AppLayout>} />
          <Route path="/sales" element={<AppLayout><Proposals /></AppLayout>} />
          <Route path="/proposals" element={<AppLayout><Proposals /></AppLayout>} />
          <Route path="/estimates" element={<AppLayout><Estimates /></AppLayout>} />
          <Route path="/dispatch" element={<AppLayout><Dispatch /></AppLayout>} />
          <Route path="/leads" element={<AppLayout><Leads /></AppLayout>} />
          <Route path="/customers" element={<AppLayout><Customers /></AppLayout>} />
          <Route path="/sites" element={<AppLayout><PlaceholderPage title="Sites" subtitle="Multi-site locations and access instructions" /></AppLayout>} />
          <Route path="/technicians" element={<AppLayout><Technicians /></AppLayout>} />
          <Route path="/technicians/:id" element={<AppLayout><TechnicianDetail /></AppLayout>} />
          <Route path="/schedule" element={<AppLayout><Schedule /></AppLayout>} />
          <Route path="/maintenance" element={<AppLayout><MaintenanceSchedules /></AppLayout>} />
          <Route path="/maintenance-agreements" element={<AppLayout><MaintenanceAgreements /></AppLayout>} />
          <Route path="/checklists" element={<AppLayout><PlaceholderPage title="Checklists" subtitle="Installation evidence and quality verification" /></AppLayout>} />
          <Route path="/agreements" element={<AppLayout><ServiceAgreements /></AppLayout>} />
          <Route path="/invoices" element={<AppLayout><Invoices /></AppLayout>} />
          <Route path="/inventory" element={<AppLayout><Inventory /></AppLayout>} />
          <Route path="/analytics" element={<AppLayout><Analytics /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
          <Route path="*" element={<AppLayout><NotFound /></AppLayout>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
