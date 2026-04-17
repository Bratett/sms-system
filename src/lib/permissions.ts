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

  // Attendance Policies & Alerts
  ATTENDANCE_POLICY_CREATE: "academics:attendance-policy:create",
  ATTENDANCE_POLICY_READ: "academics:attendance-policy:read",
  ATTENDANCE_POLICY_UPDATE: "academics:attendance-policy:update",
  ATTENDANCE_POLICY_DELETE: "academics:attendance-policy:delete",
  ATTENDANCE_ALERTS_READ: "academics:attendance-alerts:read",
  ATTENDANCE_ALERTS_MANAGE: "academics:attendance-alerts:manage",

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

  // Finance - Fee Templates
  FEE_TEMPLATES_CREATE: "finance:fee-templates:create",
  FEE_TEMPLATES_READ: "finance:fee-templates:read",
  FEE_TEMPLATES_UPDATE: "finance:fee-templates:update",
  FEE_TEMPLATES_DELETE: "finance:fee-templates:delete",

  // Finance - Installments
  INSTALLMENTS_CREATE: "finance:installments:create",
  INSTALLMENTS_READ: "finance:installments:read",
  INSTALLMENTS_UPDATE: "finance:installments:update",

  // Finance - Late Penalties
  PENALTIES_CREATE: "finance:penalties:create",
  PENALTIES_READ: "finance:penalties:read",
  PENALTIES_APPLY: "finance:penalties:apply",
  PENALTIES_WAIVE: "finance:penalties:waive",

  // Finance - Fee Waivers
  FEE_WAIVERS_CREATE: "finance:waivers:create",
  FEE_WAIVERS_READ: "finance:waivers:read",
  FEE_WAIVERS_APPROVE: "finance:waivers:approve",

  // Finance - Government Subsidies
  SUBSIDIES_CREATE: "finance:subsidies:create",
  SUBSIDIES_READ: "finance:subsidies:read",
  SUBSIDIES_UPDATE: "finance:subsidies:update",
  SUBSIDIES_RECORD_DISBURSEMENT: "finance:subsidies:disburse",

  // Finance - Donor Funds
  DONOR_FUNDS_CREATE: "finance:donor-funds:create",
  DONOR_FUNDS_READ: "finance:donor-funds:read",
  DONOR_FUNDS_UPDATE: "finance:donor-funds:update",
  DONOR_FUNDS_ALLOCATE: "finance:donor-funds:allocate",

  // Finance - Financial Aid
  FINANCIAL_AID_CREATE: "finance:financial-aid:create",
  FINANCIAL_AID_READ: "finance:financial-aid:read",
  FINANCIAL_AID_REVIEW: "finance:financial-aid:review",

  // Finance - Payment Links
  PAYMENT_LINKS_CREATE: "finance:payment-links:create",
  PAYMENT_LINKS_READ: "finance:payment-links:read",

  // Finance - Bank Reconciliation
  BANK_RECONCILIATION_CREATE: "finance:bank-reconciliation:create",
  BANK_RECONCILIATION_READ: "finance:bank-reconciliation:read",
  BANK_RECONCILIATION_MATCH: "finance:bank-reconciliation:match",

  // Accounting - Chart of Accounts
  COA_CREATE: "accounting:coa:create",
  COA_READ: "accounting:coa:read",
  COA_UPDATE: "accounting:coa:update",

  // Accounting - Journal Entries
  JOURNAL_CREATE: "accounting:journal:create",
  JOURNAL_READ: "accounting:journal:read",
  JOURNAL_POST: "accounting:journal:post",
  JOURNAL_REVERSE: "accounting:journal:reverse",

  // Accounting - Expenses
  EXPENSES_CREATE: "accounting:expenses:create",
  EXPENSES_READ: "accounting:expenses:read",
  EXPENSES_APPROVE: "accounting:expenses:approve",

  // Accounting - Petty Cash
  PETTY_CASH_CREATE: "accounting:petty-cash:create",
  PETTY_CASH_READ: "accounting:petty-cash:read",
  PETTY_CASH_TRANSACT: "accounting:petty-cash:transact",
  PETTY_CASH_APPROVE: "accounting:petty-cash:approve",

  // Accounting - Budgets
  BUDGETS_CREATE: "accounting:budgets:create",
  BUDGETS_READ: "accounting:budgets:read",
  BUDGETS_APPROVE: "accounting:budgets:approve",

  // Accounting - Expense Claims
  EXPENSE_CLAIMS_CREATE: "accounting:expense-claims:create",
  EXPENSE_CLAIMS_READ: "accounting:expense-claims:read",
  EXPENSE_CLAIMS_APPROVE: "accounting:expense-claims:approve",

  // Accounting - Financial Statements
  FINANCIAL_STATEMENTS_READ: "accounting:statements:read",
  FINANCIAL_STATEMENTS_GENERATE: "accounting:statements:generate",
  FINANCIAL_STATEMENTS_EXPORT: "accounting:statements:export",

  // Accounting - Tax Compliance
  TAX_COMPLIANCE_CREATE: "accounting:tax:create",
  TAX_COMPLIANCE_READ: "accounting:tax:read",
  TAX_COMPLIANCE_FILE: "accounting:tax:file",

  // Accounting - Audit Reports
  AUDIT_REPORTS_READ: "accounting:audit-reports:read",
  AUDIT_REPORTS_EXPORT: "accounting:audit-reports:export",

  // Inventory - Fixed Assets
  FIXED_ASSETS_CREATE: "inventory:fixed-assets:create",
  FIXED_ASSETS_READ: "inventory:fixed-assets:read",
  FIXED_ASSETS_UPDATE: "inventory:fixed-assets:update",
  FIXED_ASSETS_DISPOSE: "inventory:fixed-assets:dispose",
  DEPRECIATION_RUN: "inventory:depreciation:run",
  DEPRECIATION_READ: "inventory:depreciation:read",
  ASSET_MAINTENANCE_CREATE: "inventory:maintenance:create",
  ASSET_MAINTENANCE_READ: "inventory:maintenance:read",

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
  EXEAT_GATE_CHECK: "boarding:exeat:gate-check",

  // Compliance (Ghana statutory returns + NTC licensure)
  COMPLIANCE_READ: "compliance:read",
  COMPLIANCE_RETURN_GENERATE: "compliance:return:generate",
  COMPLIANCE_RETURN_FILE: "compliance:return:file",
  TEACHER_LICENCE_READ: "hr:licence:read",
  TEACHER_LICENCE_MANAGE: "hr:licence:manage",

  // Document templates + e-signature
  DOCUMENT_TEMPLATE_READ: "documents:template:read",
  DOCUMENT_TEMPLATE_MANAGE: "documents:template:manage",
  DOCUMENT_INSTANCE_ISSUE: "documents:instance:issue",
  DOCUMENT_INSTANCE_SIGN: "documents:instance:sign",

  // Phase 4: Finance Dunning
  DUNNING_READ: "finance:dunning:read",
  DUNNING_MANAGE: "finance:dunning:manage",
  DUNNING_RUN: "finance:dunning:run",

  // Phase 4: Supplier Invoices + 3-way match
  SUPPLIER_INVOICE_CREATE: "inventory:invoice:create",
  SUPPLIER_INVOICE_READ: "inventory:invoice:read",
  SUPPLIER_INVOICE_APPROVE: "inventory:invoice:approve",
  SUPPLIER_INVOICE_PAY: "inventory:invoice:pay",
  MATCH_TOLERANCE_MANAGE: "inventory:match-tolerance:manage",

  // Phase 4: Item Bank
  ITEM_BANK_READ: "academics:item-bank:read",
  ITEM_BANK_AUTHOR: "academics:item-bank:author",
  ITEM_BANK_REVIEW: "academics:item-bank:review",
  ITEM_BANK_PUBLISH: "academics:item-bank:publish",

  // Phase 5: Executive / BI dashboards
  REPORTS_READ: "reports:executive:read",

  // Inventory
  INVENTORY_CREATE: "inventory:items:create",
  INVENTORY_READ: "inventory:items:read",
  INVENTORY_UPDATE: "inventory:items:update",
  INVENTORY_DELETE: "inventory:items:delete",
  STOCK_MOVEMENT_CREATE: "inventory:stock:create",
  STOCK_MOVEMENT_READ: "inventory:stock:read",
  PROCUREMENT_CREATE: "inventory:procurement:create",
  PROCUREMENT_APPROVE: "inventory:procurement:approve",

  // Inventory — Transfers
  INVENTORY_TRANSFERS_CREATE: "inventory:transfers:create",
  INVENTORY_TRANSFERS_APPROVE: "inventory:transfers:approve",
  INVENTORY_TRANSFERS_READ: "inventory:transfers:read",

  // Inventory — Requisitions
  INVENTORY_REQUISITIONS_CREATE: "inventory:requisitions:create",
  INVENTORY_REQUISITIONS_APPROVE: "inventory:requisitions:approve",
  INVENTORY_REQUISITIONS_ISSUE: "inventory:requisitions:issue",
  INVENTORY_REQUISITIONS_READ: "inventory:requisitions:read",

  // Inventory — Stock Takes
  INVENTORY_STOCK_TAKE_CREATE: "inventory:stock-take:create",
  INVENTORY_STOCK_TAKE_APPROVE: "inventory:stock-take:approve",
  INVENTORY_STOCK_TAKE_READ: "inventory:stock-take:read",

  // Inventory — Supplier Management
  INVENTORY_SUPPLIERS_MANAGE: "inventory:suppliers:manage",
  INVENTORY_SUPPLIER_CONTRACTS_MANAGE: "inventory:supplier-contracts:manage",

  // Inventory — Asset Lifecycle
  INVENTORY_ASSET_CHECKOUT: "inventory:assets:checkout",
  INVENTORY_ASSET_AUDIT_CREATE: "inventory:asset-audit:create",
  INVENTORY_ASSET_AUDIT_APPROVE: "inventory:asset-audit:approve",
  INVENTORY_ASSET_INSURANCE_MANAGE: "inventory:asset-insurance:manage",

  // Inventory — Analytics & Reports
  INVENTORY_ANALYTICS_READ: "inventory:analytics:read",
  INVENTORY_REPORTS_EXPORT: "inventory:reports:export",

  // Inventory — Wastage & Expiry
  INVENTORY_WASTAGE_RECORD: "inventory:wastage:record",
  INVENTORY_EXPIRY_MANAGE: "inventory:expiry:manage",

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

  // Timetable
  TIMETABLE_CREATE: "timetable:slots:create",
  TIMETABLE_READ: "timetable:slots:read",
  TIMETABLE_UPDATE: "timetable:slots:update",
  TIMETABLE_DELETE: "timetable:slots:delete",
  ROOMS_CREATE: "timetable:rooms:create",
  ROOMS_READ: "timetable:rooms:read",
  ROOMS_UPDATE: "timetable:rooms:update",
  ROOMS_DELETE: "timetable:rooms:delete",
  EXAM_SCHEDULE_CREATE: "timetable:exams:create",
  EXAM_SCHEDULE_READ: "timetable:exams:read",
  EXAM_SCHEDULE_UPDATE: "timetable:exams:update",
  EXAM_SCHEDULE_DELETE: "timetable:exams:delete",

  // Counseling & Welfare
  COUNSELING_CREATE: "welfare:counseling:create",
  COUNSELING_READ: "welfare:counseling:read",
  COUNSELING_UPDATE: "welfare:counseling:update",
  WELFARE_CREATE: "welfare:notes:create",
  WELFARE_READ: "welfare:notes:read",
  WELFARE_UPDATE: "welfare:notes:update",
  COMMENDATION_CREATE: "welfare:commendations:create",
  COMMENDATION_READ: "welfare:commendations:read",

  // Medical
  MEDICAL_CREATE: "medical:records:create",
  MEDICAL_READ: "medical:records:read",
  MEDICAL_UPDATE: "medical:records:update",

  // Transcripts
  TRANSCRIPTS_CREATE: "academics:transcripts:create",
  TRANSCRIPTS_READ: "academics:transcripts:read",

  // Staff HR extras
  STAFF_DISCIPLINE_CREATE: "hr:discipline:create",
  STAFF_DISCIPLINE_READ: "hr:discipline:read",
  STAFF_PERFORMANCE_CREATE: "hr:performance:create",
  STAFF_PERFORMANCE_READ: "hr:performance:read",
  STAFF_READ_ALL: "hr:staff:read-all",

  // Staff Documents
  STAFF_DOCUMENTS_READ: "hr:staff-documents:read",
  STAFF_DOCUMENTS_CREATE: "hr:staff-documents:create",
  STAFF_DOCUMENTS_DELETE: "hr:staff-documents:delete",

  // Holiday Calendar
  HOLIDAY_CREATE: "hr:holiday:create",
  HOLIDAY_READ: "hr:holiday:read",
  HOLIDAY_DELETE: "hr:holiday:delete",

  // Staff Attendance
  STAFF_ATTENDANCE_CREATE: "hr:staff-attendance:create",
  STAFF_ATTENDANCE_READ: "hr:staff-attendance:read",

  // Staff Contracts
  CONTRACT_CREATE: "hr:contract:create",
  CONTRACT_READ: "hr:contract:read",
  CONTRACT_UPDATE: "hr:contract:update",

  // Staff Loans
  LOAN_CREATE: "hr:loan:create",
  LOAN_READ: "hr:loan:read",
  LOAN_APPROVE: "hr:loan:approve",

  // Staff Promotions
  PROMOTION_CREATE: "hr:promotion:create",
  PROMOTION_READ: "hr:promotion:read",

  // Boarding extras
  ROLL_CALL_CREATE: "boarding:rollcall:create",
  ROLL_CALL_READ: "boarding:rollcall:read",

  // Boarding - Incidents
  BOARDING_INCIDENTS_CREATE: "boarding:incidents:create",
  BOARDING_INCIDENTS_READ: "boarding:incidents:read",
  BOARDING_INCIDENTS_UPDATE: "boarding:incidents:update",
  BOARDING_INCIDENTS_ESCALATE: "boarding:incidents:escalate",

  // Boarding - Sick Bay
  SICK_BAY_CREATE: "boarding:sickbay:create",
  SICK_BAY_READ: "boarding:sickbay:read",
  SICK_BAY_UPDATE: "boarding:sickbay:update",
  SICK_BAY_DISCHARGE: "boarding:sickbay:discharge",

  // Boarding - Visitors
  BOARDING_VISITORS_CREATE: "boarding:visitors:create",
  BOARDING_VISITORS_READ: "boarding:visitors:read",

  // Boarding - Transfers
  BED_TRANSFERS_CREATE: "boarding:transfers:create",
  BED_TRANSFERS_READ: "boarding:transfers:read",
  BED_TRANSFERS_APPROVE: "boarding:transfers:approve",

  // Boarding - Inspections
  HOSTEL_INSPECTIONS_CREATE: "boarding:inspections:create",
  HOSTEL_INSPECTIONS_READ: "boarding:inspections:read",

  // Boarding - Maintenance
  MAINTENANCE_CREATE: "boarding:maintenance:create",
  MAINTENANCE_READ: "boarding:maintenance:read",
  MAINTENANCE_UPDATE: "boarding:maintenance:update",
  MAINTENANCE_ASSIGN: "boarding:maintenance:assign",

  // Houses
  HOUSES_CREATE: "school:houses:create",
  HOUSES_READ: "school:houses:read",
  HOUSES_UPDATE: "school:houses:update",

  // Library
  LIBRARY_CREATE: "library:books:create",
  LIBRARY_READ: "library:books:read",
  LIBRARY_UPDATE: "library:books:update",
  LIBRARY_DELETE: "library:books:delete",
  LIBRARY_CHECKOUT: "library:books:checkout",
  LIBRARY_RETURN: "library:books:return",

  // Transport
  TRANSPORT_CREATE: "transport:routes:create",
  TRANSPORT_READ: "transport:routes:read",
  TRANSPORT_UPDATE: "transport:routes:update",
  TRANSPORT_DELETE: "transport:routes:delete",
  TRANSPORT_ASSIGN: "transport:routes:assign",

  // LMS
  LMS_COURSE_CREATE: "lms:courses:create",
  LMS_COURSE_READ: "lms:courses:read",
  LMS_COURSE_UPDATE: "lms:courses:update",
  LMS_LESSON_CREATE: "lms:lessons:create",
  LMS_LESSON_READ: "lms:lessons:read",
  LMS_ASSIGNMENT_CREATE: "lms:assignments:create",
  LMS_ASSIGNMENT_READ: "lms:assignments:read",
  LMS_ASSIGNMENT_GRADE: "lms:assignments:grade",

  // Compliance
  COMPLIANCE_CONSENT_READ: "compliance:consent:read",
  COMPLIANCE_CONSENT_CREATE: "compliance:consent:create",
  COMPLIANCE_DATA_RIGHTS_READ: "compliance:data-rights:read",
  COMPLIANCE_DATA_RIGHTS_CREATE: "compliance:data-rights:create",
  COMPLIANCE_DATA_RIGHTS_PROCESS: "compliance:data-rights:process",

  // Analytics
  ANALYTICS_READ: "analytics:dashboard:read",
  ANALYTICS_COMPUTE: "analytics:profiles:compute",

  // Conduct
  CONDUCT_CREATE: "academics:conduct:create",
  CONDUCT_READ: "academics:conduct:read",
  CONDUCT_UPDATE: "academics:conduct:update",

  // Elective Selection
  ELECTIVE_SELECTION_CREATE: "academics:electives:create",
  ELECTIVE_SELECTION_READ: "academics:electives:read",
  ELECTIVE_SELECTION_APPROVE: "academics:electives:approve",

  // Interventions
  INTERVENTIONS_CREATE: "academics:interventions:create",
  INTERVENTIONS_READ: "academics:interventions:read",
  INTERVENTIONS_UPDATE: "academics:interventions:update",

  // Academic Events
  ACADEMIC_EVENTS_CREATE: "school:events:create",
  ACADEMIC_EVENTS_READ: "school:events:read",
  ACADEMIC_EVENTS_UPDATE: "school:events:update",
  ACADEMIC_EVENTS_DELETE: "school:events:delete",

  // Report Templates
  REPORT_TEMPLATES_CREATE: "academics:report-templates:create",
  REPORT_TEMPLATES_READ: "academics:report-templates:read",
  REPORT_TEMPLATES_UPDATE: "academics:report-templates:update",

  // Homework
  HOMEWORK_CREATE: "academics:homework:create",
  HOMEWORK_READ: "academics:homework:read",
  HOMEWORK_GRADE: "academics:homework:grade",

  // PTC
  PTC_CREATE: "communication:ptc:create",
  PTC_READ: "communication:ptc:read",
  PTC_BOOK: "communication:ptc:book",

  // Timetable Generate
  TIMETABLE_GENERATE: "timetable:slots:generate",

  // Timetable - Substitutions
  SUBSTITUTION_CREATE: "timetable:substitutions:create",
  SUBSTITUTION_READ: "timetable:substitutions:read",
  SUBSTITUTION_APPROVE: "timetable:substitutions:approve",
  SUBSTITUTION_DELETE: "timetable:substitutions:delete",

  // Timetable - Teacher Availability
  TEACHER_AVAILABILITY_CREATE: "timetable:availability:create",
  TEACHER_AVAILABILITY_READ: "timetable:availability:read",
  TEACHER_AVAILABILITY_UPDATE: "timetable:availability:update",
  TEACHER_AVAILABILITY_DELETE: "timetable:availability:delete",

  // Timetable - Versions
  TIMETABLE_VERSION_CREATE: "timetable:versions:create",
  TIMETABLE_VERSION_READ: "timetable:versions:read",
  TIMETABLE_VERSION_PUBLISH: "timetable:versions:publish",
  TIMETABLE_VERSION_RESTORE: "timetable:versions:restore",

  // Bulk Operations
  BULK_OPERATIONS: "academics:bulk:execute",

  // Co-Curricular
  COCURRICULAR_CREATE: "academics:activities:create",
  COCURRICULAR_READ: "academics:activities:read",
  COCURRICULAR_UPDATE: "academics:activities:update",

  // Awards
  AWARDS_CREATE: "academics:awards:create",
  AWARDS_READ: "academics:awards:read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/**
 * Check if a session user has the required permission.
 * Returns an error object if unauthorized, or null if allowed.
 */
