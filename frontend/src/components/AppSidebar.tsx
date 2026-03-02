import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  Wind,
  UserCircle,
  Calculator,
  Shield,
  DollarSign,
  Wrench,
  X,
  PhoneIncoming,
  Building2,
  FolderKanban,
  LogOut,
  Upload,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/call-intake", icon: PhoneIncoming, label: "Call Intake" },
  { to: "/jobs", icon: Briefcase, label: "Jobs" },
  { to: "/projects", icon: FolderKanban, label: "Projects" },
  { to: "/sales", icon: DollarSign, label: "Sales" },
  { to: "/estimates", icon: Calculator, label: "Estimates" },
  { to: "/dispatch", icon: MapPin, label: "Dispatch" },
  { to: "/leads", icon: Phone, label: "Leads & PCBs" },
  { to: "/customers", icon: UserCircle, label: "Customers" },
  { to: "/sites", icon: Building2, label: "Sites" },
  { to: "/technicians", icon: Users, label: "Technicians" },
  { to: "/schedule", icon: CalendarDays, label: "Schedule" },
  { to: "/maintenance", icon: Wrench, label: "Maintenance" },
  { to: "/agreements", icon: Shield, label: "Agreements" },
  { to: "/checklists", icon: ClipboardCheck, label: "Checklists" },
  { to: "/invoices", icon: FileText, label: "Invoices" },
  { to: "/inventory", icon: Package, label: "Inventory" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/reports", icon: FileText, label: "Reports" },
  { to: "/import", icon: Upload, label: "Import Data" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface AppSidebarProps {
  isOpen?: boolean;
  isMobile?: boolean;
  onClose?: () => void;
}

const AppSidebar = ({ isOpen = true, isMobile = false, onClose }: AppSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Close mobile sidebar on navigation
  useEffect(() => {
    if (isMobile && onClose) {
      onClose();
    }
  }, [location.pathname]);

  // Don't render on mobile when closed
  if (isMobile && !isOpen) {
    return null;
  }

  return (
    <aside
      className={`fixed left-0 h-screen bg-sidebar flex flex-col border-r border-sidebar-border z-50 transition-all duration-300 ${
        isMobile
          ? "top-0 w-[280px]"
          : `top-0 ${collapsed ? "w-[68px]" : "w-[240px]"}`
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <Wind className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          {(!collapsed || isMobile) && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">
                BreezeFlow
              </h1>
              <p className="text-[10px] text-sidebar-muted">HVAC Operations</p>
            </div>
          )}
        </div>
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="p-2 text-sidebar-muted hover:text-sidebar-accent-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || 
            (item.to !== "/" && location.pathname.startsWith(item.to));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={isMobile ? onClose : undefined}
              className={`sidebar-link ${isActive ? "active" : ""}`}
              title={collapsed && !isMobile ? item.label : undefined}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {(!collapsed || isMobile) && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile Section */}
      {user && (
        <div className={`px-3 py-3 border-t border-sidebar-border ${collapsed && !isMobile ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center ${collapsed && !isMobile ? '' : 'gap-3'}`}>
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={user.avatar_url} alt={user.name} />
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {(!collapsed || isMobile) && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-sidebar-muted truncate capitalize">{user.role}</p>
              </div>
            )}
            {(!collapsed || isMobile) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-7 w-7 text-sidebar-muted hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
                title="Logout"
                data-testid="logout-btn"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
          {collapsed && !isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-7 w-7 mt-2 text-sidebar-muted hover:text-red-400 hover:bg-red-500/10"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Collapse toggle - only on desktop */}
      {!isMobile && (
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
      )}
    </aside>
  );
};

export default AppSidebar;
