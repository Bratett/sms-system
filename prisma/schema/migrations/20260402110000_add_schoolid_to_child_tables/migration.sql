-- Migration: Add schoolId to child tables for Row-Level Security
-- Strategy: Add nullable → backfill from parent → set NOT NULL

-- ============================================================
-- STEP 1: Add nullable schoolId columns
-- ============================================================

-- School core
ALTER TABLE "Term" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "GradeDefinition" ADD COLUMN "schoolId" TEXT;

-- Academic
ALTER TABLE "ClassArm" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Enrollment" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Mark" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "TerminalResult" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "SubjectResult" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "AnnualResult" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "SubjectAnnualResult" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "ProgrammeSubject" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "TeacherSubjectAssignment" ADD COLUMN "schoolId" TEXT;

-- Academic enhancements
ALTER TABLE "StudentSubjectSelection" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "StudentConduct" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "MarkAuditLog" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "StudentActivity" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "ExamSeatingArrangement" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "MarkStandardLink" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "StudentStandardMastery" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "PTCBooking" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "HomeworkSubmission" ADD COLUMN "schoolId" TEXT;

-- Student
ALTER TABLE "Guardian" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "StudentGuardian" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "StudentHouse" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "AdmissionDocument" ADD COLUMN "schoolId" TEXT;

-- Finance
ALTER TABLE "FeeItem" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "StudentBill" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "StudentBillItem" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Receipt" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "StudentScholarship" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "PaymentReversal" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "FeeTemplateItem" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "InstallmentSchedule" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "StudentInstallment" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "AppliedPenalty" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "SubsidyDisbursement" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "DonorFundAllocation" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "BankStatementEntry" ADD COLUMN "schoolId" TEXT;

-- Accounting
ALTER TABLE "JournalEntry" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "PettyCashTransaction" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "PettyCashReplenishment" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "BudgetLine" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "ExpenseClaimItem" ADD COLUMN "schoolId" TEXT;

-- HR
ALTER TABLE "Employment" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "LeaveBalance" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "PayrollEntry" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "LoanRepayment" ADD COLUMN "schoolId" TEXT;

-- Boarding
ALTER TABLE "Dormitory" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Bed" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "BedAllocation" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Exeat" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "ExeatApproval" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "RollCall" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "RollCallRecord" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "MedicationLog" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;

-- Attendance
ALTER TABLE "AttendanceRecord" ADD COLUMN "schoolId" TEXT;

-- Communication
ALTER TABLE "GraduationRecord" ADD COLUMN "schoolId" TEXT;

-- LMS
ALTER TABLE "Lesson" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "LmsAssignment" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "AssignmentSubmission" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "LessonProgress" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "CourseEnrollment" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "QuizQuestion" ADD COLUMN "schoolId" TEXT;

-- Library
ALTER TABLE "BookIssue" ADD COLUMN "schoolId" TEXT;

-- Transport
ALTER TABLE "RouteStop" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "StudentTransport" ADD COLUMN "schoolId" TEXT;

-- Audit (nullable — system-level entries may have no school)
ALTER TABLE "AuditLog" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "schoolId" TEXT;

-- Inventory (tables that existed but may need schoolId)
ALTER TABLE "Requisition" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "StockTake" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "StoreTransfer" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "AssetAudit" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "AttendanceRegister" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "BoardingIncident" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "BoardingVisitor" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "BedTransfer" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "HostelInspection" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "SickBayAdmission" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "UserRole" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;

-- ============================================================
-- STEP 2: Backfill schoolId from parent tables
-- ============================================================

-- School core
UPDATE "Term" t SET "schoolId" = ay."schoolId" FROM "AcademicYear" ay WHERE t."academicYearId" = ay.id AND t."schoolId" IS NULL;
UPDATE "GradeDefinition" gd SET "schoolId" = gs."schoolId" FROM "GradingScale" gs WHERE gd."gradingScaleId" = gs.id AND gd."schoolId" IS NULL;

