import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Star,
  Calendar,
  Clock,
  Wrench,
  Award,
  FileText,
  Camera,
  User,
  Shield,
  Briefcase,
} from "lucide-react";
import { techniciansApi, Technician } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import ProfileImageUpload from "@/components/ProfileImageUpload";

const statusMap: Record<string, { status: "open" | "in_progress" | "urgent" | "pending" | "complete"; label: string }> = {
  available: { status: "open", label: "Available" },
  on_job: { status: "in_progress", label: "On Job" },
  en_route: { status: "pending", label: "En Route" },
  off_duty: { status: "complete", label: "Off Duty" },
  emergency: { status: "urgent", label: "Emergency" },
};

const TechnicianDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [technician, setTechnician] = useState<Technician | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");
  const [showImageUpload, setShowImageUpload] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTechnician(id);
    }
  }, [id]);

  const fetchTechnician = async (techId: string) => {
    try {
      setLoading(true);
      const data = await techniciansApi.getById(techId);
      setTechnician(data);
    } catch (error) {
      console.error("Error fetching technician:", error);
      toast({
        title: "Error",
        description: "Failed to load technician details",
        variant: "destructive",
      });
      navigate("/technicians");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUploaded = (newImageData: string) => {
    if (technician) {
      setTechnician({ ...technician, profile_image: newImageData });
    }
    setShowImageUpload(false);
    toast({
      title: "Success",
      description: "Profile image updated successfully",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading technician details...</div>
      </div>
    );
  }

  if (!technician) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Technician not found</div>
      </div>
    );
  }

  const initials = technician.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const statusInfo = statusMap[technician.status] || { status: "open" as const, label: technician.status_label };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/technicians")} className="self-start">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        
        <div className="flex flex-col sm:flex-row items-start gap-4 flex-1">
          {/* Profile Image */}
          <div className="relative group">
            <Avatar className="w-20 h-20 md:w-24 md:h-24 border-4 border-accent/20">
              {technician.profile_image ? (
                <AvatarImage src={technician.profile_image} alt={technician.name} />
              ) : null}
              <AvatarFallback className="text-xl md:text-2xl bg-accent/10 text-accent">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => setShowImageUpload(true)}
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Camera className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Basic Info */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl md:text-2xl font-bold text-foreground">{technician.name}</h1>
              <StatusBadge status={statusInfo.status} label={statusInfo.label} />
            </div>
            <p className="text-muted-foreground">{technician.role}</p>
            <p className="text-sm text-muted-foreground">{technician.employee_number}</p>
            
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {technician.location}
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500" />
                {technician.rating.toFixed(1)}
              </span>
              <span className="flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                {technician.total_jobs} jobs
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 self-start">
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${technician.phone}`}>
                <Phone className="w-4 h-4 mr-2" />
                Call
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${technician.email}`}>
                <Mail className="w-4 h-4 mr-2" />
                Email
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="metric-card"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Wrench className="w-4 h-4" />
            Specialty
          </div>
          <p className="font-semibold text-foreground">{technician.specialty}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="metric-card"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Calendar className="w-4 h-4" />
            Experience
          </div>
          <p className="font-semibold text-foreground">{technician.years_experience} years</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="metric-card"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Star className="w-4 h-4" />
            Rating
          </div>
          <p className="font-semibold text-foreground">{technician.rating.toFixed(1)} / 5.0</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="metric-card"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Clock className="w-4 h-4" />
            Jobs Completed
          </div>
          <p className="font-semibold text-foreground">{technician.total_jobs}</p>
        </motion.div>
      </div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="metric-card"
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto p-1 overflow-x-auto">
            <TabsTrigger value="profile" className="text-xs sm:text-sm">Profile</TabsTrigger>
            <TabsTrigger value="skills" className="text-xs sm:text-sm">Skills & Certs</TabsTrigger>
            <TabsTrigger value="contact" className="text-xs sm:text-sm">Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-4">
            {/* Bio */}
            {technician.bio && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  About
                </h3>
                <p className="text-sm text-muted-foreground">{technician.bio}</p>
              </div>
            )}

            {/* Availability Notes */}
            {technician.availability_notes && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Availability Notes
                </h3>
                <p className="text-sm text-muted-foreground">{technician.availability_notes}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="skills" className="mt-4 space-y-6">
            {/* Skills */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {technician.skills.length > 0 ? (
                  technician.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary">
                      {skill}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No skills listed</p>
                )}
              </div>
            </div>

            {/* Certifications */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Award className="w-4 h-4" />
                Certifications
              </h3>
              {technician.certifications.length > 0 ? (
                <div className="space-y-2">
                  {technician.certifications.map((cert, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium text-foreground">{cert.name}</p>
                      <p className="text-xs text-muted-foreground">{cert.issuer}</p>
                      {cert.expiry_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Expires: {cert.expiry_date}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No certifications listed</p>
              )}
            </div>

            {/* Licenses */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Licenses
              </h3>
              {technician.licenses.length > 0 ? (
                <div className="space-y-2">
                  {technician.licenses.map((license, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium text-foreground">{license.name}</p>
                      <p className="text-xs text-muted-foreground">
                        #{license.license_number} - {license.state}
                      </p>
                      {license.expiry_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Expires: {license.expiry_date}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No licenses listed</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="contact" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-semibold text-foreground mb-3">Contact Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a href={`tel:${technician.phone}`} className="text-sm hover:text-accent">
                      {technician.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${technician.email}`} className="text-sm hover:text-accent truncate">
                      {technician.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{technician.location}</span>
                  </div>
                </div>
              </div>

              {(technician.emergency_contact_name || technician.emergency_contact_phone) && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Emergency Contact</h3>
                  <div className="space-y-2">
                    {technician.emergency_contact_name && (
                      <p className="text-sm text-foreground">{technician.emergency_contact_name}</p>
                    )}
                    {technician.emergency_contact_phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <a href={`tel:${technician.emergency_contact_phone}`} className="text-sm hover:text-accent">
                          {technician.emergency_contact_phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Image Upload Modal */}
      {showImageUpload && (
        <ProfileImageUpload
          technicianId={technician.id}
          currentImage={technician.profile_image}
          onClose={() => setShowImageUpload(false)}
          onUploaded={handleImageUploaded}
        />
      )}
    </div>
  );
};

export default TechnicianDetail;
