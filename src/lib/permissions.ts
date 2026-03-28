export const PERMISSIONS = {
  // School Settings
  SCHOOL_SETTINGS_READ: "school:settings:read",
  SCHOOL_SETTINGS_UPDATE: "school:settings:update",

  // Academic Year & Terms
  ACADEMIC_YEAR_CREATE: "school:academic-year:create",
  ACADEMIC_YEAR_READ: "school:academic-year:read",
  ACADEMIC_YEAR_UPDATE: "school:academic-year:update",
  ACADEMIC_YEAR_DELETE: "school:academic-year:delete",
  TERMS_CREATE: "school:terms:create",
  TERMS_READ: "school:terms:read",
  TERMS_UPDATE: "school:terms:update",
  TERMS_DELETE: "school:terms:delete",

  // User Management
  USERS_CREATE: "admin:users:create",
  USERS_READ: "admin:users:read",
  USERS_UPDATE: "admin:users:update",
  USERS_DELETE: "admin:users:delete",

  // Role Management
  ROLES_CREATE: "admin:roles:create",
  ROLES_READ: "admin:roles:read",
  ROLES_UPDATE: "admin:roles:update",
  ROLES_DELETE: "admin:roles:delete",

  // Audit Log
  AUDIT_LOG_READ: "admin:audit-log:read",

  // Departments
  DEPARTMENTS_CREATE: "school:departments:create",
  DEPARTMENTS_READ: "school:departments:read",
  DEPARTMENTS_UPDATE: "school:departments:update",
  DEPARTMENTS_DELETE: "school:departments:delete",

  // Programmes
  PROGRAMMES_CREATE: "school:programmes:create",
  PROGRAMMES_READ: "school:programmes:read",
  PROGRAMMES_UPDATE: "school:programmes:update",
  PROGRAMMES_DELETE: "school:programmes:delete",

  // Admissions
  ADMISSIONS_CREATE: "admissions:applications:create",
  ADMISSIONS_READ: "admissions:applications:read",
  ADMISSIONS_UPDATE: "admissions:applications:update",
  ADMISSIONS_DELETE: "admissions:applications:delete",
  ADMISSIONS_APPROVE: "admissions:applications:approve",
  ADMISSIONS_EXPORT: "admissions:applications:export",

  // Students
  STUDENTS_CREATE: "students:profile:create",
  STUDENTS_READ: "students:profile:read",
  STUDENTS_UPDATE: "students:profile:update",
  STUDENTS_DELETE: "students:profile:delete",
  STUDENTS_EXPORT: "students:profile:export",
  STUDENTS_IMPORT: "students:profile:import",

  // Classes
  CLASSES_CREATE: "academics:classes:create",
  CLASSES_READ: "academics:classes:read",
  CLASSES_UPDATE: "academics:classes:update",
  CLASSES_DELETE: "academics:classes:delete",

  // Subjects
  SUBJECTS_CREATE: "academics:subjects:create",
  SUBJECTS_READ: "academics:subjects:read",
  SUBJECTS_UPDATE: "academics:subjects:update",
  SUBJECTS_DELETE: "academics:subjects:delete",

  // Attendance
  ATTENDANCE_CREATE: "academics:attendance:create",
  ATTENDANCE_READ: "academics:attendance:read",
  ATTENDANCE_UPDATE: "academics:attendance:update",
  ATTENDANCE_EXPORT: "academics:attendance:export",

  // Marks
  MARKS_CREATE: "academics:marks:create",
  MARKS_READ: "academics:marks:read",
  MARKS_UPDATE: "academics:marks:update",
  MARKS_APPROVE: "academics:marks:approve",

  // Results & Reports
  RESULTS_READ: "academics:results:read",
  RESULTS_COMPUTE: "academics:results:compute",
  RESULTS_PUBLISH: "academics:results:publish",
  RESULTS_EXPORT: "academics:results:export",

  // Finance - Fee Structures
  FEE_STRUCTURES_CREATE: "finance:fee-structures:create",
  FEE_STRUCTURES_READ: "finance:fee-structures:read",
  FEE_STRUCTURES_UPDATE: "finance:fee-structures:update",
  FEE_STRUCTURES_DELETE: "finance:fee-structures:delete",
  FEE_STRUCTURES_APPROVE: "finance:fee-structures:approve",

  // Finance - Billing
  BILLING_CREATE: "finance:billing:create",
  BILLING_READ: "finance:billing:read",
  BILLING_UPDATE: "finance:billing:update",
  BILLING_EXPORT: "finance:billing:export",

  // Finance - Payments
  PAYMENTS_CREATE: "finance:payments:create",
  PAYMENTS_READ: "finance:payments:read",
  PAYMENTS_REVERSE: "finance:payments:reverse",
  PAYMENTS_APPROVE_REVERSAL: "finance:payments:approve-reversal",
  PAYMENTS_EXPORT: "finance:payments:export",

  // Finance - Reports
  FINANCE_REPORTS_READ: "finance:reports:read",
  FINANCE_REPORTS_EXPORT: "finance:reports:export",

  // HR - Staff
  STAFF_CREATE: "hr:staff:create",
  STAFF_READ: "hr:staff:read",
  STAFF_UPDATE: "hr:staff:update",
  STAFF_DELETE: "hr:staff:delete",

  // HR - Leave
  LEAVE_CREATE: "hr:leave:create",
  LEAVE_READ: "hr:leave:read",
  LEAVE_APPROVE: "hr:leave:approve",

  // HR - Payroll
  PAYROLL_CREATE: "hr:payroll:create",
  PAYROLL_READ: "hr:payroll:read",
  PAYROLL_APPROVE: "hr:payroll:approve",

  // Boarding - Hostels
  HOSTELS_CREATE: "boarding:hostels:create",
  HOSTELS_READ: "boarding:hostels:read",
  HOSTELS_UPDATE: "boarding:hostels:update",
  HOSTELS_DELETE: "boarding:hostels:delete",

  // Boarding - Allocations
  BED_ALLOCATIONS_CREATE: "boarding:allocations:create",
  BED_ALLOCATIONS_READ: "boarding:allocations:read",
  BED_ALLOCATIONS_UPDATE: "boarding:allocations:update",

  // Boarding - Exeat
  EXEAT_CREATE: "boarding:exeat:create",
  EXEAT_READ: "boarding:exeat:read",
  EXEAT_APPROVE: "boarding:exeat:approve",

  // Inventory
  INVENTORY_CREATE: "inventory:items:create",
  INVENTORY_READ: "inventory:items:read",
  INVENTORY_UPDATE: "inventory:items:update",
  INVENTORY_DELETE: "inventory:items:delete",
  STOCK_MOVEMENT_CREATE: "inventory:stock:create",
  STOCK_MOVEMENT_READ: "inventory:stock:read",
  PROCUREMENT_CREATE: "inventory:procurement:create",
  PROCUREMENT_APPROVE: "inventory:procurement:approve",

  // Discipline
  DISCIPLINE_CREATE: "discipline:incidents:create",
  DISCIPLINE_READ: "discipline:incidents:read",
  DISCIPLINE_UPDATE: "discipline:incidents:update",
  DISCIPLINE_APPROVE: "discipline:incidents:approve",

  // Communication
  ANNOUNCEMENTS_CREATE: "communication:announcements:create",
  ANNOUNCEMENTS_READ: "communication:announcements:read",
  SMS_SEND: "communication:sms:send",
  MESSAGES_READ: "communication:messages:read",

  // Documents
  DOCUMENTS_CREATE: "documents:files:create",
  DOCUMENTS_READ: "documents:files:read",
  DOCUMENTS_DELETE: "documents:files:delete",

  // Graduation
  GRADUATION_CREATE: "graduation:records:create",
  GRADUATION_READ: "graduation:records:read",
  GRADUATION_APPROVE: "graduation:records:approve",

  // Reports
  REPORTS_ACADEMIC_READ: "reports:academic:read",
  REPORTS_FINANCE_READ: "reports:finance:read",
  REPORTS_ATTENDANCE_READ: "reports:attendance:read",
  REPORTS_ENROLLMENT_READ: "reports:enrollment:read",
  REPORTS_EXPORT: "reports:all:export",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// Default role-permission mappings
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  headmaster: [
    PERMISSIONS.SCHOOL_SETTINGS_READ,
    PERMISSIONS.SCHOOL_SETTINGS_UPDATE,
    PERMISSIONS.ACADEMIC_YEAR_CREATE,
    PERMISSIONS.ACADEMIC_YEAR_READ,
    PERMISSIONS.ACADEMIC_YEAR_UPDATE,
    PERMISSIONS.ACADEMIC_YEAR_DELETE,
    PERMISSIONS.TERMS_CREATE,
    PERMISSIONS.TERMS_READ,
    PERMISSIONS.TERMS_UPDATE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.AUDIT_LOG_READ,
    PERMISSIONS.DEPARTMENTS_CREATE,
    PERMISSIONS.DEPARTMENTS_READ,
    PERMISSIONS.DEPARTMENTS_UPDATE,
    PERMISSIONS.PROGRAMMES_CREATE,
    PERMISSIONS.PROGRAMMES_READ,
    PERMISSIONS.PROGRAMMES_UPDATE,
    PERMISSIONS.ADMISSIONS_READ,
    PERMISSIONS.ADMISSIONS_APPROVE,
    PERMISSIONS.STUDENTS_CREATE,
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.STUDENTS_UPDATE,
    PERMISSIONS.STUDENTS_EXPORT,
    PERMISSIONS.CLASSES_CREATE,
    PERMISSIONS.CLASSES_READ,
    PERMISSIONS.CLASSES_UPDATE,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_EXPORT,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.MARKS_APPROVE,
    PERMISSIONS.RESULTS_READ,
    PERMISSIONS.RESULTS_PUBLISH,
    PERMISSIONS.RESULTS_EXPORT,
    PERMISSIONS.FEE_STRUCTURES_READ,
    PERMISSIONS.FEE_STRUCTURES_APPROVE,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.BILLING_EXPORT,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.PAYMENTS_APPROVE_REVERSAL,
    PERMISSIONS.PAYMENTS_EXPORT,
    PERMISSIONS.FINANCE_REPORTS_READ,
    PERMISSIONS.FINANCE_REPORTS_EXPORT,
    PERMISSIONS.STAFF_CREATE,
    PERMISSIONS.STAFF_READ,
    PERMISSIONS.STAFF_UPDATE,
    PERMISSIONS.LEAVE_READ,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.PAYROLL_READ,
    PERMISSIONS.PAYROLL_APPROVE,
    PERMISSIONS.HOSTELS_CREATE,
    PERMISSIONS.HOSTELS_READ,
    PERMISSIONS.HOSTELS_UPDATE,
    PERMISSIONS.EXEAT_READ,
    PERMISSIONS.EXEAT_APPROVE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.PROCUREMENT_APPROVE,
    PERMISSIONS.DISCIPLINE_READ,
    PERMISSIONS.DISCIPLINE_APPROVE,
    PERMISSIONS.ANNOUNCEMENTS_CREATE,
    PERMISSIONS.ANNOUNCEMENTS_READ,
    PERMISSIONS.SMS_SEND,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.GRADUATION_READ,
    PERMISSIONS.GRADUATION_APPROVE,
    PERMISSIONS.REPORTS_ACADEMIC_READ,
    PERMISSIONS.REPORTS_FINANCE_READ,
    PERMISSIONS.REPORTS_ATTENDANCE_READ,
    PERMISSIONS.REPORTS_ENROLLMENT_READ,
    PERMISSIONS.REPORTS_EXPORT,
  ],
  finance_officer: [
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.ACADEMIC_YEAR_READ,
    PERMISSIONS.TERMS_READ,
    PERMISSIONS.PROGRAMMES_READ,
    PERMISSIONS.CLASSES_READ,
    PERMISSIONS.FEE_STRUCTURES_CREATE,
    PERMISSIONS.FEE_STRUCTURES_READ,
    PERMISSIONS.FEE_STRUCTURES_UPDATE,
    PERMISSIONS.FEE_STRUCTURES_DELETE,
    PERMISSIONS.BILLING_CREATE,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.BILLING_UPDATE,
    PERMISSIONS.BILLING_EXPORT,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.PAYMENTS_REVERSE,
    PERMISSIONS.PAYMENTS_EXPORT,
    PERMISSIONS.FINANCE_REPORTS_READ,
    PERMISSIONS.FINANCE_REPORTS_EXPORT,
    PERMISSIONS.AUDIT_LOG_READ,
    PERMISSIONS.ANNOUNCEMENTS_CREATE,
    PERMISSIONS.ANNOUNCEMENTS_READ,
  ],
  teacher: [
    PERMISSIONS.ACADEMIC_YEAR_READ,
    PERMISSIONS.TERMS_READ,
    PERMISSIONS.PROGRAMMES_READ,
    PERMISSIONS.CLASSES_READ,
    PERMISSIONS.SUBJECTS_READ,
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.ATTENDANCE_CREATE,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_UPDATE,
    PERMISSIONS.MARKS_CREATE,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.MARKS_UPDATE,
    PERMISSIONS.RESULTS_READ,
    PERMISSIONS.ANNOUNCEMENTS_READ,
    PERMISSIONS.DISCIPLINE_CREATE,
    PERMISSIONS.DISCIPLINE_READ,
  ],
};
