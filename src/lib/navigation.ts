import { PERMISSIONS, type Permission } from "@/lib/permissions";

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  permission?: Permission;
  children?: NavItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigationGroups: NavGroup[] = [
  {
    label: "Main",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: "LayoutDashboard",
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        title: "Students",
        href: "/students",
        icon: "GraduationCap",
        permission: PERMISSIONS.STUDENTS_READ,
        children: [
          {
            title: "Student Directory",
            href: "/students",
            icon: "Users",
            permission: PERMISSIONS.STUDENTS_READ,
          },
          {
            title: "New Student",
            href: "/students/new",
            icon: "UserPlus",
            permission: PERMISSIONS.STUDENTS_CREATE,
          },
          {
            title: "Import Students",
            href: "/students/import",
            icon: "FileText",
            permission: PERMISSIONS.STUDENTS_IMPORT,
          },
        ],
      },
      {
        title: "Admissions",
        href: "/admissions",
        icon: "UserPlus",
        permission: PERMISSIONS.ADMISSIONS_READ,
        children: [
          {
            title: "Applications",
            href: "/admissions/applications",
            icon: "FileText",
            permission: PERMISSIONS.ADMISSIONS_READ,
          },
          {
            title: "Placement",
            href: "/admissions/placement",
            icon: "ClipboardList",
            permission: PERMISSIONS.ADMISSIONS_APPROVE,
          },
        ],
      },
      {
        title: "Academics",
        href: "/academics",
        icon: "BookOpen",
        children: [
          {
            title: "Subjects",
            href: "/academics/subjects",
            icon: "Book",
            permission: PERMISSIONS.SUBJECTS_READ,
          },
          {
            title: "Classes",
            href: "/academics/classes",
            icon: "Layout",
            permission: PERMISSIONS.CLASSES_READ,
          },
          {
            title: "Curriculum",
            href: "/academics/curriculum",
            icon: "BookOpen",
            permission: PERMISSIONS.SUBJECTS_READ,
          },
          {
            title: "Teacher Assignments",
            href: "/academics/assignments",
            icon: "Users",
            permission: PERMISSIONS.SUBJECTS_READ,
          },
          {
            title: "Assessments",
            href: "/academics/assessments",
            icon: "ClipboardCheck",
            permission: PERMISSIONS.MARKS_READ,
          },
          {
            title: "Mark Entry",
            href: "/academics/assessments/mark-entry",
            icon: "FileText",
            permission: PERMISSIONS.MARKS_CREATE,
          },
          {
            title: "Mark Approval",
            href: "/academics/assessments/approval",
            icon: "Shield",
            permission: PERMISSIONS.MARKS_APPROVE,
          },
          {
            title: "Results",
            href: "/academics/results",
            icon: "Award",
            permission: PERMISSIONS.RESULTS_READ,
          },
          {
            title: "Report Cards",
            href: "/academics/reports/terminal",
            icon: "FileText",
            permission: PERMISSIONS.RESULTS_READ,
          },
          {
            title: "Broadsheet",
            href: "/academics/reports/broadsheet",
            icon: "BarChart3",
            permission: PERMISSIONS.RESULTS_EXPORT,
          },
        ],
      },
      {
        title: "Attendance",
        href: "/attendance",
        icon: "CheckSquare",
        permission: PERMISSIONS.ATTENDANCE_READ,
        children: [
          {
            title: "Take Attendance",
            href: "/attendance/take",
            icon: "CheckSquare",
            permission: PERMISSIONS.ATTENDANCE_CREATE,
          },
          {
            title: "Reports",
            href: "/attendance/reports",
            icon: "BarChart3",
            permission: PERMISSIONS.ATTENDANCE_READ,
          },
        ],
      },
      {
        title: "Timetable",
        href: "/timetable",
        icon: "Clock",
        children: [
          {
            title: "Timetable",
            href: "/timetable",
            icon: "CalendarDays",
            permission: PERMISSIONS.TIMETABLE_READ,
          },
          {
            title: "Rooms",
            href: "/timetable/rooms",
            icon: "DoorOpen",
            permission: PERMISSIONS.ROOMS_READ,
          },
          {
            title: "Exam Schedule",
            href: "/timetable/exam-schedule",
            icon: "ClipboardList",
            permission: PERMISSIONS.EXAM_SCHEDULE_READ,
          },
        ],
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        title: "Finance",
        href: "/finance",
        icon: "DollarSign",
        children: [
          {
            title: "Fee Structures",
            href: "/finance/fee-structures",
            icon: "FileText",
            permission: PERMISSIONS.FEE_STRUCTURES_READ,
          },
          {
            title: "Billing",
            href: "/finance/billing",
            icon: "Receipt",
            permission: PERMISSIONS.BILLING_READ,
          },
          {
            title: "Payments",
            href: "/finance/payments",
            icon: "CreditCard",
            permission: PERMISSIONS.PAYMENTS_READ,
          },
          {
            title: "Receipts",
            href: "/finance/receipts",
            icon: "FileText",
            permission: PERMISSIONS.PAYMENTS_READ,
          },
          {
            title: "Scholarships",
            href: "/finance/scholarships",
            icon: "Award",
            permission: PERMISSIONS.FEE_STRUCTURES_READ,
          },
          {
            title: "Arrears",
            href: "/finance/arrears",
            icon: "FileText",
            permission: PERMISSIONS.BILLING_READ,
          },
          {
            title: "Reports",
            href: "/finance/reports",
            icon: "BarChart3",
            permission: PERMISSIONS.FINANCE_REPORTS_READ,
          },
        ],
      },
      {
        title: "HR & Staff",
        href: "/hr",
        icon: "Briefcase",
        children: [
          {
            title: "Staff",
            href: "/hr/staff",
            icon: "Users",
            permission: PERMISSIONS.STAFF_READ,
          },
          {
            title: "New Staff",
            href: "/hr/staff/new",
            icon: "UserPlus",
            permission: PERMISSIONS.STAFF_CREATE,
          },
          {
            title: "Leave",
            href: "/hr/leave",
            icon: "Calendar",
            permission: PERMISSIONS.LEAVE_READ,
          },
          {
            title: "Payroll",
            href: "/hr/payroll",
            icon: "DollarSign",
            permission: PERMISSIONS.PAYROLL_READ,
          },
        ],
      },
      {
        title: "Boarding",
        href: "/boarding",
        icon: "Building2",
        children: [
          {
            title: "Hostels",
            href: "/boarding/hostels",
            icon: "Home",
            permission: PERMISSIONS.HOSTELS_READ,
          },
          {
            title: "Allocations",
            href: "/boarding/allocations",
            icon: "BedDouble",
            permission: PERMISSIONS.BED_ALLOCATIONS_READ,
          },
          {
            title: "Exeat",
            href: "/boarding/exeat",
            icon: "DoorOpen",
            permission: PERMISSIONS.EXEAT_READ,
          },
          {
            title: "Roll Call",
            href: "/boarding/roll-call",
            icon: "CheckSquare",
            permission: PERMISSIONS.HOSTELS_READ,
          },
        ],
      },
      {
        title: "Inventory",
        href: "/inventory",
        icon: "Package",
        permission: PERMISSIONS.INVENTORY_READ,
        children: [
          {
            title: "Stores",
            href: "/inventory/stores",
            icon: "Warehouse",
            permission: PERMISSIONS.INVENTORY_READ,
          },
          {
            title: "Items",
            href: "/inventory/items",
            icon: "Package",
            permission: PERMISSIONS.INVENTORY_READ,
          },
          {
            title: "Stock Movement",
            href: "/inventory/stock-movement",
            icon: "ArrowLeftRight",
            permission: PERMISSIONS.STOCK_MOVEMENT_READ,
          },
          {
            title: "Suppliers",
            href: "/inventory/suppliers",
            icon: "Truck",
            permission: PERMISSIONS.INVENTORY_READ,
          },
          {
            title: "Procurement",
            href: "/inventory/procurement",
            icon: "ShoppingCart",
            permission: PERMISSIONS.PROCUREMENT_CREATE,
          },
          {
            title: "Reports",
            href: "/inventory/reports",
            icon: "BarChart3",
            permission: PERMISSIONS.INVENTORY_READ,
          },
        ],
      },
      {
        title: "Communication",
        href: "/communication",
        icon: "MessageSquare",
        children: [
          {
            title: "Announcements",
            href: "/communication/announcements",
            icon: "Megaphone",
            permission: PERMISSIONS.ANNOUNCEMENTS_READ,
          },
          {
            title: "SMS",
            href: "/communication/sms",
            icon: "MessageSquare",
            permission: PERMISSIONS.SMS_SEND,
          },
        ],
      },
      {
        title: "Discipline",
        href: "/discipline",
        icon: "AlertTriangle",
        permission: PERMISSIONS.DISCIPLINE_READ,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        title: "Administration",
        href: "/admin",
        icon: "Settings",
        children: [
          {
            title: "School Settings",
            href: "/admin/school-settings",
            icon: "School",
            permission: PERMISSIONS.SCHOOL_SETTINGS_READ,
          },
          {
            title: "Academic Year",
            href: "/admin/academic-year",
            icon: "Calendar",
            permission: PERMISSIONS.ACADEMIC_YEAR_READ,
          },
          {
            title: "Terms",
            href: "/admin/terms",
            icon: "CalendarDays",
            permission: PERMISSIONS.TERMS_READ,
          },
          {
            title: "Departments",
            href: "/admin/departments",
            icon: "Building",
            permission: PERMISSIONS.DEPARTMENTS_READ,
          },
          {
            title: "Programmes",
            href: "/admin/programmes",
            icon: "GraduationCap",
            permission: PERMISSIONS.PROGRAMMES_READ,
          },
          {
            title: "Houses",
            href: "/admin/houses",
            icon: "Home",
            permission: PERMISSIONS.DEPARTMENTS_READ,
          },
          {
            title: "Grading Scales",
            href: "/admin/grading-scales",
            icon: "BarChart3",
            permission: PERMISSIONS.SCHOOL_SETTINGS_READ,
          },
          {
            title: "System Settings",
            href: "/admin/settings",
            icon: "Settings",
            permission: PERMISSIONS.SCHOOL_SETTINGS_UPDATE,
          },
          {
            title: "Users",
            href: "/admin/users",
            icon: "Users",
            permission: PERMISSIONS.USERS_READ,
          },
          {
            title: "Roles",
            href: "/admin/roles",
            icon: "Shield",
            permission: PERMISSIONS.ROLES_READ,
          },
          {
            title: "Audit Log",
            href: "/admin/audit-log",
            icon: "FileText",
            permission: PERMISSIONS.AUDIT_LOG_READ,
          },
        ],
      },
      {
        title: "Reports",
        href: "/reports",
        icon: "BarChart3",
        children: [
          {
            title: "Overview",
            href: "/reports",
            icon: "BarChart3",
            permission: PERMISSIONS.REPORTS_ACADEMIC_READ,
          },
          {
            title: "Academic",
            href: "/reports/academic",
            icon: "BookOpen",
            permission: PERMISSIONS.REPORTS_ACADEMIC_READ,
          },
          {
            title: "Attendance",
            href: "/reports/attendance",
            icon: "CheckSquare",
            permission: PERMISSIONS.REPORTS_ATTENDANCE_READ,
          },
          {
            title: "Enrollment",
            href: "/reports/enrollment",
            icon: "Users",
            permission: PERMISSIONS.REPORTS_ENROLLMENT_READ,
          },
        ],
      },
      {
        title: "Graduation",
        href: "/graduation",
        icon: "GraduationCap",
        children: [
          {
            title: "Batches",
            href: "/graduation",
            icon: "Award",
            permission: PERMISSIONS.GRADUATION_READ,
          },
          {
            title: "Alumni",
            href: "/graduation/alumni",
            icon: "Users",
            permission: PERMISSIONS.GRADUATION_READ,
          },
        ],
      },
    ],
  },
];

// Flat list for backward compatibility
export const navigationItems: NavItem[] = navigationGroups.flatMap((group) => group.items);
