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
          <Route element={<AppLayout><Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/call-intake" element={<CallIntake />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/projects/:projectId" element={<GanttChart />} />
            <Route path="/projects" element={<PlaceholderPage title="Projects" subtitle="Multi-day install projects and phases" />} />
            <Route path="/sales" element={<PlaceholderPage title="Sales" subtitle="Quotes, proposals, and close tracking" />} />
            <Route path="/estimates" element={<Estimates />} />
            <Route path="/dispatch" element={<Dispatch />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/sites" element={<PlaceholderPage title="Sites" subtitle="Multi-site locations and access instructions" />} />
            <Route path="/technicians" element={<Technicians />} />
            <Route path="/technicians/:id" element={<TechnicianDetail />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/maintenance" element={<MaintenanceSchedules />} />
            <Route path="/maintenance-agreements" element={<MaintenanceAgreements />} />
            <Route path="/checklists" element={<PlaceholderPage title="Checklists" subtitle="Installation evidence and quality verification" />} />
            <Route path="/agreements" element={<ServiceAgreements />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<PlaceholderPage title="Settings" subtitle="Roles, permissions, and system configuration" />} />
            <Route path="*" element={<NotFound />} />
          </Routes></AppLayout>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
