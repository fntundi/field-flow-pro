interface StatusBadgeProps {
  status: "open" | "in_progress" | "complete" | "urgent" | "pending" | "cancelled";
  label?: string;
}

const statusMap: Record<StatusBadgeProps["status"], { className: string; defaultLabel: string }> = {
  open: { className: "status-badge status-open", defaultLabel: "Open" },
  in_progress: { className: "status-badge status-progress", defaultLabel: "In Progress" },
  complete: { className: "status-badge status-complete", defaultLabel: "Complete" },
  urgent: { className: "status-badge status-urgent", defaultLabel: "Urgent" },
  pending: { className: "status-badge status-progress", defaultLabel: "Pending" },
  cancelled: { className: "status-badge status-urgent", defaultLabel: "Cancelled" },
};

const StatusBadge = ({ status, label }: StatusBadgeProps) => {
  const config = statusMap[status];
  return <span className={config.className}>{label || config.defaultLabel}</span>;
};

export default StatusBadge;
