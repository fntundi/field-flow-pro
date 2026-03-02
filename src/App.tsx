import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Jobs from "@/pages/Jobs";
import JobDetail from "@/pages/JobDetail";
import Estimates from "@/pages/Estimates";
import Dispatch from "@/pages/Dispatch";
import Leads from "@/pages/Leads";
import Customers from "@/pages/Customers";
import Technicians from "@/pages/Technicians";
import Schedule from "@/pages/Schedule";
import MaintenanceSchedules from "@/pages/MaintenanceSchedules";
import ServiceAgreements from "@/pages/ServiceAgreements";
import Invoices from "@/pages/Invoices";
import Inventory from "@/pages/Inventory";
import Analytics from "@/pages/Analytics";
import PlaceholderPage from "@/pages/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/estimates" element={<Estimates />} />
            <Route path="/dispatch" element={<Dispatch />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/technicians" element={<Technicians />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/maintenance" element={<MaintenanceSchedules />} />
            <Route path="/checklists" element={<PlaceholderPage title="Checklists" subtitle="Installation evidence and quality verification" />} />
            <Route path="/agreements" element={<ServiceAgreements />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<PlaceholderPage title="Settings" subtitle="Roles, permissions, and system configuration" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
