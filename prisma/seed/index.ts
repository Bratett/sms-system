import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Permission definitions (mirroring src/lib/permissions.ts) ───────────────

const PERMISSIONS: Record<string, string> = {
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

  // Boarding extras
  ROLL_CALL_CREATE: "boarding:rollcall:create",
  ROLL_CALL_READ: "boarding:rollcall:read",

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
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// ─── Default role-permission mappings ────────────────────────────────────────

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
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
    PERMISSIONS.ATTENDANCE_POLICY_CREATE,
    PERMISSIONS.ATTENDANCE_POLICY_READ,
    PERMISSIONS.ATTENDANCE_POLICY_UPDATE,
    PERMISSIONS.ATTENDANCE_POLICY_DELETE,
    PERMISSIONS.ATTENDANCE_ALERTS_READ,
    PERMISSIONS.ATTENDANCE_ALERTS_MANAGE,
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
    PERMISSIONS.SUBSTITUTION_CREATE,
    PERMISSIONS.SUBSTITUTION_READ,
    PERMISSIONS.SUBSTITUTION_APPROVE,
    PERMISSIONS.SUBSTITUTION_DELETE,
    PERMISSIONS.TEACHER_AVAILABILITY_CREATE,
    PERMISSIONS.TEACHER_AVAILABILITY_READ,
    PERMISSIONS.TEACHER_AVAILABILITY_UPDATE,
    PERMISSIONS.TEACHER_AVAILABILITY_DELETE,
    PERMISSIONS.TIMETABLE_VERSION_CREATE,
    PERMISSIONS.TIMETABLE_VERSION_READ,
    PERMISSIONS.TIMETABLE_VERSION_PUBLISH,
    PERMISSIONS.TIMETABLE_VERSION_RESTORE,
    PERMISSIONS.BULK_OPERATIONS,
    PERMISSIONS.COCURRICULAR_READ,
    PERMISSIONS.AWARDS_READ,
    PERMISSIONS.AWARDS_CREATE,
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
    PERMISSIONS.SUBSTITUTION_CREATE,
    PERMISSIONS.SUBSTITUTION_READ,
    PERMISSIONS.SUBSTITUTION_APPROVE,
    PERMISSIONS.TEACHER_AVAILABILITY_CREATE,
    PERMISSIONS.TEACHER_AVAILABILITY_READ,
    PERMISSIONS.TEACHER_AVAILABILITY_UPDATE,
    PERMISSIONS.TIMETABLE_VERSION_CREATE,
    PERMISSIONS.TIMETABLE_VERSION_READ,
    PERMISSIONS.TIMETABLE_VERSION_PUBLISH,
    PERMISSIONS.TIMETABLE_VERSION_RESTORE,
    PERMISSIONS.ATTENDANCE_POLICY_CREATE,
    PERMISSIONS.ATTENDANCE_POLICY_READ,
    PERMISSIONS.ATTENDANCE_POLICY_UPDATE,
    PERMISSIONS.ATTENDANCE_ALERTS_READ,
    PERMISSIONS.ATTENDANCE_ALERTS_MANAGE,
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
    PERMISSIONS.HOSTELS_CREATE,
    PERMISSIONS.HOSTELS_READ,
    PERMISSIONS.HOSTELS_UPDATE,
    PERMISSIONS.HOSTELS_DELETE,
    PERMISSIONS.BED_ALLOCATIONS_CREATE,
    PERMISSIONS.BED_ALLOCATIONS_READ,
    PERMISSIONS.BED_ALLOCATIONS_UPDATE,
    PERMISSIONS.EXEAT_READ,
    PERMISSIONS.EXEAT_APPROVE,
    PERMISSIONS.ROLL_CALL_READ,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.STOCK_MOVEMENT_CREATE,
    PERMISSIONS.STOCK_MOVEMENT_READ,
    PERMISSIONS.PROCUREMENT_CREATE,
    PERMISSIONS.PROCUREMENT_APPROVE,
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
    PERMISSIONS.SUBSTITUTION_READ,
    PERMISSIONS.TEACHER_AVAILABILITY_READ,
    PERMISSIONS.TIMETABLE_VERSION_READ,
    PERMISSIONS.ATTENDANCE_ALERTS_READ,
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
    PERMISSIONS.HOMEWORK_CREATE,
    PERMISSIONS.HOMEWORK_READ,
    PERMISSIONS.HOMEWORK_GRADE,
    PERMISSIONS.ACADEMIC_EVENTS_READ,
    PERMISSIONS.SUBSTITUTION_READ,
    PERMISSIONS.TEACHER_AVAILABILITY_READ,
    PERMISSIONS.TIMETABLE_VERSION_READ,
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
    PERMISSIONS.ROLL_CALL_CREATE,
    PERMISSIONS.ROLL_CALL_READ,
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
    PERMISSIONS.ELECTIVE_SELECTION_CREATE,
    PERMISSIONS.HOMEWORK_READ,
    PERMISSIONS.AWARDS_READ,
    PERMISSIONS.ACADEMIC_EVENTS_READ,
  ],
};

