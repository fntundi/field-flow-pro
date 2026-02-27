import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-[240px] p-6 transition-all duration-300">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
