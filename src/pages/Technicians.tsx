import { motion } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { MapPin, Star, Clock, Wrench } from "lucide-react";

const technicians = [
  { id: 1, name: "Mike Johnson", role: "Senior Technician", specialty: "Residential Install", status: "in_progress" as const, statusLabel: "On Job", jobs: 142, rating: 4.9, location: "Dallas, TX" },
  { id: 2, name: "Lisa Chen", role: "Lead Technician", specialty: "Commercial Systems", status: "open" as const, statusLabel: "Available", jobs: 118, rating: 4.8, location: "Plano, TX" },
  { id: 3, name: "Tom Brown", role: "Technician", specialty: "Emergency Repair", status: "urgent" as const, statusLabel: "Emergency", jobs: 96, rating: 4.7, location: "Richardson, TX" },
  { id: 4, name: "Amy Davis", role: "Technician", specialty: "Maintenance", status: "pending" as const, statusLabel: "En Route", jobs: 87, rating: 4.9, location: "Frisco, TX" },
  { id: 5, name: "Carlos Mendez", role: "Junior Technician", specialty: "Residential Repair", status: "open" as const, statusLabel: "Available", jobs: 34, rating: 4.6, location: "Allen, TX" },
  { id: 6, name: "Rachel Thompson", role: "Senior Technician", specialty: "Commercial Install", status: "in_progress" as const, statusLabel: "On Job", jobs: 156, rating: 4.8, location: "McKinney, TX" },
];

const Technicians = () => {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Technicians</h1>
          <p className="page-subtitle">Manage your field service team</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {technicians.map((tech, i) => (
          <motion.div
            key={tech.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="metric-card cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent font-bold text-sm">
                  {tech.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{tech.name}</p>
                  <p className="text-xs text-muted-foreground">{tech.role}</p>
                </div>
              </div>
              <StatusBadge status={tech.status} label={tech.statusLabel} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Wrench className="w-3 h-3" /> {tech.specialty}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Star className="w-3 h-3 text-accent" /> {tech.rating}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3 h-3" /> {tech.jobs} jobs
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="w-3 h-3" /> {tech.location}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Technicians;
