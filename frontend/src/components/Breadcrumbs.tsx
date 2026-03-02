import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

// Route label mappings
const routeLabels: Record<string, string> = {
  "": "Dashboard",
  "jobs": "Jobs",
  "projects": "Projects",
  "sales": "Sales",
  "estimates": "Estimates",
  "dispatch": "Dispatch",
  "leads": "Leads & PCBs",
  "customers": "Customers",
  "sites": "Sites",
  "technicians": "Technicians",
  "schedule": "Schedule",
  "maintenance": "Maintenance",
  "checklists": "Checklists",
  "agreements": "Agreements",
  "invoices": "Invoices",
  "inventory": "Inventory",
  "analytics": "Analytics",
  "settings": "Settings",
  "appointment": "Appointment",
  "call-intake": "Call Intake",
};

// Dynamic labels for ID-based routes
const getDynamicLabel = (segment: string, prevSegment: string): string | null => {
  // Check if this looks like a JOB-XXX or TASK-XXX pattern
  if (segment.match(/^(JOB|TASK|TECH)-\d+$/i)) {
    return segment.toUpperCase();
  }
  // Check if this looks like a UUID - truncate it
  if (segment.match(/^[0-9a-f]{8}-[0-9a-f]{4}/i)) {
    // Show truncated UUID for technicians and other entities
    return `${segment.substring(0, 8)}...`;
  }
  return null;
};

interface BreadcrumbItem {
  label: string;
  path: string;
  isLast: boolean;
}

const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);

  // Don't show breadcrumbs on dashboard
  if (pathSegments.length === 0) {
    return null;
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Home", path: "/", isLast: false },
  ];

  let currentPath = "";
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === pathSegments.length - 1;
    
    // Get label
    let label = routeLabels[segment];
    if (!label) {
      const dynamicLabel = getDynamicLabel(segment, pathSegments[index - 1] || "");
      label = dynamicLabel || segment;
    }

    breadcrumbs.push({
      label,
      path: currentPath,
      isLast,
    });
  });

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4 overflow-x-auto">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.path}>
          {index > 0 && (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          )}
          {crumb.isLast ? (
            <span className="font-medium text-foreground truncate max-w-[200px]">
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="hover:text-foreground transition-colors flex items-center gap-1 flex-shrink-0"
            >
              {index === 0 && <Home className="w-4 h-4" />}
              <span className="hidden sm:inline">{crumb.label}</span>
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