// ─── Role definitions ────────────────────────────────────────────────────────

interface RoleDef {
  name: string;
  displayName: string;
  description: string;
}

const ROLES: RoleDef[] = [
  {
    name: "super_admin",
    displayName: "Super Admin",
    description: "Full system access with all permissions",
  },
  {
    name: "headmaster",
    displayName: "Headmaster",
    description: "School head with broad administrative and academic oversight",
  },
  {
    name: "assistant_headmaster_academic",
    displayName: "Assistant Headmaster (Academic)",
    description: "Oversees academic programmes, curriculum, and examinations",
  },
  {
    name: "assistant_headmaster_admin",
    displayName: "Assistant Headmaster (Admin)",
    description: "Oversees administrative operations and staff management",
  },
  {
    name: "hod",
    displayName: "Head of Department",
    description: "Manages a specific academic department and its staff",
  },
  {
    name: "class_teacher",
    displayName: "Class Teacher",
    description: "Responsible for a specific class including attendance and pastoral care",
  },
  {
    name: "subject_teacher",
    displayName: "Subject Teacher",
    description: "Teaches specific subjects and manages marks and attendance",
  },
  {
    name: "finance_officer",
    displayName: "Finance Officer",
    description: "Manages fees, billing, payments, and financial reports",
  },
  {
    name: "admissions_officer",
    displayName: "Admissions Officer",
    description: "Processes student admissions and placement",
  },
  {
    name: "housemaster",
    displayName: "Housemaster",
    description: "Manages boarding house operations and student welfare",
  },
  {
    name: "hr_officer",
    displayName: "HR Officer",
    description: "Manages staff records, leave, and payroll",
  },
  {
    name: "store_keeper",
    displayName: "Store Keeper",
    description: "Manages inventory, stock movements, and procurement",
  },
  {
    name: "guidance_counsellor",
    displayName: "Guidance Counsellor",
    description: "Handles student discipline, counselling, and welfare",
  },
  {
    name: "parent",
    displayName: "Parent / Guardian",
    description: "Views ward information, results, fees, and communication",
  },
  {
    name: "student",
    displayName: "Student",
    description: "Views own academic results, timetable, and announcements",
  },
];

// ─── Grade definitions for Ghana SHS ─────────────────────────────────────────

const GRADE_DEFINITIONS = [
  { grade: "A1", minScore: 80, maxScore: 100, interpretation: "Excellent", gradePoint: 1 },
  { grade: "B2", minScore: 75, maxScore: 79, interpretation: "Very Good", gradePoint: 2 },
  { grade: "B3", minScore: 70, maxScore: 74, interpretation: "Good", gradePoint: 3 },
  { grade: "C4", minScore: 65, maxScore: 69, interpretation: "Credit", gradePoint: 4 },
  { grade: "C5", minScore: 60, maxScore: 64, interpretation: "Credit", gradePoint: 5 },
  { grade: "C6", minScore: 55, maxScore: 59, interpretation: "Credit", gradePoint: 6 },
  { grade: "D7", minScore: 50, maxScore: 54, interpretation: "Pass", gradePoint: 7 },
  { grade: "E8", minScore: 45, maxScore: 49, interpretation: "Pass", gradePoint: 8 },
  { grade: "F9", minScore: 0, maxScore: 44, interpretation: "Fail", gradePoint: 9 },
];