export function requirePermission(
  session: { user?: { id?: string | null; permissions?: string[] } } | null,
  permission: Permission,
): { error: string } | null {
  if (!session?.user?.id) return { error: "Unauthorized" };
  const perms = session.user.permissions;
  if (!perms) return { error: "No permissions found" };
  if (perms.includes("*") || perms.includes(permission)) return null;
  return { error: "Insufficient permissions" };
}

/**
 * Check permission and return true if denied (for use with early-return pattern).
 * Usage: if (denyPermission(session, PERMISSIONS.X)) return { error: "Insufficient permissions" };
 */
export function denyPermission(
  session: { user?: { id?: string | null; permissions?: string[] } } | null,
  permission: Permission,
): boolean {
  if (!session?.user?.id) return true;
  const perms = session.user.permissions;
  if (!perms) return true;
  return !perms.includes("*") && !perms.includes(permission);
}

/**
 * Assert that the session has the required permission.
 * Returns an error object if denied, or null if allowed.
 * Designed for use with requireSchoolContext():
 *
 * ```ts
 * const ctx = await requireSchoolContext();
 * if ("error" in ctx) return ctx;
 * const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_READ);
 * if (denied) return denied;
 * ```
 */
export function assertPermission(
  session: { user?: { id?: string | null; permissions?: string[] } } | null,
  ...permissions: Permission[]
): { error: string } | null {
  if (!session?.user?.id) return { error: "Unauthorized" };
  const perms = session.user.permissions;
  if (!perms) return { error: "No permissions found" };
  if (perms.includes("*")) return null;
  for (const permission of permissions) {
    if (perms.includes(permission)) return null;
  }
  return { error: "Insufficient permissions" };
}

