-- Enable Row-Level Security for multi-tenant isolation
-- All tenant-scoped tables filter by schoolId using app.current_school_id
-- This ensures data isolation even if application code has bugs

-- Tables with OPTIONAL schoolId (nullable) get a lenient policy
-- that allows rows where schoolId IS NULL (system-level entries)

-- AuditLog (optional schoolId)
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AuditLog ON "AuditLog"
  USING (
    "schoolId" IS NULL
    OR "schoolId" = current_setting('app.current_school_id', true)
  )
  WITH CHECK (
    "schoolId" IS NULL
    OR "schoolId" = current_setting('app.current_school_id', true)
  );

-- Notification (optional schoolId)
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Notification ON "Notification"
  USING (
    "schoolId" IS NULL
    OR "schoolId" = current_setting('app.current_school_id', true)
  )
  WITH CHECK (
    "schoolId" IS NULL
    OR "schoolId" = current_setting('app.current_school_id', true)
  );

ALTER TABLE "AcademicAward" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcademicAward" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AcademicAward ON "AcademicAward"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AcademicEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcademicEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AcademicEvent ON "AcademicEvent"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AcademicIntervention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcademicIntervention" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AcademicIntervention ON "AcademicIntervention"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AcademicYear" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcademicYear" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AcademicYear ON "AcademicYear"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Account ON "Account"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AccountCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountCategory" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AccountCategory ON "AccountCategory"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AdmissionApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdmissionApplication" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AdmissionApplication ON "AdmissionApplication"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AdmissionDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdmissionDocument" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AdmissionDocument ON "AdmissionDocument"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Allowance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Allowance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Allowance ON "Allowance"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AlumniProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AlumniProfile" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AlumniProfile ON "AlumniProfile"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AnalyticsSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnalyticsSnapshot" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AnalyticsSnapshot ON "AnalyticsSnapshot"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Announcement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Announcement ON "Announcement"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AnnualResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnnualResult" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AnnualResult ON "AnnualResult"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AppliedPenalty" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppliedPenalty" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AppliedPenalty ON "AppliedPenalty"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AssessmentType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssessmentType" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AssessmentType ON "AssessmentType"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AssetAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssetAudit" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AssetAudit ON "AssetAudit"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AssetCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssetCategory" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AssetCategory ON "AssetCategory"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AssignmentSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssignmentSubmission" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AssignmentSubmission ON "AssignmentSubmission"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AttendanceAlert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceAlert" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AttendanceAlert ON "AttendanceAlert"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AttendancePolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendancePolicy" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AttendancePolicy ON "AttendancePolicy"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AttendanceRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AttendanceRecord ON "AttendanceRecord"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "AttendanceRegister" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceRegister" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_AttendanceRegister ON "AttendanceRegister"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "BankReconciliation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankReconciliation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_BankReconciliation ON "BankReconciliation"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "BankStatementEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankStatementEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_BankStatementEntry ON "BankStatementEntry"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Bed" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bed" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Bed ON "Bed"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "BedAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BedAllocation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_BedAllocation ON "BedAllocation"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "BedTransfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BedTransfer" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_BedTransfer ON "BedTransfer"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "BoardingIncident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BoardingIncident" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_BoardingIncident ON "BoardingIncident"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "BoardingVisitor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BoardingVisitor" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_BoardingVisitor ON "BoardingVisitor"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Book" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Book" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Book ON "Book"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "BookIssue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BookIssue" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_BookIssue ON "BookIssue"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Budget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Budget" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Budget ON "Budget"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "BudgetLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_BudgetLine ON "BudgetLine"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Class" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Class" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Class ON "Class"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ClassArm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClassArm" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ClassArm ON "ClassArm"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "CoCurricularActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoCurricularActivity" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_CoCurricularActivity ON "CoCurricularActivity"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Commendation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Commendation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Commendation ON "Commendation"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ConsentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ConsentRecord ON "ConsentRecord"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "CounselingRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CounselingRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_CounselingRecord ON "CounselingRecord"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Course" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Course ON "Course"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "CourseEnrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseEnrollment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_CourseEnrollment ON "CourseEnrollment"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "CustomReportDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomReportDefinition" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_CustomReportDefinition ON "CustomReportDefinition"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "DataDeletionRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataDeletionRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DataDeletionRequest ON "DataDeletionRequest"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "DataExportRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataExportRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DataExportRequest ON "DataExportRequest"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "DataRetentionPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataRetentionPolicy" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DataRetentionPolicy ON "DataRetentionPolicy"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Deduction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Deduction" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Deduction ON "Deduction"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Department ON "Department"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "DigitalResource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DigitalResource" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DigitalResource ON "DigitalResource"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "DisciplinaryIncident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DisciplinaryIncident" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DisciplinaryIncident ON "DisciplinaryIncident"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Document ON "Document"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "DonorFund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DonorFund" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DonorFund ON "DonorFund"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "DonorFundAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DonorFundAllocation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_DonorFundAllocation ON "DonorFundAllocation"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Dormitory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Dormitory" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Dormitory ON "Dormitory"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Employment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Employment ON "Employment"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Enrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enrollment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Enrollment ON "Enrollment"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "EventAttendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventAttendance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_EventAttendance ON "EventAttendance"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ExamSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamSchedule" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ExamSchedule ON "ExamSchedule"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ExamSeatingArrangement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamSeatingArrangement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ExamSeatingArrangement ON "ExamSeatingArrangement"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Exeat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Exeat" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Exeat ON "Exeat"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ExeatApproval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExeatApproval" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ExeatApproval ON "ExeatApproval"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Expense ON "Expense"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ExpenseCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseCategory" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ExpenseCategory ON "ExpenseCategory"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ExpenseClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseClaim" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ExpenseClaim ON "ExpenseClaim"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ExpenseClaimItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseClaimItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ExpenseClaimItem ON "ExpenseClaimItem"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "FeeItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_FeeItem ON "FeeItem"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "FeeStructure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeStructure" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_FeeStructure ON "FeeStructure"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "FeeTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeTemplate" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_FeeTemplate ON "FeeTemplate"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "FeeTemplateItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeTemplateItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_FeeTemplateItem ON "FeeTemplateItem"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "FeeWaiver" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeWaiver" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_FeeWaiver ON "FeeWaiver"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "FinancialAidApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinancialAidApplication" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_FinancialAidApplication ON "FinancialAidApplication"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "FinancialReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinancialReport" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_FinancialReport ON "FinancialReport"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "FixedAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FixedAsset" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_FixedAsset ON "FixedAsset"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "GovernmentSubsidy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernmentSubsidy" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_GovernmentSubsidy ON "GovernmentSubsidy"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "GradeDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GradeDefinition" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_GradeDefinition ON "GradeDefinition"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "GradingScale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GradingScale" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_GradingScale ON "GradingScale"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "GraduationBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GraduationBatch" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_GraduationBatch ON "GraduationBatch"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "GraduationRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GraduationRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_GraduationRecord ON "GraduationRecord"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Guardian" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Guardian" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Guardian ON "Guardian"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Homework" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Homework" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Homework ON "Homework"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "HomeworkSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HomeworkSubmission" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_HomeworkSubmission ON "HomeworkSubmission"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Hostel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Hostel" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Hostel ON "Hostel"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "HostelInspection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HostelInspection" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_HostelInspection ON "HostelInspection"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "House" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "House" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_House ON "House"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "InstallmentPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstallmentPlan" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_InstallmentPlan ON "InstallmentPlan"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "InstallmentSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstallmentSchedule" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_InstallmentSchedule ON "InstallmentSchedule"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ItemCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemCategory" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ItemCategory ON "ItemCategory"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "JournalEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_JournalEntry ON "JournalEntry"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "JournalTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalTransaction" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_JournalTransaction ON "JournalTransaction"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "LatePenaltyRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LatePenaltyRule" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_LatePenaltyRule ON "LatePenaltyRule"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "LeaveBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveBalance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_LeaveBalance ON "LeaveBalance"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "LeaveRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_LeaveRequest ON "LeaveRequest"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "LeaveType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveType" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_LeaveType ON "LeaveType"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Lesson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lesson" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Lesson ON "Lesson"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "LessonProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonProgress" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_LessonProgress ON "LessonProgress"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "LmsAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LmsAssignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_LmsAssignment ON "LmsAssignment"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "LoanRepayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoanRepayment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_LoanRepayment ON "LoanRepayment"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "MaintenanceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaintenanceRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_MaintenanceRequest ON "MaintenanceRequest"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Mark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Mark" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Mark ON "Mark"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "MarkAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarkAuditLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_MarkAuditLog ON "MarkAuditLog"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "MarkStandardLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarkStandardLink" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_MarkStandardLink ON "MarkStandardLink"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "MedicalRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MedicalRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_MedicalRecord ON "MedicalRecord"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "MedicationLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MedicationLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_MedicationLog ON "MedicationLog"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "OnlinePaymentTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnlinePaymentTransaction" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_OnlinePaymentTransaction ON "OnlinePaymentTransaction"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "PTCBooking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PTCBooking" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_PTCBooking ON "PTCBooking"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "PTCSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PTCSession" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_PTCSession ON "PTCSession"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Payment ON "Payment"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "PaymentLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentLink" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_PaymentLink ON "PaymentLink"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "PaymentReversal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentReversal" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_PaymentReversal ON "PaymentReversal"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "PayrollEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_PayrollEntry ON "PayrollEntry"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "PayrollPeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollPeriod" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_PayrollPeriod ON "PayrollPeriod"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "PerformanceNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceNote" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_PerformanceNote ON "PerformanceNote"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Period" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Period" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Period ON "Period"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "PettyCashFund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PettyCashFund" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_PettyCashFund ON "PettyCashFund"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "PettyCashReplenishment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PettyCashReplenishment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_PettyCashReplenishment ON "PettyCashReplenishment"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "PettyCashTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PettyCashTransaction" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_PettyCashTransaction ON "PettyCashTransaction"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "PrivacyPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PrivacyPolicy" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_PrivacyPolicy ON "PrivacyPolicy"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Programme" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Programme" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Programme ON "Programme"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "ProgrammeSubject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProgrammeSubject" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ProgrammeSubject ON "ProgrammeSubject"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "PromotionRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromotionRule" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_PromotionRule ON "PromotionRule"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "PublicHoliday" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PublicHoliday" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_PublicHoliday ON "PublicHoliday"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "QuizQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuizQuestion" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_QuizQuestion ON "QuizQuestion"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Receipt" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Receipt ON "Receipt"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Requisition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Requisition" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Requisition ON "Requisition"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "RollCall" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RollCall" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_RollCall ON "RollCall"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "RollCallRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RollCallRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_RollCallRecord ON "RollCallRecord"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Room" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Room ON "Room"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Route" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Route" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Route ON "Route"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "RouteStop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RouteStop" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_RouteStop ON "RouteStop"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Scholarship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Scholarship" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Scholarship ON "Scholarship"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "SchoolCurriculum" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolCurriculum" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_SchoolCurriculum ON "SchoolCurriculum"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "SickBayAdmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SickBayAdmission" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_SickBayAdmission ON "SickBayAdmission"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "SmsLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SmsLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_SmsLog ON "SmsLog"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Staff" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Staff ON "Staff"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StaffAttendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffAttendance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StaffAttendance ON "StaffAttendance"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StaffContract" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffContract" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StaffContract ON "StaffContract"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StaffDisciplinary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffDisciplinary" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StaffDisciplinary ON "StaffDisciplinary"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StaffLoan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffLoan" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StaffLoan ON "StaffLoan"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StaffPromotion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffPromotion" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StaffPromotion ON "StaffPromotion"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StockTake" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockTake" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StockTake ON "StockTake"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Store" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Store ON "Store"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StoreTransfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoreTransfer" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StoreTransfer ON "StoreTransfer"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Student" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Student ON "Student"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StudentActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentActivity" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StudentActivity ON "StudentActivity"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StudentBill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentBill" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StudentBill ON "StudentBill"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StudentBillItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentBillItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StudentBillItem ON "StudentBillItem"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StudentConduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentConduct" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StudentConduct ON "StudentConduct"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StudentGuardian" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentGuardian" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StudentGuardian ON "StudentGuardian"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StudentHouse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentHouse" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StudentHouse ON "StudentHouse"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StudentInstallment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentInstallment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StudentInstallment ON "StudentInstallment"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StudentRiskProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentRiskProfile" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StudentRiskProfile ON "StudentRiskProfile"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StudentScholarship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentScholarship" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StudentScholarship ON "StudentScholarship"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StudentStandardMastery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentStandardMastery" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StudentStandardMastery ON "StudentStandardMastery"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StudentSubjectSelection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentSubjectSelection" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StudentSubjectSelection ON "StudentSubjectSelection"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "StudentTransport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentTransport" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_StudentTransport ON "StudentTransport"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Subject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subject" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Subject ON "Subject"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "SubjectAnnualResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubjectAnnualResult" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_SubjectAnnualResult ON "SubjectAnnualResult"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "SubjectResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubjectResult" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_SubjectResult ON "SubjectResult"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "SubsidyDisbursement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubsidyDisbursement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_SubsidyDisbursement ON "SubsidyDisbursement"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Supplier ON "Supplier"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "TaxRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_TaxRecord ON "TaxRecord"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "TeacherAvailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeacherAvailability" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_TeacherAvailability ON "TeacherAvailability"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "TeacherPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeacherPreference" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_TeacherPreference ON "TeacherPreference"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "TeacherSubjectAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeacherSubjectAssignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_TeacherSubjectAssignment ON "TeacherSubjectAssignment"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Term" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Term" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Term ON "Term"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "TerminalResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TerminalResult" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_TerminalResult ON "TerminalResult"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "TimetableSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimetableSlot" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_TimetableSlot ON "TimetableSlot"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "TimetableSubstitution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimetableSubstitution" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_TimetableSubstitution ON "TimetableSubstitution"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "TimetableVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimetableVersion" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_TimetableVersion ON "TimetableVersion"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Transcript" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transcript" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Transcript ON "Transcript"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "Vehicle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vehicle" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_Vehicle ON "Vehicle"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

ALTER TABLE "WelfareNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WelfareNote" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_WelfareNote ON "WelfareNote"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));

