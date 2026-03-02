import { motion } from "framer-motion";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
}

const PlaceholderPage = ({ title, subtitle }: PlaceholderPageProps) => {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="metric-card flex flex-col items-center justify-center min-h-[400px]"
      >
        <Construction className="w-12 h-12 text-accent mb-4" />
        <p className="text-lg font-semibold text-foreground">Coming Soon</p>
        <p className="text-sm text-muted-foreground mt-1">This module is under development</p>
      </motion.div>
    </div>
  );
};

export default PlaceholderPage;