-- Academic
UPDATE "ClassArm" ca SET "schoolId" = c."schoolId" FROM "Class" c WHERE ca."classId" = c.id AND ca."schoolId" IS NULL;
UPDATE "Enrollment" e SET "schoolId" = ca."schoolId" FROM "ClassArm" ca WHERE e."classArmId" = ca.id AND e."schoolId" IS NULL;
UPDATE "Mark" m SET "schoolId" = s."schoolId" FROM "Subject" s WHERE m."subjectId" = s.id AND m."schoolId" IS NULL;
UPDATE "TerminalResult" tr SET "schoolId" = (SELECT s."schoolId" FROM "Student" s WHERE s.id = tr."studentId" LIMIT 1) WHERE tr."schoolId" IS NULL;
UPDATE "SubjectResult" sr SET "schoolId" = tr."schoolId" FROM "TerminalResult" tr WHERE sr."terminalResultId" = tr.id AND sr."schoolId" IS NULL;
UPDATE "AnnualResult" ar SET "schoolId" = (SELECT s."schoolId" FROM "Student" s WHERE s.id = ar."studentId" LIMIT 1) WHERE ar."schoolId" IS NULL;
UPDATE "SubjectAnnualResult" sar SET "schoolId" = ar."schoolId" FROM "AnnualResult" ar WHERE sar."annualResultId" = ar.id AND sar."schoolId" IS NULL;
UPDATE "ProgrammeSubject" ps SET "schoolId" = s."schoolId" FROM "Subject" s WHERE ps."subjectId" = s.id AND ps."schoolId" IS NULL;
UPDATE "TeacherSubjectAssignment" tsa SET "schoolId" = s."schoolId" FROM "Subject" s WHERE tsa."subjectId" = s.id AND tsa."schoolId" IS NULL;

-- Academic enhancements
UPDATE "StudentSubjectSelection" sss SET "schoolId" = s."schoolId" FROM "Subject" s WHERE sss."subjectId" = s.id AND sss."schoolId" IS NULL;
UPDATE "StudentConduct" sc SET "schoolId" = st."schoolId" FROM "Student" st WHERE sc."studentId" = st.id AND sc."schoolId" IS NULL;
UPDATE "MarkAuditLog" mal SET "schoolId" = m."schoolId" FROM "Mark" m WHERE mal."markId" = m.id AND mal."schoolId" IS NULL;
UPDATE "StudentActivity" sa SET "schoolId" = a."schoolId" FROM "CoCurricularActivity" a WHERE sa."activityId" = a.id AND sa."schoolId" IS NULL;
UPDATE "ExamSeatingArrangement" esa SET "schoolId" = es."schoolId" FROM "ExamSchedule" es WHERE esa."examScheduleId" = es.id AND esa."schoolId" IS NULL;
UPDATE "PTCBooking" pb SET "schoolId" = ps."schoolId" FROM "PTCSession" ps WHERE pb."sessionId" = ps.id AND pb."schoolId" IS NULL;
UPDATE "HomeworkSubmission" hs SET "schoolId" = h."schoolId" FROM "Homework" h WHERE hs."homeworkId" = h.id AND hs."schoolId" IS NULL;

-- Student
UPDATE "Guardian" g SET "schoolId" = (SELECT st."schoolId" FROM "StudentGuardian" sg JOIN "Student" st ON sg."studentId" = st.id WHERE sg."guardianId" = g.id LIMIT 1) WHERE g."schoolId" IS NULL;
UPDATE "StudentGuardian" sg SET "schoolId" = st."schoolId" FROM "Student" st WHERE sg."studentId" = st.id AND sg."schoolId" IS NULL;
UPDATE "StudentHouse" sh SET "schoolId" = st."schoolId" FROM "Student" st WHERE sh."studentId" = st.id AND sh."schoolId" IS NULL;
UPDATE "AdmissionDocument" ad SET "schoolId" = aa."schoolId" FROM "AdmissionApplication" aa WHERE ad."applicationId" = aa.id AND ad."schoolId" IS NULL;

