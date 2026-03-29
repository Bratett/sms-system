"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const LABEL_MAP: Record<string, string> = {
  dashboard: "Dashboard",
  admin: "Administration",
  "school-settings": "School Settings",
  "academic-year": "Academic Year",
  terms: "Terms",
  departments: "Departments",
  programmes: "Programmes",
  houses: "Houses",
  "grading-scales": "Grading Scales",
  settings: "System Settings",
  users: "Users",
  roles: "Roles",
  "audit-log": "Audit Log",
  students: "Students",
  new: "New",
  import: "Import",
  admissions: "Admissions",
  applications: "Applications",
  placement: "Placement",
  academics: "Academics",
  subjects: "Subjects",
  classes: "Classes",
  curriculum: "Curriculum",
  assignments: "Assignments",
  assessments: "Assessments",
  "mark-entry": "Mark Entry",
  approval: "Approval",
  results: "Results",
  reports: "Reports",
  terminal: "Report Cards",
  broadsheet: "Broadsheet",
  attendance: "Attendance",
  take: "Take Attendance",
  timetable: "Timetable",
  rooms: "Rooms",
  "exam-schedule": "Exam Schedule",
  finance: "Finance",
  "fee-structures": "Fee Structures",
  billing: "Billing",
  payments: "Payments",
  receipts: "Receipts",
  scholarships: "Scholarships",
  arrears: "Arrears",
  hr: "HR & Staff",
  staff: "Staff",
  leave: "Leave",
  payroll: "Payroll",
  boarding: "Boarding",
  hostels: "Hostels",
  allocations: "Allocations",
  exeat: "Exeat",
  "roll-call": "Roll Call",
  inventory: "Inventory",
  stores: "Stores",
  items: "Items",
  "stock-movement": "Stock Movement",
  suppliers: "Suppliers",
  procurement: "Procurement",
  communication: "Communication",
  announcements: "Announcements",
  sms: "SMS",
  discipline: "Discipline",
  graduation: "Graduation",
  alumni: "Alumni",
  academic: "Academic",
  enrollment: "Enrollment",
};

function getLabel(segment: string): string {
  return LABEL_MAP[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

export function Breadcrumbs() {
  const pathname = usePathname();

  // Don't render on dashboard root
  if (pathname === "/dashboard") return null;

  const segments = pathname.split("/").filter(Boolean);

  // Skip dynamic segments (UUIDs, IDs)
  const breadcrumbs = segments
    .filter((seg) => !seg.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i) && !seg.match(/^\d+$/))
    .map((segment, index, arr) => {
      const href = "/" + arr.slice(0, index + 1).join("/");
      const isLast = index === arr.length - 1;
      return { label: getLabel(segment), href, isLast };
    });

  if (breadcrumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {breadcrumbs.map((crumb, index) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
