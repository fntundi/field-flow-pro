import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  MapPin,
  Users,
  FileText,
  BarChart3,
  Package,
  CalendarDays,
  ClipboardCheck,
  Phone,
  Settings,
  ChevronLeft,
  Flame,
  UserCircle,
  Calculator,
  Shield,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/jobs", icon: Briefcase, label: "Jobs" },
  { to: "/estimates", icon: Calculator, label: "Estimates" },
  { to: "/dispatch", icon: MapPin, label: "Dispatch" },
  { to: "/leads", icon: Phone, label: "Leads & PCBs" },
  { to: "/customers", icon: UserCircle, label: "Customers" },
  { to: "/technicians", icon: Users, label: "Technicians" },
  { to: "/schedule", icon: CalendarDays, label: "Schedule" },
  { to: "/checklists", icon: ClipboardCheck, label: "Checklists" },
  { to: "/agreements", icon: Shield, label: "Agreements" },
  { to: "/invoices", icon: FileText, label: "Invoices" },
  { to: "/inventory", icon: Package, label: "Inventory" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-sidebar flex flex-col border-r border-sidebar-border z-50 transition-all duration-300 ${
        collapsed ? "w-[68px]" : "w-[240px]"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <Flame className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">
              HVAC Ops
            </h1>
            <p className="text-[10px] text-sidebar-muted">Business Platform</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`sidebar-link ${isActive ? "active" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-sidebar-border text-sidebar-muted hover:text-sidebar-accent-foreground transition-colors"
      >
        <ChevronLeft
          className={`w-4 h-4 transition-transform duration-300 ${
            collapsed ? "rotate-180" : ""
          }`}
        />
      </button>
    </aside>
  );
};

export default AppSidebar;