-- Finance
UPDATE "FeeItem" fi SET "schoolId" = fs."schoolId" FROM "FeeStructure" fs WHERE fi."feeStructureId" = fs.id AND fi."schoolId" IS NULL;
UPDATE "StudentBill" sb SET "schoolId" = fs."schoolId" FROM "FeeStructure" fs WHERE sb."feeStructureId" = fs.id AND sb."schoolId" IS NULL;
UPDATE "StudentBillItem" sbi SET "schoolId" = sb."schoolId" FROM "StudentBill" sb WHERE sbi."studentBillId" = sb.id AND sbi."schoolId" IS NULL;
UPDATE "Payment" p SET "schoolId" = sb."schoolId" FROM "StudentBill" sb WHERE p."studentBillId" = sb.id AND p."schoolId" IS NULL;
UPDATE "Receipt" r SET "schoolId" = p."schoolId" FROM "Payment" p WHERE r."paymentId" = p.id AND r."schoolId" IS NULL;
UPDATE "StudentScholarship" ss SET "schoolId" = sc."schoolId" FROM "Scholarship" sc WHERE ss."scholarshipId" = sc.id AND ss."schoolId" IS NULL;
UPDATE "PaymentReversal" pr SET "schoolId" = p."schoolId" FROM "Payment" p WHERE pr."paymentId" = p.id AND pr."schoolId" IS NULL;
UPDATE "FeeTemplateItem" fti SET "schoolId" = ft."schoolId" FROM "FeeTemplate" ft WHERE fti."feeTemplateId" = ft.id AND fti."schoolId" IS NULL;
UPDATE "InstallmentSchedule" isch SET "schoolId" = ip."schoolId" FROM "InstallmentPlan" ip WHERE isch."installmentPlanId" = ip.id AND isch."schoolId" IS NULL;
UPDATE "StudentInstallment" si SET "schoolId" = sb."schoolId" FROM "StudentBill" sb WHERE si."studentBillId" = sb.id AND si."schoolId" IS NULL;
UPDATE "AppliedPenalty" ap SET "schoolId" = sb."schoolId" FROM "StudentBill" sb WHERE ap."studentBillId" = sb.id AND ap."schoolId" IS NULL;
UPDATE "SubsidyDisbursement" sd SET "schoolId" = gs."schoolId" FROM "GovernmentSubsidy" gs WHERE sd."governmentSubsidyId" = gs.id AND sd."schoolId" IS NULL;
UPDATE "DonorFundAllocation" dfa SET "schoolId" = df."schoolId" FROM "DonorFund" df WHERE dfa."donorFundId" = df.id AND dfa."schoolId" IS NULL;
UPDATE "BankStatementEntry" bse SET "schoolId" = br."schoolId" FROM "BankReconciliation" br WHERE bse."bankReconciliationId" = br.id AND bse."schoolId" IS NULL;

-- Accounting
UPDATE "JournalEntry" je SET "schoolId" = jt."schoolId" FROM "JournalTransaction" jt WHERE je."journalTransactionId" = jt.id AND je."schoolId" IS NULL;
UPDATE "PettyCashTransaction" pct SET "schoolId" = pcf."schoolId" FROM "PettyCashFund" pcf WHERE pct."pettyCashFundId" = pcf.id AND pct."schoolId" IS NULL;
UPDATE "PettyCashReplenishment" pcr SET "schoolId" = pcf."schoolId" FROM "PettyCashFund" pcf WHERE pcr."pettyCashFundId" = pcf.id AND pcr."schoolId" IS NULL;
UPDATE "BudgetLine" bl SET "schoolId" = b."schoolId" FROM "Budget" b WHERE bl."budgetId" = b.id AND bl."schoolId" IS NULL;
UPDATE "ExpenseClaimItem" eci SET "schoolId" = ec."schoolId" FROM "ExpenseClaim" ec WHERE eci."expenseClaimId" = ec.id AND eci."schoolId" IS NULL;

-- HR
UPDATE "Employment" emp SET "schoolId" = st."schoolId" FROM "Staff" st WHERE emp."staffId" = st.id AND emp."schoolId" IS NULL;
UPDATE "LeaveBalance" lb SET "schoolId" = st."schoolId" FROM "Staff" st WHERE lb."staffId" = st.id AND lb."schoolId" IS NULL;
UPDATE "LeaveRequest" lr SET "schoolId" = st."schoolId" FROM "Staff" st WHERE lr."staffId" = st.id AND lr."schoolId" IS NULL;
UPDATE "PayrollEntry" pe SET "schoolId" = pp."schoolId" FROM "PayrollPeriod" pp WHERE pe."payrollPeriodId" = pp.id AND pe."schoolId" IS NULL;
UPDATE "LoanRepayment" lrp SET "schoolId" = sl."schoolId" FROM "StaffLoan" sl WHERE lrp."loanId" = sl.id AND lrp."schoolId" IS NULL;

