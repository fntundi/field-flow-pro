import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Star, Clock, Wrench, Search, Plus, RefreshCw, Phone, Mail } from "lucide-react";
import { techniciansApi, Technician, seedApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const statusMap: Record<string, { status: "open" | "in_progress" | "urgent" | "pending" | "complete"; label: string }> = {
  available: { status: "open", label: "Available" },
  on_job: { status: "in_progress", label: "On Job" },
  en_route: { status: "pending", label: "En Route" },
  off_duty: { status: "complete", label: "Off Duty" },
  emergency: { status: "urgent", label: "Emergency" },
};

const Technicians = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const fetchTechnicians = async () => {
    try {
      setLoading(true);
      const data = await techniciansApi.getAll();
      setTechnicians(data);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      toast({
        title: "Error",
        description: "Failed to fetch technicians",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    try {
      const result = await seedApi.seed();
      toast({
        title: "Data Seeded",
        description: `Created ${result.technicians} technicians.`,
      });
      fetchTechnicians();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to seed data.",
        variant: "destructive",
      });
    }
  };

  const filteredTechnicians = technicians.filter((tech) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      tech.name.toLowerCase().includes(searchLower) ||
      tech.specialty.toLowerCase().includes(searchLower) ||
      tech.location.toLowerCase().includes(searchLower) ||
      tech.employee_number.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Technicians</h1>
          <p className="text-sm text-muted-foreground">Manage your field service team</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedData}
            className="hidden md:flex"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Seed Data
          </Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Add Technician</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search technicians..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Technicians Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading technicians...</div>
        </div>
      ) : filteredTechnicians.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-muted-foreground mb-4">No technicians found</p>
          <Button variant="outline" onClick={handleSeedData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Load Sample Data
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTechnicians.map((tech, i) => {
            const statusInfo = statusMap[tech.status] || { status: "open" as const, label: tech.status_label };
            const initials = tech.name.split(" ").map((n) => n[0]).join("").toUpperCase();

            return (
              <motion.div
                key={tech.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="metric-card cursor-pointer hover:shadow-lg transition-all"
                onClick={() => navigate(`/technicians/${tech.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 border-2 border-accent/20">
                      {tech.profile_image ? (
                        <AvatarImage src={tech.profile_image} alt={tech.name} />
                      ) : null}
                      <AvatarFallback className="bg-accent/10 text-accent font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-foreground">{tech.name}</p>
                      <p className="text-xs text-muted-foreground">{tech.role}</p>
                    </div>
                  </div>
                  <StatusBadge status={statusInfo.status} label={statusInfo.label} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Wrench className="w-3 h-3" />
                    <span className="truncate">{tech.specialty}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Star className="w-3 h-3 text-yellow-500" />
                    {tech.rating.toFixed(1)}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {tech.total_jobs} jobs
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{tech.location}</span>
                  </div>
                </div>

                {/* Quick Actions - Prevent navigation */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `tel:${tech.phone}`;
                    }}
                  >
                    <Phone className="w-3 h-3 mr-1" />
                    Call
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `mailto:${tech.email}`;
                    }}
                  >
                    <Mail className="w-3 h-3 mr-1" />
                    Email
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Technicians;
