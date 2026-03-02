import React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { StatusColumn, Task } from "@/lib/api";
import TaskCard from "./TaskCard";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KanbanColumnProps {
  column: StatusColumn;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onAddTask?: (status: string) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  tasks,
  onTaskClick,
  onAddTask,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.key,
  });

  return (
    <div
      className={`flex-shrink-0 w-72 md:w-80 bg-muted/30 rounded-lg border border-border transition-colors ${
        isOver ? "bg-muted/50 border-accent" : ""
      }`}
    >
      {/* Column Header */}
      <div
        className="px-3 py-2 border-b border-border flex items-center justify-between"
        style={{ borderLeftColor: column.color, borderLeftWidth: 3 }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: column.color }}
          />
          <h3 className="font-semibold text-sm text-foreground">{column.name}</h3>
          <span className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        {onAddTask && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onAddTask(column.key)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tasks Container */}
      <div
        ref={setNodeRef}
        className="p-2 space-y-2 min-h-[100px] max-h-[calc(100vh-300px)] overflow-y-auto"
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick?.(task)}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