-- Boarding
UPDATE "Dormitory" d SET "schoolId" = h."schoolId" FROM "Hostel" h WHERE d."hostelId" = h.id AND d."schoolId" IS NULL;
UPDATE "Bed" b SET "schoolId" = d."schoolId" FROM "Dormitory" d WHERE b."dormitoryId" = d.id AND b."schoolId" IS NULL;
UPDATE "BedAllocation" ba SET "schoolId" = b."schoolId" FROM "Bed" b WHERE ba."bedId" = b.id AND ba."schoolId" IS NULL;
UPDATE "Exeat" ex SET "schoolId" = st."schoolId" FROM "Student" st WHERE ex."studentId" = st.id AND ex."schoolId" IS NULL;
UPDATE "ExeatApproval" ea SET "schoolId" = ex."schoolId" FROM "Exeat" ex WHERE ea."exeatId" = ex.id AND ea."schoolId" IS NULL;
UPDATE "RollCall" rc SET "schoolId" = h."schoolId" FROM "Hostel" h WHERE rc."hostelId" = h.id AND rc."schoolId" IS NULL;
UPDATE "RollCallRecord" rcr SET "schoolId" = rc."schoolId" FROM "RollCall" rc WHERE rcr."rollCallId" = rc.id AND rcr."schoolId" IS NULL;
UPDATE "MedicationLog" ml SET "schoolId" = sba."schoolId" FROM "SickBayAdmission" sba WHERE ml."sickBayAdmissionId" = sba.id AND ml."schoolId" IS NULL;

-- Attendance
UPDATE "AttendanceRecord" ar SET "schoolId" = areg."schoolId" FROM "AttendanceRegister" areg WHERE ar."registerId" = areg.id AND ar."schoolId" IS NULL;

-- Communication
UPDATE "GraduationRecord" gr SET "schoolId" = gb."schoolId" FROM "GraduationBatch" gb WHERE gr."graduationBatchId" = gb.id AND gr."schoolId" IS NULL;

-- LMS
UPDATE "Lesson" l SET "schoolId" = c."schoolId" FROM "Course" c WHERE l."courseId" = c.id AND l."schoolId" IS NULL;
UPDATE "LmsAssignment" la SET "schoolId" = c."schoolId" FROM "Course" c WHERE la."courseId" = c.id AND la."schoolId" IS NULL;
UPDATE "AssignmentSubmission" asub SET "schoolId" = la."schoolId" FROM "LmsAssignment" la WHERE asub."assignmentId" = la.id AND asub."schoolId" IS NULL;
UPDATE "LessonProgress" lp SET "schoolId" = l."schoolId" FROM "Lesson" l WHERE lp."lessonId" = l.id AND lp."schoolId" IS NULL;
UPDATE "CourseEnrollment" ce SET "schoolId" = c."schoolId" FROM "Course" c WHERE ce."courseId" = c.id AND ce."schoolId" IS NULL;
UPDATE "QuizQuestion" qq SET "schoolId" = la."schoolId" FROM "LmsAssignment" la WHERE qq."assignmentId" = la.id AND qq."schoolId" IS NULL;

-- Library
UPDATE "BookIssue" bi SET "schoolId" = bk."schoolId" FROM "Book" bk WHERE bi."bookId" = bk.id AND bi."schoolId" IS NULL;

-- Transport
UPDATE "RouteStop" rs SET "schoolId" = r."schoolId" FROM "Route" r WHERE rs."routeId" = r.id AND rs."schoolId" IS NULL;
UPDATE "StudentTransport" stt SET "schoolId" = st."schoolId" FROM "Student" st WHERE stt."studentId" = st.id AND stt."schoolId" IS NULL;

-- ============================================================
-- STEP 3: Set NOT NULL constraints (except AuditLog, Notification)
-- ============================================================

