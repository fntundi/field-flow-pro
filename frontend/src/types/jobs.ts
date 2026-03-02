export type CallType = "tech" | "sales";
export type CallStatus = "scheduled" | "in_progress" | "complete" | "cancelled";
export type JobStatus = "open" | "in_progress" | "complete" | "urgent" | "pending";

export interface Call {
  id: string;
  type: CallType;
  assignee: string;
  scheduledDate: string;
  duration: string;
  status: CallStatus;
  summary: string;
  discoveryNotes?: string;
}

export interface Job {
  id: string;
  customer: string;
  customerId: string;
  site: string;
  siteAddress: string;
  type: string;
  status: JobStatus;
  priority: string;
  created: string;
  estimatedDays: number;
  calls: Call[];
}

export const callStatusMap: Record<CallStatus, { status: "open" | "in_progress" | "complete" | "cancelled"; label: string }> = {
  scheduled: { status: "open", label: "Scheduled" },
  in_progress: { status: "in_progress", label: "In Progress" },
  complete: { status: "complete", label: "Complete" },
  cancelled: { status: "cancelled", label: "Cancelled" },
};
