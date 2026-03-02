import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  index?: number;
  href?: string;
}

const MetricCard = ({ title, value, change, changeType = "neutral", icon: Icon, index = 0, href }: MetricCardProps) => {
  const content = (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-foreground mt-1.5">{value}</p>
        {change && (
          <p
            className={`text-xs font-medium mt-1 ${
              changeType === "positive"
                ? "text-success"
                : changeType === "negative"
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {change}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        {href && (
          <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className={`metric-card ${href ? "group cursor-pointer hover:border-accent/30 transition-colors" : ""}`}
    >
      {href ? (
        <Link to={href} className="block">
          {content}
        </Link>
      ) : (
        content
      )}
    </motion.div>
  );
};

export default MetricCard;