ALTER TABLE "Term" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "GradeDefinition" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "ClassArm" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Enrollment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Mark" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "TerminalResult" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "SubjectResult" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "AnnualResult" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "SubjectAnnualResult" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "ProgrammeSubject" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "TeacherSubjectAssignment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "StudentSubjectSelection" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "StudentConduct" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "MarkAuditLog" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "StudentActivity" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "ExamSeatingArrangement" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "PTCBooking" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "HomeworkSubmission" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Guardian" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "StudentGuardian" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "StudentHouse" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "AdmissionDocument" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "FeeItem" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "StudentBill" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "StudentBillItem" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Receipt" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "StudentScholarship" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "PaymentReversal" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "FeeTemplateItem" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "InstallmentSchedule" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "StudentInstallment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "AppliedPenalty" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "SubsidyDisbursement" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "DonorFundAllocation" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "BankStatementEntry" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "JournalEntry" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "PettyCashTransaction" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "PettyCashReplenishment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "BudgetLine" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "ExpenseClaimItem" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Employment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "LeaveBalance" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "LeaveRequest" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "PayrollEntry" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "LoanRepayment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Dormitory" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Bed" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "BedAllocation" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Exeat" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "ExeatApproval" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "RollCall" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "RollCallRecord" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "MedicationLog" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "AttendanceRecord" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "GraduationRecord" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Lesson" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "LmsAssignment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "AssignmentSubmission" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "LessonProgress" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "CourseEnrollment" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "QuizQuestion" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "BookIssue" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "RouteStop" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "StudentTransport" ALTER COLUMN "schoolId" SET NOT NULL;
-- AuditLog and Notification remain nullable (system-level entries)

-- ============================================================
-- STEP 4: Add foreign key constraints and indexes
-- ============================================================

ALTER TABLE "Term" ADD CONSTRAINT "Term_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradeDefinition" ADD CONSTRAINT "GradeDefinition_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassArm" ADD CONSTRAINT "ClassArm_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerminalResult" ADD CONSTRAINT "TerminalResult_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubjectResult" ADD CONSTRAINT "SubjectResult_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnnualResult" ADD CONSTRAINT "AnnualResult_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubjectAnnualResult" ADD CONSTRAINT "SubjectAnnualResult_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentBill" ADD CONSTRAINT "StudentBill_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for all new schoolId columns
CREATE INDEX "Term_schoolId_idx" ON "Term"("schoolId");
CREATE INDEX "GradeDefinition_schoolId_idx" ON "GradeDefinition"("schoolId");
CREATE INDEX "ClassArm_schoolId_idx" ON "ClassArm"("schoolId");
CREATE INDEX "Enrollment_schoolId_idx" ON "Enrollment"("schoolId");
CREATE INDEX "Mark_schoolId_idx" ON "Mark"("schoolId");
CREATE INDEX "TerminalResult_schoolId_idx" ON "TerminalResult"("schoolId");
CREATE INDEX "SubjectResult_schoolId_idx" ON "SubjectResult"("schoolId");
CREATE INDEX "AnnualResult_schoolId_idx" ON "AnnualResult"("schoolId");
CREATE INDEX "SubjectAnnualResult_schoolId_idx" ON "SubjectAnnualResult"("schoolId");
CREATE INDEX "StudentBill_schoolId_idx" ON "StudentBill"("schoolId");
CREATE INDEX "Payment_schoolId_idx" ON "Payment"("schoolId");
CREATE INDEX "Receipt_schoolId_idx" ON "Receipt"("schoolId");
CREATE INDEX "JournalEntry_schoolId_idx" ON "JournalEntry"("schoolId");
CREATE INDEX "AuditLog_schoolId_idx" ON "AuditLog"("schoolId");
CREATE INDEX "Notification_schoolId_idx" ON "Notification"("schoolId");
CREATE INDEX "Guardian_schoolId_idx" ON "Guardian"("schoolId");
CREATE INDEX "StudentGuardian_schoolId_idx" ON "StudentGuardian"("schoolId");
CREATE INDEX "FeeItem_schoolId_idx" ON "FeeItem"("schoolId");
CREATE INDEX "Dormitory_schoolId_idx" ON "Dormitory"("schoolId");
CREATE INDEX "Bed_schoolId_idx" ON "Bed"("schoolId");
CREATE INDEX "Exeat_schoolId_idx" ON "Exeat"("schoolId");
CREATE INDEX "RollCall_schoolId_idx" ON "RollCall"("schoolId");
CREATE INDEX "AttendanceRecord_schoolId_idx" ON "AttendanceRecord"("schoolId");
CREATE INDEX "Employment_schoolId_idx" ON "Employment"("schoolId");
CREATE INDEX "LeaveRequest_schoolId_idx" ON "LeaveRequest"("schoolId");
CREATE INDEX "PayrollEntry_schoolId_idx" ON "PayrollEntry"("schoolId");
CREATE INDEX "Lesson_schoolId_idx" ON "Lesson"("schoolId");
CREATE INDEX "BookIssue_schoolId_idx" ON "BookIssue"("schoolId");
