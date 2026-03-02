import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Star, Wrench, Phone, Check, AlertCircle } from "lucide-react";
import { appointmentsApi, AppointmentConfirmation as AppointmentConfirmationType } from "@/lib/api";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  en_route: "bg-yellow-100 text-yellow-700",
  arrived: "bg-purple-100 text-purple-700",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

const AppointmentConfirmation = () => {
  const { token } = useParams<{ token: string }>();
  const [appointment, setAppointment] = useState<AppointmentConfirmationType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchAppointment(token);
    }
  }, [token]);

  const fetchAppointment = async (confirmToken: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await appointmentsApi.getConfirmation(confirmToken);
      setAppointment(data);
    } catch (err) {
      console.error("Error fetching appointment:", err);
      setError("Unable to find this appointment. The link may be invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent/5 to-background p-4">
        <div className="text-muted-foreground">Loading appointment details...</div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent/5 to-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-card rounded-2xl shadow-xl border border-border p-8 text-center"
        >
          <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Appointment Not Found</h1>
          <p className="text-muted-foreground">{error}</p>
        </motion.div>
      </div>
    );
  }

  const { technician } = appointment;
  const initials = technician.name.split(" ").map((n) => n[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/5 to-background p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-3">
            <Check className="w-6 h-6 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Appointment Confirmed</h1>
          <p className="text-muted-foreground">Your service appointment details</p>
        </div>

        {/* Main Card */}
        <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
          {/* Status Banner */}
          <div className={`px-6 py-3 ${statusColors[appointment.status]} text-center`}>
            <span className="font-medium capitalize">{appointment.status.replace("_", " ")}</span>
          </div>

          {/* Technician Section */}
          <div className="p-6 border-b border-border">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Your Technician
            </h2>
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20 border-4 border-accent/20">
                {technician.profile_image ? (
                  <AvatarImage src={technician.profile_image} alt={technician.name} />
                ) : null}
                <AvatarFallback className="text-xl bg-accent/10 text-accent">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">{technician.name}</h3>
                <p className="text-muted-foreground">{technician.role}</p>
                <div className="flex items-center gap-3 mt-2 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Wrench className="w-4 h-4" />
                    {technician.specialty}
                  </span>
                  <span className="flex items-center gap-1 text-yellow-600">
                    <Star className="w-4 h-4 fill-yellow-500" />
                    {technician.rating.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
            {technician.bio && (
              <p className="text-sm text-muted-foreground mt-4 p-3 bg-muted/50 rounded-lg">
                {technician.bio}
              </p>
            )}
            {technician.years_experience > 0 && (
              <Badge variant="secondary" className="mt-3">
                {technician.years_experience} years experience
              </Badge>
            )}
          </div>

          {/* Appointment Details */}
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Appointment Details
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date & Time</p>
                  <p className="font-semibold text-foreground">
                    {appointment.scheduled_date} at {appointment.scheduled_time}
                  </p>
                </div>
              </div>

              {appointment.estimated_duration && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated Duration</p>
                    <p className="font-semibold text-foreground">{appointment.estimated_duration}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Service Location</p>
                  <p className="font-semibold text-foreground">{appointment.site_address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Service Type</p>
                  <p className="font-semibold text-foreground">{appointment.job_type}</p>
                </div>
              </div>
            </div>

            {appointment.notes && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium text-foreground mb-1">Notes</p>
                <p className="text-sm text-muted-foreground">{appointment.notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-muted/30 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              Job Reference: <span className="font-mono font-medium">{appointment.job_number}</span>
            </p>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Questions about your appointment?
          </p>
          <a
            href="tel:+1-555-123-4567"
            className="inline-flex items-center gap-2 text-accent hover:underline"
          >
            <Phone className="w-4 h-4" />
            (555) 123-4567
          </a>
        </div>
      </motion.div>
    </div>
  );
};

export default AppointmentConfirmation;
