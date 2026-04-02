import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, AlertCircle, MinusCircle } from "lucide-react";

type BadgeVariant = "default" | "dot" | "outline";

const variants: Record<string, { bg: string; dotColor?: string }> = {
  active: { bg: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500" },
  inactive: { bg: "bg-gray-100 text-gray-600", dotColor: "bg-gray-400" },
  suspended: { bg: "bg-red-50 text-red-700", dotColor: "bg-red-500" },
  pending: { bg: "bg-amber-50 text-amber-700", dotColor: "bg-amber-500" },
  upcoming: { bg: "bg-amber-50 text-amber-700", dotColor: "bg-amber-500" },
  approved: { bg: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500" },
  rejected: { bg: "bg-red-50 text-red-700", dotColor: "bg-red-500" },
  completed: { bg: "bg-blue-50 text-blue-700", dotColor: "bg-blue-500" },
  archived: { bg: "bg-gray-100 text-gray-500", dotColor: "bg-gray-400" },
  draft: { bg: "bg-gray-100 text-gray-600", dotColor: "bg-gray-400" },
  submitted: { bg: "bg-blue-50 text-blue-700", dotColor: "bg-blue-500" },
  under_review: { bg: "bg-amber-50 text-amber-700", dotColor: "bg-amber-500" },
  shortlisted: { bg: "bg-amber-50 text-amber-700", dotColor: "bg-amber-500" },
  accepted: { bg: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500" },
  enrolled: { bg: "bg-purple-50 text-purple-700", dotColor: "bg-purple-500" },
  cancelled: { bg: "bg-gray-100 text-gray-500", dotColor: "bg-gray-400" },
  in_transit: { bg: "bg-purple-50 text-purple-700", dotColor: "bg-purple-500" },
  received: { bg: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500" },
  partially_issued: { bg: "bg-purple-50 text-purple-700", dotColor: "bg-purple-500" },
  issued: { bg: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500" },
  planned: { bg: "bg-gray-100 text-gray-600", dotColor: "bg-gray-400" },
  in_progress: { bg: "bg-blue-50 text-blue-700", dotColor: "bg-blue-500" },
  unpaid: { bg: "bg-red-50 text-red-700", dotColor: "bg-red-500" },
  partial: { bg: "bg-amber-50 text-amber-700", dotColor: "bg-amber-500" },
  paid: { bg: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500" },
  overpaid: { bg: "bg-blue-50 text-blue-700", dotColor: "bg-blue-500" },
  waived: { bg: "bg-gray-100 text-gray-500", dotColor: "bg-gray-400" },
  confirmed: { bg: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500" },
  reversed: { bg: "bg-red-50 text-red-700", dotColor: "bg-red-500" },
  // Boarding - Incidents
  reported: { bg: "bg-amber-50 text-amber-700", dotColor: "bg-amber-500" },
  investigating: { bg: "bg-blue-50 text-blue-700", dotColor: "bg-blue-500" },
  action_taken: { bg: "bg-purple-50 text-purple-700", dotColor: "bg-purple-500" },
  resolved: { bg: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500" },
  escalated: { bg: "bg-red-50 text-red-700", dotColor: "bg-red-500" },
  dismissed: { bg: "bg-gray-100 text-gray-500", dotColor: "bg-gray-400" },
  // Boarding - Sick Bay
  admitted: { bg: "bg-blue-50 text-blue-700", dotColor: "bg-blue-500" },
  under_observation: { bg: "bg-amber-50 text-amber-700", dotColor: "bg-amber-500" },
  discharged: { bg: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500" },
  referred: { bg: "bg-red-50 text-red-700", dotColor: "bg-red-500" },
  // Boarding - Visitors
  checked_in: { bg: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500" },
  checked_out: { bg: "bg-gray-100 text-gray-500", dotColor: "bg-gray-400" },
  // Boarding - Maintenance
  open: { bg: "bg-red-50 text-red-700", dotColor: "bg-red-500" },
  assigned: { bg: "bg-amber-50 text-amber-700", dotColor: "bg-amber-500" },
  closed: { bg: "bg-gray-100 text-gray-500", dotColor: "bg-gray-400" },
  // Boarding - Severity
  minor: { bg: "bg-gray-100 text-gray-600", dotColor: "bg-gray-400" },
  moderate: { bg: "bg-amber-50 text-amber-700", dotColor: "bg-amber-500" },
  major: { bg: "bg-orange-50 text-orange-700", dotColor: "bg-orange-500" },
  critical: { bg: "bg-red-50 text-red-700", dotColor: "bg-red-500" },
  mild: { bg: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500" },
  severe: { bg: "bg-orange-50 text-orange-700", dotColor: "bg-orange-500" },
  emergency: { bg: "bg-red-50 text-red-700", dotColor: "bg-red-500" },
  urgent: { bg: "bg-red-50 text-red-700", dotColor: "bg-red-500" },
  // Boarding - Inspection Ratings
  excellent: { bg: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500" },
  good: { bg: "bg-blue-50 text-blue-700", dotColor: "bg-blue-500" },
  fair: { bg: "bg-amber-50 text-amber-700", dotColor: "bg-amber-500" },
  poor: { bg: "bg-orange-50 text-orange-700", dotColor: "bg-orange-500" },
  // Boarding - Inspection Types
  routine: { bg: "bg-gray-100 text-gray-600", dotColor: "bg-gray-400" },
  surprise: { bg: "bg-amber-50 text-amber-700", dotColor: "bg-amber-500" },
  follow_up: { bg: "bg-blue-50 text-blue-700", dotColor: "bg-blue-500" },
  end_of_term: { bg: "bg-purple-50 text-purple-700", dotColor: "bg-purple-500" },
  // Boarding - Priority
  low: { bg: "bg-gray-100 text-gray-600", dotColor: "bg-gray-400" },
  medium: { bg: "bg-blue-50 text-blue-700", dotColor: "bg-blue-500" },
  high: { bg: "bg-orange-50 text-orange-700", dotColor: "bg-orange-500" },
  default: { bg: "bg-gray-100 text-gray-600", dotColor: "bg-gray-400" },
};

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  className?: string;
}

export function StatusBadge({ status, variant = "default", className }: StatusBadgeProps) {
  const config = variants[status.toLowerCase()] || variants.default;
  const label = status.replace(/_/g, " ");

  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium capitalize", className)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dotColor)} />
        {label}
      </span>
    );
  }

  if (variant === "outline") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
          config.bg.replace(/bg-\w+-50/, "border-current").replace(/bg-gray-100/, "border-gray-300"),
          config.bg.split(" ").find((c) => c.startsWith("text-")),
          className,
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        config.bg,
        className,
      )}
    >
      {label}
    </span>
  );
}
