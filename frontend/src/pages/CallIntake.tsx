import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  User,
  MapPin,
  Clock,
  Calendar,
  Search,
  Plus,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Schedule occupancy indicator (Section 2.4)
type OccupancyLevel = "green" | "yellow" | "red";

interface CallLog {
  id: string;
  callerId: string;
  customerName: string;
  phone: string;
  callType: "inbound" | "outbound" | "missed";
  reason: string;
  outcome: "booked" | "quote" | "follow_up" | "no_answer" | "cancelled";
  notes: string;
  timestamp: Date;
  priority: "normal" | "high" | "emergency";
  assignedTo?: string;
}

// Mock schedule occupancy data
const scheduleOccupancy: Record<string, OccupancyLevel> = {
  "Today": "red",
  "Tomorrow": "yellow", 
  "Day 3": "green",
  "Day 4": "green",
  "Day 5": "yellow",
};

const CallIntake = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [callLogs, setCallLogs] = useState<CallLog[]>([
    {
      id: "1",
      callerId: "555-123-4567",
      customerName: "Sarah Mitchell",
      phone: "(555) 123-4567",
      callType: "inbound",
      reason: "A/C not cooling",
      outcome: "booked",
      notes: "Customer says unit making clicking noise",
      timestamp: new Date(Date.now() - 3600000),
      priority: "high",
    },
    {
      id: "2",
      callerId: "555-234-5678",
      customerName: "Unknown Caller",
      phone: "(555) 234-5678",
      callType: "missed",
      reason: "",
      outcome: "follow_up",
      notes: "Missed call - needs callback",
      timestamp: new Date(Date.now() - 7200000),
      priority: "normal",
    },
    {
      id: "3",
      callerId: "555-345-6789",
      customerName: "James Rivera",
      phone: "(555) 345-6789",
      callType: "inbound",
      reason: "Emergency - No heat",
      outcome: "booked",
      notes: "Gas furnace not igniting. Has elderly at home.",
      timestamp: new Date(Date.now() - 1800000),
      priority: "emergency",
    },
  ]);

  // New call form state
  const [newCall, setNewCall] = useState({
    phone: "",
    customerName: "",
    reason: "",
    priority: "normal",
    notes: "",
  });

  const [searchCustomer, setSearchCustomer] = useState("");
  const [showNewCallForm, setShowNewCallForm] = useState(false);

  const handleLogCall = () => {
    if (!newCall.phone || !newCall.reason) {
      toast({
        title: "Missing Information",
        description: "Phone number and call reason are required.",
        variant: "destructive",
      });
      return;
    }

    const call: CallLog = {
      id: Date.now().toString(),
      callerId: newCall.phone,
      customerName: newCall.customerName || "Unknown Caller",
      phone: newCall.phone,
      callType: "inbound",
      reason: newCall.reason,
      outcome: "follow_up",
      notes: newCall.notes,
      timestamp: new Date(),
      priority: newCall.priority as "normal" | "high" | "emergency",
    };

    setCallLogs([call, ...callLogs]);
    setNewCall({ phone: "", customerName: "", reason: "", priority: "normal", notes: "" });
    setShowNewCallForm(false);
    
    toast({
      title: "Call Logged",
      description: "Call has been logged successfully.",
    });
  };

  const getOccupancyColor = (level: OccupancyLevel) => {
    switch (level) {
      case "green": return "bg-green-500";
      case "yellow": return "bg-yellow-500";
      case "red": return "bg-red-500";
    }
  };

  const getCallTypeIcon = (type: string) => {
    switch (type) {
      case "inbound": return <PhoneIncoming className="w-4 h-4 text-green-500" />;
      case "outbound": return <PhoneOutgoing className="w-4 h-4 text-blue-500" />;
      case "missed": return <PhoneMissed className="w-4 h-4 text-red-500" />;
    }
  };

  const getOutcomeBadge = (outcome: string) => {
    const styles: Record<string, string> = {
      booked: "bg-green-100 text-green-700",
      quote: "bg-blue-100 text-blue-700",
      follow_up: "bg-yellow-100 text-yellow-700",
      no_answer: "bg-gray-100 text-gray-700",
      cancelled: "bg-red-100 text-red-700",
    };
    return (
      <Badge variant="outline" className={`text-[10px] ${styles[outcome]}`}>
        {outcome.replace("_", " ")}
      </Badge>
    );
  };

  const getPriorityIndicator = (priority: string) => {
    if (priority === "emergency") {
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    }
    if (priority === "high") {
      return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    }
    return null;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Call Intake</h1>
          <p className="text-sm text-muted-foreground">
            Log and manage incoming calls
          </p>
        </div>
        <Button 
          className="bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => setShowNewCallForm(!showNewCallForm)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Log New Call
        </Button>
      </div>

      {/* Schedule Occupancy Indicator (Section 2.4) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="metric-card"
      >
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Schedule Availability
        </h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(scheduleOccupancy).map(([day, level]) => (
            <div key={day} className="flex items-center gap-2 text-sm">
              <div className={`w-3 h-3 rounded-full ${getOccupancyColor(level)}`} />
              <span className="text-muted-foreground">{day}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          🟢 Open slots available | 🟡 Limited availability | 🔴 Fully booked
        </p>
      </motion.div>

      {/* New Call Form */}
      {showNewCallForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="metric-card border-accent"
        >
          <h2 className="text-sm font-semibold text-foreground mb-4">Log New Call</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Caller Phone *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  placeholder="(555) 123-4567"
                  value={newCall.phone}
                  onChange={(e) => setNewCall({ ...newCall, phone: e.target.value })}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="customerName">Customer Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="customerName"
                  placeholder="Search or enter name"
                  value={newCall.customerName}
                  onChange={(e) => setNewCall({ ...newCall, customerName: e.target.value })}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="reason">Call Reason *</Label>
              <Select
                value={newCall.reason}
                onValueChange={(v) => setNewCall({ ...newCall, reason: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ac_not_cooling">A/C Not Cooling</SelectItem>
                  <SelectItem value="no_heat">No Heat</SelectItem>
                  <SelectItem value="maintenance">Maintenance Request</SelectItem>
                  <SelectItem value="quote">Request Quote</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="billing">Billing Question</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={newCall.priority}
                onValueChange={(v) => setNewCall({ ...newCall, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional details..."
                value={newCall.notes}
                onChange={(e) => setNewCall({ ...newCall, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowNewCallForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogCall}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Log Call
            </Button>
          </div>
        </motion.div>
      )}

      {/* Call Log List */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="metric-card !p-0 overflow-hidden"
      >
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Recent Calls</h2>
        </div>
        <div className="divide-y divide-border">
          {callLogs.map((call) => (
            <div
              key={call.id}
              className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {getCallTypeIcon(call.callType)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{call.customerName}</span>
                      {getPriorityIndicator(call.priority)}
                      {getOutcomeBadge(call.outcome)}
                    </div>
                    <p className="text-sm text-muted-foreground">{call.phone}</p>
                    <p className="text-sm text-foreground mt-1">{call.reason || "No reason logged"}</p>
                    {call.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {call.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {call.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              {call.callType === "missed" && (
                <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-700 flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3" />
                  Callback required - SLA: 10 minutes
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default CallIntake;
