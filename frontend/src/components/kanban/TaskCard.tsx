import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/lib/api";
import { Calendar, Clock, User, Wrench, Phone, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
}

const taskTypeIcons: Record<string, React.ReactNode> = {
  tech_call: <Wrench className="w-3 h-3" />,
  sales_call: <Phone className="w-3 h-3" />,
  service: <Wrench className="w-3 h-3" />,
  follow_up: <Phone className="w-3 h-3" />,
  other: <Clock className="w-3 h-3" />,
};

const taskTypeColors: Record<string, string> = {
  tech_call: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  sales_call: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  service: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  follow_up: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

const priorityColors: Record<string, string> = {
  urgent: "border-l-red-500",
  high: "border-l-orange-500",
  normal: "border-l-blue-500",
  low: "border-l-gray-400",
};

const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, isDragging }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCurrentlyDragging = isDragging || isSortableDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all border-l-4",
        priorityColors[task.priority],
        isCurrentlyDragging && "shadow-lg opacity-90 rotate-2 scale-105"
      )}
    >
      {/* Task Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          {task.task_number}
        </span>
        {task.priority === "urgent" && (
          <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
        )}
      </div>

      {/* Task Title */}
      <h4 className="text-sm font-medium text-foreground mb-2 line-clamp-2">
        {task.title}
      </h4>

      {/* Task Type Badge */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded",
            taskTypeColors[task.task_type]
          )}
        >
          {taskTypeIcons[task.task_type]}
          {task.task_type.replace("_", " ")}
        </span>
      </div>

      {/* Task Details */}
      <div className="space-y-1 text-[11px] text-muted-foreground">
        {task.assigned_technician_name && (
          <div className="flex items-center gap-1.5">
            <User className="w-3 h-3" />
            <span className="truncate">{task.assigned_technician_name}</span>
          </div>
        )}
        {task.scheduled_date && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            <span>{task.scheduled_date}</span>
            {task.scheduled_time && <span>@ {task.scheduled_time}</span>}
          </div>
        )}
        {task.estimated_duration && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>{task.estimated_duration}</span>
          </div>
        )}
      </div>

      {/* Discovery Notes Preview */}
      {task.discovery_notes && (
        <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] text-muted-foreground line-clamp-2">
          {task.discovery_notes}
        </div>
      )}
    </div>
  );
};

export default TaskCard;
