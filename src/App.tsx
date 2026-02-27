import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Jobs from "@/pages/Jobs";
import Dispatch from "@/pages/Dispatch";
import Leads from "@/pages/Leads";
import Technicians from "@/pages/Technicians";
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
            <Route path="/dispatch" element={<Dispatch />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/technicians" element={<Technicians />} />
            <Route path="/schedule" element={<PlaceholderPage title="Schedule" subtitle="Shift scheduling and calendar integration" />} />
            <Route path="/checklists" element={<PlaceholderPage title="Checklists" subtitle="Installation evidence and quality verification" />} />
            <Route path="/invoices" element={<PlaceholderPage title="Invoices" subtitle="Billing, payments, and financial tracking" />} />
            <Route path="/inventory" element={<PlaceholderPage title="Inventory" subtitle="Asset tracking, vendors, and warranty data" />} />
            <Route path="/analytics" element={<PlaceholderPage title="Analytics" subtitle="Business performance and reporting dashboards" />} />
            <Route path="/settings" element={<PlaceholderPage title="Settings" subtitle="Roles, permissions, and system configuration" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