// ─── Main seed function ──────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Starting seed...\n");

  // ── 1. Create permissions ──────────────────────────────────────────────────
  console.log("Creating permissions...");
  const permissionRecords: Record<string, { id: string }> = {};

  for (const [key, code] of Object.entries(PERMISSIONS)) {
    const parts = code.split(":");
    const module = parts.slice(0, -1).join(":");
    const action = parts[parts.length - 1];

    const permission = await prisma.permission.upsert({
      where: { code },
      update: { module, action, description: key },
      create: { code, module, action, description: key },
    });

    permissionRecords[code] = permission;
  }
  console.log(`  ✓ ${Object.keys(permissionRecords).length} permissions created\n`);

  // ── 2. Create roles ────────────────────────────────────────────────────────
  console.log("Creating roles...");
  const roleRecords: Record<string, { id: string }> = {};

  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {
        displayName: roleDef.displayName,
        description: roleDef.description,
        isSystem: true,
      },
      create: {
        name: roleDef.name,
        displayName: roleDef.displayName,
        description: roleDef.description,
        isSystem: true,
      },
    });

    roleRecords[roleDef.name] = role;
  }
  console.log(`  ✓ ${ROLES.length} roles created\n`);

  // ── 3. Assign permissions to roles ─────────────────────────────────────────
  console.log("Assigning permissions to roles...");

  for (const [roleName, permissionCodes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = roleRecords[roleName];
    if (!role) {
      console.log(`  ⚠ Role "${roleName}" not found, skipping permission assignment`);
      continue;
    }

    let assignedCount = 0;
    for (const code of permissionCodes) {
      const permission = permissionRecords[code];
      if (!permission) {
        console.log(`  ⚠ Permission "${code}" not found, skipping`);
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
      assignedCount++;
    }
    console.log(`  ✓ ${roleName}: ${assignedCount} permissions assigned`);
  }
  console.log();

  // ── 4. Create Super Admin user ─────────────────────────────────────────────
  console.log("Creating Super Admin user...");
  const passwordHash = await bcrypt.hash("Admin@123", 12);

  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      email: "admin@school.edu.gh",
      firstName: "Super",
      lastName: "Admin",
      passwordHash,
      status: "ACTIVE",
    },
    create: {
      username: "admin",
      email: "admin@school.edu.gh",
      firstName: "Super",
      lastName: "Admin",
      passwordHash,
      status: "ACTIVE",
    },
  });

  // Assign super_admin role to admin user
  const superAdminRole = roleRecords["super_admin"];
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  });
  console.log(`  ✓ Admin user created (username: admin, email: admin@school.edu.gh)\n`);

  // ── 5. Create default school ───────────────────────────────────────────────
  console.log("Creating default school...");

  const school = await prisma.school.upsert({
    where: { id: "default-school" },
    update: {
      name: "Ghana SHS Demo",
      type: "DAY_BOARDING",
      category: "PUBLIC",
      region: "Greater Accra",
    },
    create: {
      id: "default-school",
      name: "Ghana SHS Demo",
      type: "DAY_BOARDING",
      category: "PUBLIC",
      region: "Greater Accra",
    },
  });
  console.log(`  ✓ School "${school.name}" created (id: ${school.id})\n`);

  // ── 5b. Link admin user to the default school ─────────────────────────────
  // Without a UserSchool row the session's `schoolId` is null and every
  // action that calls `requireSchoolContext()` returns "No school context".
  // The dashboard, all finance pages, attendance, etc. all depend on this.
  await prisma.userSchool.upsert({
    where: {
      userId_schoolId: { userId: adminUser.id, schoolId: school.id },
    },
    update: { isDefault: true },
    create: {
      userId: adminUser.id,
      schoolId: school.id,
      isDefault: true,
    },
  });
  console.log(`  ✓ Admin user linked to "${school.name}" as default\n`);

  // ── 6. Create default grading scale ────────────────────────────────────────
  console.log("Creating Ghana SHS grading scale...");

  const gradingScale = await prisma.gradingScale.upsert({
    where: { id: "default-grading-scale" },
    update: {
      name: "Ghana SHS Grading Scale",
      isDefault: true,
      schoolId: school.id,
    },
    create: {
      id: "default-grading-scale",
      name: "Ghana SHS Grading Scale",
      isDefault: true,
      schoolId: school.id,
    },
  });

  // Remove existing grade definitions for this scale and recreate
  await prisma.gradeDefinition.deleteMany({
    where: { gradingScaleId: gradingScale.id },
  });

  for (const gd of GRADE_DEFINITIONS) {
    await prisma.gradeDefinition.create({
      data: {
        schoolId: school.id,
        gradingScaleId: gradingScale.id,
        grade: gd.grade,
        minScore: gd.minScore,
        maxScore: gd.maxScore,
        interpretation: gd.interpretation,
        gradePoint: gd.gradePoint,
      },
    });
  }
  console.log(`  ✓ Grading scale with ${GRADE_DEFINITIONS.length} grades created\n`);

  // ── 7. Seed global React-PDF DocumentTemplates ───────────────────────────
  // These are `schoolId: null` rows — every tenant sees them via the lenient
  // RLS policy on DocumentTemplate. Component keys match the registrations in
  // src/lib/documents/react-pdf-registry.ts. Rerun-safe: upserts the template
  // and only creates v1 the first time.
  console.log("Seeding global document templates...");
  const GLOBAL_TEMPLATES = [
    {
      key: "payslip",
      name: "Staff Payslip",
      description: "Monthly staff payslip (gross, allowances, deductions, net pay).",
      componentKey: "payslip",
    },
    {
      key: "report-card",
      name: "Student Report Card",
      description: "End-of-term student report card with subject breakdown.",
      componentKey: "report-card",
    },
    {
      key: "broadsheet",
      name: "Class Broadsheet",
      description: "Class-level performance broadsheet across all subjects.",
      componentKey: "broadsheet",
    },
    {
      key: "receipt",
      name: "Payment Receipt",
      description: "Fee payment receipt printable for the payer.",
      componentKey: "receipt",
    },
  ];

  let seededTemplates = 0;
  for (const t of GLOBAL_TEMPLATES) {
    // Postgres treats NULL as non-equal in unique constraints, so the
    // composite `(schoolId, key)` unique doesn't help us guarantee
    // idempotency when schoolId is null. Use findFirst + explicit branch.
    const existing = await prisma.documentTemplate.findFirst({
      where: { schoolId: null, key: t.key },
    });
    await prisma.$transaction(async (tx) => {
      const tpl =
        existing ??
        (await tx.documentTemplate.create({
          data: {
            schoolId: null,
            key: t.key,
            name: t.name,
            description: t.description,
            engine: "REACT_PDF",
            componentKey: t.componentKey,
            status: "PUBLISHED",
            createdBy: "seed",
          },
        }));
      if (!tpl.activeVersionId) {
        const version = await tx.documentTemplateVersion.create({
          data: {
            templateId: tpl.id,
            version: 1,
            componentKey: t.componentKey,
            createdBy: "seed",
          },
        });
        await tx.documentTemplate.update({
          where: { id: tpl.id },
          data: { activeVersionId: version.id },
        });
      }
    });
    seededTemplates++;
  }
  console.log(`  ✓ ${seededTemplates} global React-PDF templates registered\n`);

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log("✅ Seed completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
