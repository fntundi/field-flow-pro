import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase, Job, Customer, Site, Equipment, JobCall, JobVisit } from "@/lib/supabase";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Phone,
  MapPin,
  Calendar,
  Clock,
  User,
  Wrench,
  FileText,
  History,
  Package,
} from "lucide-react";
import { format } from "date-fns";

type JobWithRelations = Job & {
  customer?: Customer;
  site?: Site;
  equipment?: Equipment[];
  calls?: JobCall[];
  visits?: JobVisit[];
};

const JobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (id) {
      fetchJobDetails(id);
    }
  }, [id]);

  const fetchJobDetails = async (jobId: string) => {
    try {
      setLoading(true);

      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();

      if (jobError) throw jobError;
      if (!jobData) {
        navigate("/jobs");
        return;
      }

      const { data: customerData } = await supabase
        .from("customers")
        .select("*")
        .eq("id", jobData.customer_id)
        .maybeSingle();

      const { data: siteData } = await supabase
        .from("sites")
        .select("*")
        .eq("id", jobData.site_id)
        .maybeSingle();

      const { data: equipmentData } = await supabase
        .from("equipment")
        .select("*")
        .eq("site_id", jobData.site_id);

      const { data: callsData } = await supabase
        .from("job_calls")
        .select("*")
        .eq("job_id", jobId)
        .order("call_date", { ascending: false });

      const { data: visitsData } = await supabase
        .from("job_visits")
        .select("*")
        .eq("job_id", jobId)
        .order("visit_date", { ascending: false });

      setJob({
        ...jobData,
        customer: customerData || undefined,
        site: siteData || undefined,
        equipment: equipmentData || [],
        calls: callsData || [],
        visits: visitsData || [],
      });
    } catch (error) {
      console.error("Error fetching job details:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading job details...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Job not found</div>
      </div>
    );
  }

  const timeline = [
    ...(job.calls || []).map((call) => ({
      type: "call" as const,
      date: call.call_date,
      data: call,
    })),
    ...(job.visits || []).map((visit) => ({
      type: "visit" as const,
      date: visit.visit_date,
      data: visit,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/jobs")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{job.job_number}</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="page-subtitle">{job.title}</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          Edit Job
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="metric-card"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <User className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Customer</h3>
          </div>
          {job.customer && (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">{job.customer.name}</p>
              <p className="text-muted-foreground">{job.customer.type}</p>
              {job.customer.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  {job.customer.phone}
                </div>
              )}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="metric-card"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Schedule</h3>
          </div>
          <div className="space-y-2 text-sm">
            {job.scheduled_date && (
              <div>
                <p className="text-muted-foreground text-xs">Scheduled</p>
                <p className="font-medium text-foreground">
                  {format(new Date(job.scheduled_date), "MMM d, yyyy h:mm a")}
                </p>
              </div>
            )}
            {job.completed_date && (
              <div>
                <p className="text-muted-foreground text-xs">Completed</p>
                <p className="font-medium text-foreground">
                  {format(new Date(job.completed_date), "MMM d, yyyy")}
                </p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="metric-card"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Job Info</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Type</p>
              <p className="font-medium text-foreground">{job.job_type}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Priority</p>
              <p className="font-medium text-foreground capitalize">{job.priority}</p>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="metric-card"
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">
              Timeline ({timeline.length})
            </TabsTrigger>
            <TabsTrigger value="site">Site Details</TabsTrigger>
            <TabsTrigger value="equipment">
              Equipment ({job.equipment?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Description
              </h3>
              <p className="text-sm text-muted-foreground">
                {job.description || "No description provided"}
              </p>
            </div>

            {job.site && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Site Address
                </h3>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5" />
                  <div>
                    <p>{job.site.address}</p>
                    {job.site.city && job.site.state && (
                      <p>
                        {job.site.city}, {job.site.state} {job.site.zip}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Estimated Hours</p>
                <p className="text-sm font-medium text-foreground">
                  {job.estimated_hours || "—"} hrs
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Actual Hours</p>
                <p className="text-sm font-medium text-foreground">
                  {job.actual_hours || "—"} hrs
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-3 mt-4">
            {timeline.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No calls or visits recorded yet
              </div>
            ) : (
              timeline.map((item, index) => (
                <div
                  key={index}
                  className="flex gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        item.type === "call"
                          ? "bg-info/10 text-info"
                          : "bg-success/10 text-success"
                      }`}
                    >
                      {item.type === "call" ? (
                        <Phone className="w-4 h-4" />
                      ) : (
                        <Wrench className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        {item.type === "call" ? "Phone Call" : "Site Visit"}
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.date), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    {item.type === "call" && "issue_description" in item.data && (
                      <div className="space-y-1">
                        {item.data.caller_name && (
                          <p className="text-xs text-muted-foreground">
                            Caller: {item.data.caller_name}
                          </p>
                        )}
                        <p className="text-sm text-foreground">
                          {item.data.issue_description}
                        </p>
                        {item.data.notes && (
                          <p className="text-xs text-muted-foreground">
                            {item.data.notes}
                          </p>
                        )}
                      </div>
                    )}
                    {item.type === "visit" && "work_performed" in item.data && (
                      <div className="space-y-1">
                        {item.data.arrival_time && item.data.departure_time && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {format(new Date(item.data.arrival_time), "h:mm a")} -{" "}
                            {format(new Date(item.data.departure_time), "h:mm a")}
                          </div>
                        )}
                        {item.data.work_performed && (
                          <p className="text-sm text-foreground">
                            {item.data.work_performed}
                          </p>
                        )}
                        {item.data.findings && (
                          <p className="text-xs text-muted-foreground">
                            Findings: {item.data.findings}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="site" className="space-y-4 mt-4">
            {job.site ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Location
                  </h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {job.site.site_name && (
                      <p className="font-medium text-foreground">
                        {job.site.site_name}
                      </p>
                    )}
                    <p>{job.site.address}</p>
                    {job.site.city && job.site.state && (
                      <p>
                        {job.site.city}, {job.site.state} {job.site.zip}
                      </p>
                    )}
                  </div>
                </div>

                {job.site.access_instructions && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      Access Instructions
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {job.site.access_instructions}
                    </p>
                  </div>
                )}

                {job.site.gate_code && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      Gate Code
                    </h3>
                    <p className="text-sm font-mono text-foreground">
                      {job.site.gate_code}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No site information available
              </div>
            )}
          </TabsContent>

          <TabsContent value="equipment" className="space-y-3 mt-4">
            {job.equipment && job.equipment.length > 0 ? (
              job.equipment.map((equip) => (
                <div
                  key={equip.id}
                  className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      {equip.equipment_type}
                    </h4>
                    <Package className="w-4 h-4 text-accent" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {equip.manufacturer && (
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Manufacturer
                        </p>
                        <p className="text-foreground">{equip.manufacturer}</p>
                      </div>
                    )}
                    {equip.model_number && (
                      <div>
                        <p className="text-xs text-muted-foreground">Model</p>
                        <p className="text-foreground font-mono text-xs">
                          {equip.model_number}
                        </p>
                      </div>
                    )}
                    {equip.serial_number && (
                      <div>
                        <p className="text-xs text-muted-foreground">Serial</p>
                        <p className="text-foreground font-mono text-xs">
                          {equip.serial_number}
                        </p>
                      </div>
                    )}
                    {equip.capacity && (
                      <div>
                        <p className="text-xs text-muted-foreground">Capacity</p>
                        <p className="text-foreground">{equip.capacity}</p>
                      </div>
                    )}
                    {equip.installation_date && (
                      <div>
                        <p className="text-xs text-muted-foreground">Installed</p>
                        <p className="text-foreground">
                          {format(new Date(equip.installation_date), "MMM yyyy")}
                        </p>
                      </div>
                    )}
                    {equip.warranty_expiration && (
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Warranty Exp
                        </p>
                        <p className="text-foreground">
                          {format(
                            new Date(equip.warranty_expiration),
                            "MMM yyyy"
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No equipment information available
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default JobDetail;