// Default role-permission mappings
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  headmaster: [
    PERMISSIONS.SCHOOL_SETTINGS_READ,
    PERMISSIONS.SCHOOL_SETTINGS_UPDATE,
    PERMISSIONS.COMPLIANCE_READ,
    PERMISSIONS.COMPLIANCE_RETURN_GENERATE,
    PERMISSIONS.COMPLIANCE_RETURN_FILE,
    PERMISSIONS.TEACHER_LICENCE_READ,
    PERMISSIONS.TEACHER_LICENCE_MANAGE,
    PERMISSIONS.DOCUMENT_TEMPLATE_READ,
    PERMISSIONS.DOCUMENT_TEMPLATE_MANAGE,
    PERMISSIONS.DOCUMENT_INSTANCE_ISSUE,
    PERMISSIONS.DUNNING_READ,
    PERMISSIONS.DUNNING_MANAGE,
    PERMISSIONS.DUNNING_RUN,
    PERMISSIONS.SUPPLIER_INVOICE_READ,
    PERMISSIONS.SUPPLIER_INVOICE_APPROVE,
    PERMISSIONS.SUPPLIER_INVOICE_PAY,
    PERMISSIONS.MATCH_TOLERANCE_MANAGE,
    PERMISSIONS.ITEM_BANK_READ,
    PERMISSIONS.ITEM_BANK_REVIEW,
    PERMISSIONS.ITEM_BANK_PUBLISH,
    PERMISSIONS.REPORTS_READ,
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
    PERMISSIONS.STAFF_READ_ALL,
    PERMISSIONS.LEAVE_READ,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.PAYROLL_READ,
    PERMISSIONS.PAYROLL_APPROVE,
    PERMISSIONS.STAFF_DOCUMENTS_READ,
    PERMISSIONS.HOLIDAY_READ,
    PERMISSIONS.STAFF_ATTENDANCE_READ,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.LOAN_READ,
    PERMISSIONS.LOAN_APPROVE,
    PERMISSIONS.PROMOTION_READ,
    PERMISSIONS.HOSTELS_CREATE,
    PERMISSIONS.HOSTELS_READ,
    PERMISSIONS.HOSTELS_UPDATE,
    PERMISSIONS.EXEAT_READ,
    PERMISSIONS.EXEAT_APPROVE,
    PERMISSIONS.EXEAT_GATE_CHECK,
    PERMISSIONS.BOARDING_INCIDENTS_READ,
    PERMISSIONS.BOARDING_INCIDENTS_UPDATE,
    PERMISSIONS.BOARDING_INCIDENTS_ESCALATE,
    PERMISSIONS.SICK_BAY_READ,
    PERMISSIONS.SICK_BAY_DISCHARGE,
    PERMISSIONS.BOARDING_VISITORS_READ,
    PERMISSIONS.BED_TRANSFERS_READ,
    PERMISSIONS.BED_TRANSFERS_APPROVE,
    PERMISSIONS.HOSTEL_INSPECTIONS_READ,
    PERMISSIONS.MAINTENANCE_READ,
    PERMISSIONS.MAINTENANCE_ASSIGN,
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
    PERMISSIONS.TIMETABLE_CREATE,
    PERMISSIONS.TIMETABLE_READ,
    PERMISSIONS.TIMETABLE_UPDATE,
    PERMISSIONS.TIMETABLE_DELETE,
    PERMISSIONS.ROOMS_CREATE,
    PERMISSIONS.ROOMS_READ,
    PERMISSIONS.ROOMS_UPDATE,
    PERMISSIONS.ROOMS_DELETE,
    PERMISSIONS.EXAM_SCHEDULE_CREATE,
    PERMISSIONS.EXAM_SCHEDULE_READ,
    PERMISSIONS.EXAM_SCHEDULE_UPDATE,
    PERMISSIONS.EXAM_SCHEDULE_DELETE,
    PERMISSIONS.REPORTS_ACADEMIC_READ,
    PERMISSIONS.REPORTS_FINANCE_READ,
    PERMISSIONS.REPORTS_ATTENDANCE_READ,
    PERMISSIONS.REPORTS_ENROLLMENT_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.LIBRARY_READ,
    PERMISSIONS.TRANSPORT_READ,
    PERMISSIONS.LMS_COURSE_READ,
    PERMISSIONS.COMPLIANCE_CONSENT_READ,
    PERMISSIONS.COMPLIANCE_DATA_RIGHTS_READ,
    PERMISSIONS.COMPLIANCE_DATA_RIGHTS_PROCESS,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_COMPUTE,
    // New academic enhancements
    PERMISSIONS.CONDUCT_READ,
    PERMISSIONS.ELECTIVE_SELECTION_READ,
    PERMISSIONS.ELECTIVE_SELECTION_APPROVE,
    PERMISSIONS.INTERVENTIONS_READ,
    PERMISSIONS.ACADEMIC_EVENTS_CREATE,
    PERMISSIONS.ACADEMIC_EVENTS_READ,
    PERMISSIONS.ACADEMIC_EVENTS_UPDATE,
    PERMISSIONS.ACADEMIC_EVENTS_DELETE,
    PERMISSIONS.REPORT_TEMPLATES_READ,
    PERMISSIONS.REPORT_TEMPLATES_CREATE,
    PERMISSIONS.REPORT_TEMPLATES_UPDATE,
    PERMISSIONS.HOMEWORK_READ,
    PERMISSIONS.PTC_CREATE,
    PERMISSIONS.PTC_READ,
    PERMISSIONS.TIMETABLE_GENERATE,
    PERMISSIONS.BULK_OPERATIONS,
    PERMISSIONS.COCURRICULAR_READ,
    PERMISSIONS.AWARDS_READ,
    PERMISSIONS.AWARDS_CREATE,
    // Phase 1A: Fee management enhancements
    PERMISSIONS.FEE_TEMPLATES_READ,
    PERMISSIONS.INSTALLMENTS_READ,
    PERMISSIONS.PENALTIES_READ,
    PERMISSIONS.FEE_WAIVERS_READ,
    PERMISSIONS.FEE_WAIVERS_APPROVE,
    // Phase 1B: Read access for subsidies, donor funds, financial aid
    PERMISSIONS.SUBSIDIES_READ,
    PERMISSIONS.DONOR_FUNDS_READ,
    PERMISSIONS.FINANCIAL_AID_READ,
    PERMISSIONS.FINANCIAL_AID_REVIEW,
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
    // Phase 1A: Fee management enhancements
    PERMISSIONS.FEE_TEMPLATES_CREATE,
    PERMISSIONS.FEE_TEMPLATES_READ,
    PERMISSIONS.FEE_TEMPLATES_UPDATE,
    PERMISSIONS.FEE_TEMPLATES_DELETE,
    PERMISSIONS.INSTALLMENTS_CREATE,
    PERMISSIONS.INSTALLMENTS_READ,
    PERMISSIONS.INSTALLMENTS_UPDATE,
    PERMISSIONS.PENALTIES_CREATE,
    PERMISSIONS.PENALTIES_READ,
    PERMISSIONS.PENALTIES_APPLY,
    PERMISSIONS.PENALTIES_WAIVE,
    PERMISSIONS.FEE_WAIVERS_CREATE,
    PERMISSIONS.FEE_WAIVERS_READ,
    // Phase 1B: Subsidies, Donor Funds, Financial Aid
    PERMISSIONS.SUBSIDIES_CREATE,
    PERMISSIONS.SUBSIDIES_READ,
    PERMISSIONS.SUBSIDIES_UPDATE,
    PERMISSIONS.SUBSIDIES_RECORD_DISBURSEMENT,
    PERMISSIONS.DONOR_FUNDS_CREATE,
    PERMISSIONS.DONOR_FUNDS_READ,
    PERMISSIONS.DONOR_FUNDS_UPDATE,
    PERMISSIONS.DONOR_FUNDS_ALLOCATE,
    PERMISSIONS.FINANCIAL_AID_CREATE,
    PERMISSIONS.FINANCIAL_AID_READ,
    PERMISSIONS.FINANCIAL_AID_REVIEW,
    // Phase 2: Payment links, bank reconciliation
    PERMISSIONS.PAYMENT_LINKS_CREATE,
    PERMISSIONS.PAYMENT_LINKS_READ,
    PERMISSIONS.BANK_RECONCILIATION_CREATE,
    PERMISSIONS.BANK_RECONCILIATION_READ,
    PERMISSIONS.BANK_RECONCILIATION_MATCH,
    // Phase 3: Accounting
    PERMISSIONS.COA_CREATE,
    PERMISSIONS.COA_READ,
    PERMISSIONS.COA_UPDATE,
    PERMISSIONS.JOURNAL_CREATE,
    PERMISSIONS.JOURNAL_READ,
    PERMISSIONS.JOURNAL_POST,
    PERMISSIONS.JOURNAL_REVERSE,
    PERMISSIONS.EXPENSES_CREATE,
    PERMISSIONS.EXPENSES_READ,
    PERMISSIONS.EXPENSES_APPROVE,
    PERMISSIONS.PETTY_CASH_CREATE,
    PERMISSIONS.PETTY_CASH_READ,
    PERMISSIONS.PETTY_CASH_TRANSACT,
    PERMISSIONS.PETTY_CASH_APPROVE,
    PERMISSIONS.BUDGETS_CREATE,
    PERMISSIONS.BUDGETS_READ,
    PERMISSIONS.BUDGETS_APPROVE,
    PERMISSIONS.EXPENSE_CLAIMS_CREATE,
    PERMISSIONS.EXPENSE_CLAIMS_READ,
    PERMISSIONS.EXPENSE_CLAIMS_APPROVE,
    // Phase 4: Financial statements, tax, audit
    PERMISSIONS.FINANCIAL_STATEMENTS_READ,
    PERMISSIONS.FINANCIAL_STATEMENTS_GENERATE,
    PERMISSIONS.FINANCIAL_STATEMENTS_EXPORT,
    PERMISSIONS.TAX_COMPLIANCE_CREATE,
    PERMISSIONS.TAX_COMPLIANCE_READ,
    PERMISSIONS.TAX_COMPLIANCE_FILE,
    PERMISSIONS.AUDIT_REPORTS_READ,
    PERMISSIONS.AUDIT_REPORTS_EXPORT,
    // Phase 5: Fixed assets
    PERMISSIONS.FIXED_ASSETS_CREATE,
    PERMISSIONS.FIXED_ASSETS_READ,
    PERMISSIONS.FIXED_ASSETS_UPDATE,
    PERMISSIONS.FIXED_ASSETS_DISPOSE,
    PERMISSIONS.DEPRECIATION_RUN,
    PERMISSIONS.DEPRECIATION_READ,
    PERMISSIONS.ASSET_MAINTENANCE_CREATE,
    PERMISSIONS.ASSET_MAINTENANCE_READ,
  ],
  assistant_headmaster_academic: [
    PERMISSIONS.SCHOOL_SETTINGS_READ,
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
    PERMISSIONS.CLASSES_DELETE,
    PERMISSIONS.SUBJECTS_CREATE,
    PERMISSIONS.SUBJECTS_READ,
    PERMISSIONS.SUBJECTS_UPDATE,
    PERMISSIONS.SUBJECTS_DELETE,
    PERMISSIONS.ATTENDANCE_CREATE,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_UPDATE,
    PERMISSIONS.ATTENDANCE_EXPORT,
    PERMISSIONS.MARKS_CREATE,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.MARKS_UPDATE,
    PERMISSIONS.MARKS_APPROVE,
    PERMISSIONS.RESULTS_READ,
    PERMISSIONS.RESULTS_COMPUTE,
    PERMISSIONS.RESULTS_PUBLISH,
    PERMISSIONS.RESULTS_EXPORT,
    PERMISSIONS.TIMETABLE_CREATE,
    PERMISSIONS.TIMETABLE_READ,
    PERMISSIONS.TIMETABLE_UPDATE,
    PERMISSIONS.TIMETABLE_DELETE,
    PERMISSIONS.ROOMS_CREATE,
    PERMISSIONS.ROOMS_READ,
    PERMISSIONS.ROOMS_UPDATE,
    PERMISSIONS.ROOMS_DELETE,
    PERMISSIONS.EXAM_SCHEDULE_CREATE,
    PERMISSIONS.EXAM_SCHEDULE_READ,
    PERMISSIONS.EXAM_SCHEDULE_UPDATE,
    PERMISSIONS.EXAM_SCHEDULE_DELETE,
    PERMISSIONS.TRANSCRIPTS_CREATE,
    PERMISSIONS.TRANSCRIPTS_READ,
    PERMISSIONS.DISCIPLINE_READ,
    PERMISSIONS.DISCIPLINE_APPROVE,
    PERMISSIONS.ANNOUNCEMENTS_CREATE,
    PERMISSIONS.ANNOUNCEMENTS_READ,
    PERMISSIONS.SMS_SEND,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.GRADUATION_READ,
    PERMISSIONS.GRADUATION_APPROVE,
    PERMISSIONS.REPORTS_ACADEMIC_READ,
    PERMISSIONS.REPORTS_ATTENDANCE_READ,
    PERMISSIONS.REPORTS_ENROLLMENT_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.LMS_COURSE_CREATE,
    PERMISSIONS.LMS_COURSE_READ,
    PERMISSIONS.LMS_COURSE_UPDATE,
    PERMISSIONS.LMS_LESSON_CREATE,
    PERMISSIONS.LMS_LESSON_READ,
    PERMISSIONS.LMS_ASSIGNMENT_CREATE,
    PERMISSIONS.LMS_ASSIGNMENT_READ,
    PERMISSIONS.LMS_ASSIGNMENT_GRADE,
    PERMISSIONS.ANALYTICS_READ,
    // New academic enhancements
    PERMISSIONS.CONDUCT_CREATE,
    PERMISSIONS.CONDUCT_READ,
    PERMISSIONS.CONDUCT_UPDATE,
    PERMISSIONS.ELECTIVE_SELECTION_READ,
    PERMISSIONS.ELECTIVE_SELECTION_APPROVE,
    PERMISSIONS.INTERVENTIONS_CREATE,
    PERMISSIONS.INTERVENTIONS_READ,
    PERMISSIONS.INTERVENTIONS_UPDATE,
    PERMISSIONS.ACADEMIC_EVENTS_CREATE,
    PERMISSIONS.ACADEMIC_EVENTS_READ,
    PERMISSIONS.ACADEMIC_EVENTS_UPDATE,
    PERMISSIONS.REPORT_TEMPLATES_CREATE,
    PERMISSIONS.REPORT_TEMPLATES_READ,
    PERMISSIONS.REPORT_TEMPLATES_UPDATE,
    PERMISSIONS.HOMEWORK_CREATE,
    PERMISSIONS.HOMEWORK_READ,
    PERMISSIONS.HOMEWORK_GRADE,
    PERMISSIONS.PTC_CREATE,
    PERMISSIONS.PTC_READ,
    PERMISSIONS.TIMETABLE_GENERATE,
    PERMISSIONS.BULK_OPERATIONS,
    PERMISSIONS.COCURRICULAR_CREATE,
    PERMISSIONS.COCURRICULAR_READ,
    PERMISSIONS.COCURRICULAR_UPDATE,
    PERMISSIONS.AWARDS_CREATE,
    PERMISSIONS.AWARDS_READ,
  ],
  assistant_headmaster_admin: [
    PERMISSIONS.SCHOOL_SETTINGS_READ,
    PERMISSIONS.SCHOOL_SETTINGS_UPDATE,
    PERMISSIONS.COMPLIANCE_READ,
    PERMISSIONS.COMPLIANCE_RETURN_GENERATE,
    PERMISSIONS.COMPLIANCE_RETURN_FILE,
    PERMISSIONS.TEACHER_LICENCE_READ,
    PERMISSIONS.TEACHER_LICENCE_MANAGE,
    PERMISSIONS.DOCUMENT_TEMPLATE_READ,
    PERMISSIONS.DOCUMENT_TEMPLATE_MANAGE,
    PERMISSIONS.DOCUMENT_INSTANCE_ISSUE,
    PERMISSIONS.DUNNING_READ,
    PERMISSIONS.DUNNING_MANAGE,
    PERMISSIONS.DUNNING_RUN,
    PERMISSIONS.SUPPLIER_INVOICE_READ,
    PERMISSIONS.SUPPLIER_INVOICE_APPROVE,
    PERMISSIONS.MATCH_TOLERANCE_MANAGE,
    PERMISSIONS.ITEM_BANK_READ,
    PERMISSIONS.ITEM_BANK_REVIEW,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.ACADEMIC_YEAR_READ,
    PERMISSIONS.TERMS_READ,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.AUDIT_LOG_READ,
    PERMISSIONS.DEPARTMENTS_CREATE,
    PERMISSIONS.DEPARTMENTS_READ,
    PERMISSIONS.DEPARTMENTS_UPDATE,
    PERMISSIONS.PROGRAMMES_READ,
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.STUDENTS_UPDATE,
    PERMISSIONS.STUDENTS_EXPORT,
    PERMISSIONS.CLASSES_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_EXPORT,
    PERMISSIONS.FEE_STRUCTURES_READ,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.BILLING_EXPORT,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.PAYMENTS_EXPORT,
    PERMISSIONS.FINANCE_REPORTS_READ,
    PERMISSIONS.FINANCE_REPORTS_EXPORT,
    PERMISSIONS.STAFF_CREATE,
    PERMISSIONS.STAFF_READ,
    PERMISSIONS.STAFF_UPDATE,
    PERMISSIONS.STAFF_DELETE,
    PERMISSIONS.LEAVE_CREATE,
    PERMISSIONS.LEAVE_READ,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.PAYROLL_READ,
    PERMISSIONS.PAYROLL_APPROVE,
    PERMISSIONS.STAFF_DISCIPLINE_CREATE,
    PERMISSIONS.STAFF_DISCIPLINE_READ,
    PERMISSIONS.STAFF_PERFORMANCE_CREATE,
    PERMISSIONS.STAFF_PERFORMANCE_READ,
    PERMISSIONS.STAFF_READ_ALL,
    PERMISSIONS.STAFF_DOCUMENTS_READ,
    PERMISSIONS.STAFF_DOCUMENTS_CREATE,
    PERMISSIONS.STAFF_DOCUMENTS_DELETE,
    PERMISSIONS.HOLIDAY_CREATE,
    PERMISSIONS.HOLIDAY_READ,
    PERMISSIONS.HOLIDAY_DELETE,
    PERMISSIONS.STAFF_ATTENDANCE_CREATE,
    PERMISSIONS.STAFF_ATTENDANCE_READ,
    PERMISSIONS.CONTRACT_CREATE,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.CONTRACT_UPDATE,
    PERMISSIONS.LOAN_CREATE,
    PERMISSIONS.LOAN_READ,
    PERMISSIONS.LOAN_APPROVE,
    PERMISSIONS.PROMOTION_CREATE,
    PERMISSIONS.PROMOTION_READ,
    PERMISSIONS.HOSTELS_CREATE,
    PERMISSIONS.HOSTELS_READ,
    PERMISSIONS.HOSTELS_UPDATE,
    PERMISSIONS.HOSTELS_DELETE,
    PERMISSIONS.BED_ALLOCATIONS_CREATE,
    PERMISSIONS.BED_ALLOCATIONS_READ,
    PERMISSIONS.BED_ALLOCATIONS_UPDATE,
    PERMISSIONS.EXEAT_READ,
    PERMISSIONS.EXEAT_APPROVE,
    PERMISSIONS.EXEAT_GATE_CHECK,
    PERMISSIONS.ROLL_CALL_READ,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.STOCK_MOVEMENT_CREATE,
    PERMISSIONS.STOCK_MOVEMENT_READ,
    PERMISSIONS.PROCUREMENT_CREATE,
    PERMISSIONS.PROCUREMENT_APPROVE,
    PERMISSIONS.INVENTORY_TRANSFERS_CREATE,
    PERMISSIONS.INVENTORY_TRANSFERS_APPROVE,
    PERMISSIONS.INVENTORY_TRANSFERS_READ,
    PERMISSIONS.INVENTORY_REQUISITIONS_CREATE,
    PERMISSIONS.INVENTORY_REQUISITIONS_APPROVE,
    PERMISSIONS.INVENTORY_REQUISITIONS_ISSUE,
    PERMISSIONS.INVENTORY_REQUISITIONS_READ,
    PERMISSIONS.INVENTORY_STOCK_TAKE_CREATE,
    PERMISSIONS.INVENTORY_STOCK_TAKE_APPROVE,
    PERMISSIONS.INVENTORY_STOCK_TAKE_READ,
    PERMISSIONS.INVENTORY_SUPPLIERS_MANAGE,
    PERMISSIONS.INVENTORY_SUPPLIER_CONTRACTS_MANAGE,
    PERMISSIONS.INVENTORY_ASSET_CHECKOUT,
    PERMISSIONS.INVENTORY_ASSET_AUDIT_CREATE,
    PERMISSIONS.INVENTORY_ASSET_AUDIT_APPROVE,
    PERMISSIONS.INVENTORY_ASSET_INSURANCE_MANAGE,
    PERMISSIONS.INVENTORY_ANALYTICS_READ,
    PERMISSIONS.INVENTORY_REPORTS_EXPORT,
    PERMISSIONS.INVENTORY_WASTAGE_RECORD,
    PERMISSIONS.INVENTORY_EXPIRY_MANAGE,
    PERMISSIONS.DISCIPLINE_READ,
    PERMISSIONS.DISCIPLINE_APPROVE,
    PERMISSIONS.ANNOUNCEMENTS_CREATE,
    PERMISSIONS.ANNOUNCEMENTS_READ,
    PERMISSIONS.SMS_SEND,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.HOUSES_CREATE,
    PERMISSIONS.HOUSES_READ,
    PERMISSIONS.HOUSES_UPDATE,
    PERMISSIONS.REPORTS_FINANCE_READ,
    PERMISSIONS.REPORTS_ATTENDANCE_READ,
    PERMISSIONS.REPORTS_ENROLLMENT_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.LIBRARY_CREATE,
    PERMISSIONS.LIBRARY_READ,
    PERMISSIONS.LIBRARY_UPDATE,
    PERMISSIONS.LIBRARY_DELETE,
    PERMISSIONS.LIBRARY_CHECKOUT,
    PERMISSIONS.LIBRARY_RETURN,
    PERMISSIONS.TRANSPORT_CREATE,
    PERMISSIONS.TRANSPORT_READ,
    PERMISSIONS.TRANSPORT_UPDATE,
    PERMISSIONS.TRANSPORT_DELETE,
    PERMISSIONS.TRANSPORT_ASSIGN,
    PERMISSIONS.COMPLIANCE_CONSENT_READ,
    PERMISSIONS.COMPLIANCE_DATA_RIGHTS_READ,
    PERMISSIONS.ANALYTICS_READ,
    // New enhancements (admin-focused)
    PERMISSIONS.ACADEMIC_EVENTS_CREATE,
    PERMISSIONS.ACADEMIC_EVENTS_READ,
    PERMISSIONS.ACADEMIC_EVENTS_UPDATE,
    PERMISSIONS.ACADEMIC_EVENTS_DELETE,
    PERMISSIONS.COCURRICULAR_CREATE,
    PERMISSIONS.COCURRICULAR_READ,
    PERMISSIONS.COCURRICULAR_UPDATE,
    PERMISSIONS.PTC_CREATE,
    PERMISSIONS.PTC_READ,
    PERMISSIONS.REPORT_TEMPLATES_READ,
    PERMISSIONS.CONDUCT_READ,
    PERMISSIONS.AWARDS_READ,
    PERMISSIONS.HOMEWORK_READ,
  ],
  hod: [
    PERMISSIONS.ACADEMIC_YEAR_READ,
    PERMISSIONS.TERMS_READ,
    PERMISSIONS.PROGRAMMES_READ,
    PERMISSIONS.CLASSES_CREATE,
    PERMISSIONS.CLASSES_READ,
    PERMISSIONS.SUBJECTS_CREATE,
    PERMISSIONS.SUBJECTS_READ,
    PERMISSIONS.SUBJECTS_UPDATE,
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.MARKS_CREATE,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.MARKS_UPDATE,
    PERMISSIONS.MARKS_APPROVE,
    PERMISSIONS.RESULTS_READ,
    PERMISSIONS.RESULTS_COMPUTE,
    PERMISSIONS.TIMETABLE_READ,
    PERMISSIONS.ANNOUNCEMENTS_READ,
    PERMISSIONS.DISCIPLINE_CREATE,
    PERMISSIONS.DISCIPLINE_READ,
    // New enhancements
    PERMISSIONS.CONDUCT_CREATE,
    PERMISSIONS.CONDUCT_READ,
    PERMISSIONS.CONDUCT_UPDATE,
    PERMISSIONS.HOMEWORK_CREATE,
    PERMISSIONS.HOMEWORK_READ,
    PERMISSIONS.HOMEWORK_GRADE,
    PERMISSIONS.INTERVENTIONS_CREATE,
    PERMISSIONS.INTERVENTIONS_READ,
    PERMISSIONS.COCURRICULAR_READ,
    PERMISSIONS.AWARDS_READ,
  ],
  class_teacher: [
    PERMISSIONS.ACADEMIC_YEAR_READ,
    PERMISSIONS.TERMS_READ,
    PERMISSIONS.PROGRAMMES_READ,
    PERMISSIONS.CLASSES_READ,
    PERMISSIONS.SUBJECTS_READ,
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.ATTENDANCE_CREATE,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_UPDATE,
    PERMISSIONS.ATTENDANCE_EXPORT,
    PERMISSIONS.MARKS_CREATE,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.MARKS_UPDATE,
    PERMISSIONS.RESULTS_READ,
    PERMISSIONS.DISCIPLINE_CREATE,
    PERMISSIONS.DISCIPLINE_READ,
    PERMISSIONS.WELFARE_CREATE,
    PERMISSIONS.WELFARE_READ,
    PERMISSIONS.COUNSELING_CREATE,
    PERMISSIONS.COUNSELING_READ,
    PERMISSIONS.ANNOUNCEMENTS_READ,
    // New enhancements
    PERMISSIONS.CONDUCT_CREATE,
    PERMISSIONS.CONDUCT_READ,
    PERMISSIONS.CONDUCT_UPDATE,
    PERMISSIONS.HOMEWORK_CREATE,
    PERMISSIONS.HOMEWORK_READ,
    PERMISSIONS.HOMEWORK_GRADE,
    PERMISSIONS.INTERVENTIONS_CREATE,
    PERMISSIONS.INTERVENTIONS_READ,
    PERMISSIONS.COCURRICULAR_READ,
    PERMISSIONS.AWARDS_READ,
    PERMISSIONS.ACADEMIC_EVENTS_READ,
  ],
  subject_teacher: [
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
    // New enhancements
    PERMISSIONS.HOMEWORK_CREATE,
    PERMISSIONS.HOMEWORK_READ,
    PERMISSIONS.HOMEWORK_GRADE,
    PERMISSIONS.ACADEMIC_EVENTS_READ,
  ],
  admissions_officer: [
    PERMISSIONS.ACADEMIC_YEAR_READ,
    PERMISSIONS.TERMS_READ,
    PERMISSIONS.PROGRAMMES_READ,
    PERMISSIONS.ADMISSIONS_CREATE,
    PERMISSIONS.ADMISSIONS_READ,
    PERMISSIONS.ADMISSIONS_UPDATE,
    PERMISSIONS.ADMISSIONS_DELETE,
    PERMISSIONS.ADMISSIONS_APPROVE,
    PERMISSIONS.ADMISSIONS_EXPORT,
    PERMISSIONS.STUDENTS_CREATE,
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.CLASSES_READ,
    PERMISSIONS.ANNOUNCEMENTS_READ,
  ],
  housemaster: [
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.HOSTELS_CREATE,
    PERMISSIONS.HOSTELS_READ,
    PERMISSIONS.HOSTELS_UPDATE,
    PERMISSIONS.HOSTELS_DELETE,
    PERMISSIONS.BED_ALLOCATIONS_CREATE,
    PERMISSIONS.BED_ALLOCATIONS_READ,
    PERMISSIONS.BED_ALLOCATIONS_UPDATE,
    PERMISSIONS.EXEAT_CREATE,
    PERMISSIONS.EXEAT_READ,
    PERMISSIONS.EXEAT_APPROVE,
    PERMISSIONS.EXEAT_GATE_CHECK,
    PERMISSIONS.ROLL_CALL_CREATE,
    PERMISSIONS.ROLL_CALL_READ,
    PERMISSIONS.BOARDING_INCIDENTS_CREATE,
    PERMISSIONS.BOARDING_INCIDENTS_READ,
    PERMISSIONS.BOARDING_INCIDENTS_UPDATE,
    PERMISSIONS.SICK_BAY_CREATE,
    PERMISSIONS.SICK_BAY_READ,
    PERMISSIONS.SICK_BAY_UPDATE,
    PERMISSIONS.SICK_BAY_DISCHARGE,
    PERMISSIONS.BOARDING_VISITORS_CREATE,
    PERMISSIONS.BOARDING_VISITORS_READ,
    PERMISSIONS.BED_TRANSFERS_CREATE,
    PERMISSIONS.BED_TRANSFERS_READ,
    PERMISSIONS.HOSTEL_INSPECTIONS_CREATE,
    PERMISSIONS.HOSTEL_INSPECTIONS_READ,
    PERMISSIONS.MAINTENANCE_CREATE,
    PERMISSIONS.MAINTENANCE_READ,
    PERMISSIONS.MAINTENANCE_UPDATE,
    PERMISSIONS.DISCIPLINE_CREATE,
    PERMISSIONS.DISCIPLINE_READ,
    PERMISSIONS.WELFARE_CREATE,
    PERMISSIONS.WELFARE_READ,
    PERMISSIONS.HOUSES_READ,
    PERMISSIONS.ANNOUNCEMENTS_READ,
  ],
  hr_officer: [
    PERMISSIONS.STAFF_CREATE,
    PERMISSIONS.STAFF_READ,
    PERMISSIONS.STAFF_UPDATE,
    PERMISSIONS.STAFF_DELETE,
    PERMISSIONS.LEAVE_CREATE,
    PERMISSIONS.LEAVE_READ,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.PAYROLL_CREATE,
    PERMISSIONS.PAYROLL_READ,
    PERMISSIONS.PAYROLL_APPROVE,
    PERMISSIONS.STAFF_DISCIPLINE_CREATE,
    PERMISSIONS.STAFF_DISCIPLINE_READ,
    PERMISSIONS.STAFF_PERFORMANCE_CREATE,
    PERMISSIONS.STAFF_PERFORMANCE_READ,
    PERMISSIONS.ANNOUNCEMENTS_READ,
    PERMISSIONS.AUDIT_LOG_READ,
  ],
  store_keeper: [
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.STOCK_MOVEMENT_CREATE,
    PERMISSIONS.STOCK_MOVEMENT_READ,
    PERMISSIONS.PROCUREMENT_CREATE,
    PERMISSIONS.PROCUREMENT_APPROVE,
    PERMISSIONS.INVENTORY_TRANSFERS_CREATE,
    PERMISSIONS.INVENTORY_TRANSFERS_APPROVE,
    PERMISSIONS.INVENTORY_TRANSFERS_READ,
    PERMISSIONS.INVENTORY_REQUISITIONS_CREATE,
    PERMISSIONS.INVENTORY_REQUISITIONS_APPROVE,
    PERMISSIONS.INVENTORY_REQUISITIONS_ISSUE,
    PERMISSIONS.INVENTORY_REQUISITIONS_READ,
    PERMISSIONS.INVENTORY_STOCK_TAKE_CREATE,
    PERMISSIONS.INVENTORY_STOCK_TAKE_READ,
    PERMISSIONS.INVENTORY_SUPPLIERS_MANAGE,
    PERMISSIONS.INVENTORY_SUPPLIER_CONTRACTS_MANAGE,
    PERMISSIONS.INVENTORY_ASSET_CHECKOUT,
    PERMISSIONS.INVENTORY_ASSET_AUDIT_CREATE,
    PERMISSIONS.INVENTORY_ANALYTICS_READ,
    PERMISSIONS.INVENTORY_REPORTS_EXPORT,
    PERMISSIONS.INVENTORY_WASTAGE_RECORD,
    PERMISSIONS.INVENTORY_EXPIRY_MANAGE,
    PERMISSIONS.ANNOUNCEMENTS_READ,
  ],
  guidance_counsellor: [
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.COUNSELING_CREATE,
    PERMISSIONS.COUNSELING_READ,
    PERMISSIONS.COUNSELING_UPDATE,
    PERMISSIONS.WELFARE_CREATE,
    PERMISSIONS.WELFARE_READ,
    PERMISSIONS.WELFARE_UPDATE,
    PERMISSIONS.COMMENDATION_CREATE,
    PERMISSIONS.COMMENDATION_READ,
    PERMISSIONS.DISCIPLINE_CREATE,
    PERMISSIONS.DISCIPLINE_READ,
    PERMISSIONS.DISCIPLINE_UPDATE,
    PERMISSIONS.MEDICAL_READ,
    PERMISSIONS.ANNOUNCEMENTS_READ,
    // New enhancements
    PERMISSIONS.INTERVENTIONS_CREATE,
    PERMISSIONS.INTERVENTIONS_READ,
    PERMISSIONS.INTERVENTIONS_UPDATE,
  ],
  parent: [
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.RESULTS_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.ANNOUNCEMENTS_READ,
    PERMISSIONS.EXEAT_READ,
    PERMISSIONS.DOCUMENTS_READ,
    // New enhancements
    PERMISSIONS.PTC_BOOK,
    PERMISSIONS.PTC_READ,
    PERMISSIONS.HOMEWORK_READ,
    PERMISSIONS.AWARDS_READ,
    PERMISSIONS.ACADEMIC_EVENTS_READ,
  ],
  student: [
    PERMISSIONS.RESULTS_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.TIMETABLE_READ,
    PERMISSIONS.ANNOUNCEMENTS_READ,
    PERMISSIONS.EXEAT_CREATE,
    PERMISSIONS.EXEAT_READ,
    // New enhancements
    PERMISSIONS.ELECTIVE_SELECTION_CREATE,
    PERMISSIONS.HOMEWORK_READ,
    PERMISSIONS.AWARDS_READ,
    PERMISSIONS.ACADEMIC_EVENTS_READ,
  ],
};
