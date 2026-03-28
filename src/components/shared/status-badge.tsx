import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-700",
  suspended: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
  upcoming: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
  archived: "bg-gray-100 text-gray-500",
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  shortlisted: "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  enrolled: "bg-purple-100 text-purple-700",
  cancelled: "bg-gray-100 text-gray-500",
  unpaid: "bg-red-100 text-red-700",
  partial: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  overpaid: "bg-blue-100 text-blue-700",
  waived: "bg-gray-100 text-gray-500",
  confirmed: "bg-green-100 text-green-700",
  reversed: "bg-red-100 text-red-700",
  default: "bg-gray-100 text-gray-700",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = variants[status.toLowerCase()] || variants.default;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        variant,
        className,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
