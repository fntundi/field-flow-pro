import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import Breadcrumbs from "./Breadcrumbs";
import { PWAInstallBanner } from "./PWAInstallBanner";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  // Check if this is a public page (no sidebar)
  const isPublicPage = location.pathname.startsWith("/appointment/");

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close sidebar when clicking outside on mobile
  const handleOverlayClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Render public pages without sidebar
  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border z-40 flex items-center px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-sidebar-accent-foreground hover:bg-sidebar-accent/10"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
        <h1 className="ml-3 text-sm font-bold text-sidebar-accent-foreground">
          BreezeFlow
        </h1>
      </header>

      {/* Overlay for mobile */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={handleOverlayClick}
        />
      )}

      {/* Sidebar */}
      <AppSidebar
        isOpen={sidebarOpen}
        isMobile={isMobile}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <main
        className={`transition-all duration-300 ${
          isMobile
            ? "pt-14 px-4 pb-6"
            : "ml-[240px] p-6"
        }`}
      >
        <Breadcrumbs />
        {children}
      </main>

      {/* PWA Install Banner */}
      <PWAInstallBanner />
    </div>
  );
};

export default AppLayout;
