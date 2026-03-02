import React, { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Task, StatusColumn } from "@/lib/api";
import KanbanColumn from "./KanbanColumn";
import TaskCard from "./TaskCard";

interface KanbanBoardProps {
  tasks: Task[];
  columns: StatusColumn[];
  onTaskMove: (taskId: string, newStatus: string, newOrder: number) => Promise<void>;
  onTaskClick?: (task: Task) => void;
  onAddTask?: (status: string) => void;
  isLoading?: boolean;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  columns,
  onTaskMove,
  onTaskClick,
  onAddTask,
  isLoading,
}) => {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group tasks by status column
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    columns.forEach((col) => {
      grouped[col.key] = tasks
        .filter((t) => t.status === col.key)
        .sort((a, b) => a.order - b.order);
    });
    return grouped;
  }, [tasks, columns]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over if needed for real-time column updates
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    // Find the column we're dropping into
    let targetColumn: string | null = null;
    let targetOrder = 0;

    // Check if dropping on a column
    const column = columns.find((c) => c.key === overId);
    if (column) {
      targetColumn = column.key;
      targetOrder = tasksByColumn[column.key]?.length || 0;
    } else {
      // Dropping on another task
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetColumn = overTask.status;
        targetOrder = overTask.order;
      }
    }

    if (targetColumn) {
      const activeTask = tasks.find((t) => t.id === activeTaskId);
      if (activeTask && (activeTask.status !== targetColumn || activeTask.order !== targetOrder)) {
        await onTaskMove(activeTaskId, targetColumn, targetOrder);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading board...</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
        {columns.map((column) => (
          <KanbanColumn
            key={column.key}
            column={column}
            tasks={tasksByColumn[column.key] || []}
            onTaskClick={onTaskClick}
            onAddTask={onAddTask}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
