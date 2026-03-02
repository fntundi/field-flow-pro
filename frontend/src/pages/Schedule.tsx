import { motion } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";

const techColors: Record<string, string> = {
  "Mike Johnson": "bg-accent/20 border-accent text-accent-foreground",
  "Lisa Chen": "bg-info/20 border-info text-foreground",
  "Tom Brown": "bg-success/20 border-success text-foreground",
  "Amy Davis": "bg-destructive/10 border-destructive text-foreground",
  "Carlos Mendez": "bg-primary/10 border-primary text-foreground",
};

const weekDays = ["Mon 3/2", "Tue 3/3", "Wed 3/4", "Thu 3/5", "Fri 3/6", "Sat 3/7"];
const hours = ["7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM"];

type ScheduleEvent = {
  tech: string;
  job: string;
  customer: string;
  day: number;
  startHour: number;
  duration: number;
  type: string;
};

const events: ScheduleEvent[] = [
  { tech: "Mike Johnson", job: "JOB-1042", customer: "Sarah Mitchell", day: 0, startHour: 8, duration: 3, type: "Install" },
  { tech: "Mike Johnson", job: "JOB-1045", customer: "David Park", day: 0, startHour: 14, duration: 2, type: "Repair" },
  { tech: "Lisa Chen", job: "JOB-1041", customer: "Acme Corp", day: 0, startHour: 9, duration: 4, type: "Commercial" },
  { tech: "Tom Brown", job: "JOB-1040", customer: "James Rivera", day: 0, startHour: 7, duration: 2, type: "Emergency" },
  { tech: "Amy Davis", job: "JOB-1039", customer: "Metro Office Park", day: 1, startHour: 8, duration: 5, type: "Install" },
  { tech: "Mike Johnson", job: "JOB-1046", customer: "Linda Hayes", day: 1, startHour: 8, duration: 3, type: "Maintenance" },
  { tech: "Lisa Chen", job: "JOB-1047", customer: "TechHub Offices", day: 1, startHour: 10, duration: 3, type: "Commercial" },
  { tech: "Tom Brown", job: "JOB-1048", customer: "Robert Kim", day: 2, startHour: 9, duration: 2, type: "Repair" },
  { tech: "Carlos Mendez", job: "JOB-1049", customer: "Patricia Gray", day: 2, startHour: 8, duration: 4, type: "Install" },
  { tech: "Amy Davis", job: "JOB-1050", customer: "Anderson Group", day: 3, startHour: 7, duration: 6, type: "Commercial" },
  { tech: "Mike Johnson", job: "JOB-1051", customer: "Maria Santos", day: 3, startHour: 9, duration: 2, type: "Maintenance" },
  { tech: "Lisa Chen", job: "JOB-1052", customer: "Sarah Mitchell", day: 4, startHour: 8, duration: 3, type: "Install" },
  { tech: "Tom Brown", job: "JOB-1053", customer: "Acme Corp", day: 4, startHour: 10, duration: 4, type: "Commercial" },
];

const technicians = ["Mike Johnson", "Lisa Chen", "Tom Brown", "Amy Davis", "Carlos Mendez"];

const Schedule = () => {
  const [view, setView] = useState<"week" | "day">("week");

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Schedule</h1>
          <p className="page-subtitle">Shift scheduling and calendar management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setView(view === "week" ? "day" : "week")}>
            {view === "week" ? "Day View" : "Week View"}
          </Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="w-4 h-4 mr-2" /> Add Shift
          </Button>
        </div>
      </div>

      {/* Week Nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon"><ChevronLeft className="w-4 h-4" /></Button>
          <h3 className="text-sm font-semibold text-foreground">Mar 2 – Mar 7, 2026</h3>
          <Button variant="outline" size="icon"><ChevronRight className="w-4 h-4" /></Button>
        </div>
        <div className="flex gap-3">
          {technicians.map((tech) => (
            <div key={tech} className="flex items-center gap-1.5 text-xs">
              <div className={`w-3 h-3 rounded-sm border ${techColors[tech]}`} />
              <span className="text-muted-foreground">{tech.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="metric-card !p-0 overflow-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="grid grid-cols-[80px_repeat(6,1fr)] border-b border-border">
            <div className="p-3 text-xs font-medium text-muted-foreground"></div>
            {weekDays.map((day) => (
              <div key={day} className="p-3 text-xs font-semibold text-foreground text-center border-l border-border">{day}</div>
            ))}
          </div>

          {/* Time Slots */}
          {hours.map((hour, hourIdx) => (
            <div key={hour} className="grid grid-cols-[80px_repeat(6,1fr)] border-b border-border/50 min-h-[56px]">
              <div className="p-2 text-xs text-muted-foreground text-right pr-3 pt-1">{hour}</div>
              {weekDays.map((_, dayIdx) => {
                const cellEvents = events.filter(
                  (e) => e.day === dayIdx && e.startHour === hourIdx + 7
                );
                return (
                  <div key={dayIdx} className="border-l border-border/50 p-0.5 relative">
                    {cellEvents.map((ev) => (
                      <div
                        key={ev.job}
                        className={`rounded px-2 py-1 text-xs border cursor-pointer hover:opacity-80 transition-opacity ${techColors[ev.tech]}`}
                        style={{ minHeight: `${ev.duration * 56 - 8}px` }}
                      >
                        <p className="font-semibold truncate">{ev.customer}</p>
                        <p className="text-[10px] opacity-80 truncate">{ev.tech} · {ev.type}</p>
                        <p className="text-[10px] opacity-60">{ev.job}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Schedule;
