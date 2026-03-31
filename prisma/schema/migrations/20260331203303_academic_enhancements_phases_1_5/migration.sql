-- CreateEnum
CREATE TYPE "SelectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConductRating" AS ENUM ('EXCELLENT', 'VERY_GOOD', 'GOOD', 'AVERAGE', 'BELOW_AVERAGE', 'POOR');

-- CreateEnum
CREATE TYPE "AcademicEventType" AS ENUM ('EXAM_PERIOD', 'HOLIDAY', 'HALF_TERM', 'PTA_MEETING', 'SPORTS_DAY', 'CULTURAL_EVENT', 'ORIENTATION', 'GRADUATION_CEREMONY', 'REGISTRATION', 'MARK_DEADLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "InterventionType" AS ENUM ('ACADEMIC_SUPPORT', 'TUTORING', 'COUNSELING', 'PARENT_CONFERENCE', 'MENTORING', 'REMEDIAL_CLASS', 'OTHER_INTERVENTION');

-- CreateEnum
CREATE TYPE "InterventionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CLUB', 'SPORT', 'SOCIETY', 'CULTURAL', 'RELIGIOUS', 'COMMUNITY_SERVICE', 'OTHER_ACTIVITY');

-- CreateEnum
CREATE TYPE "AwardType" AS ENUM ('BEST_STUDENT', 'BEST_IN_SUBJECT', 'MOST_IMPROVED', 'PERFECT_ATTENDANCE', 'LEADERSHIP', 'SPORTS_AWARD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "StandardProficiency" AS ENUM ('NOT_YET', 'DEVELOPING', 'APPROACHING', 'MEETING', 'EXCEEDING');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'PTC_COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "HomeworkStatus" AS ENUM ('ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HomeworkSubmissionStatus" AS ENUM ('SUBMITTED', 'GRADED', 'RETURNED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SnapshotType" AS ENUM ('ACADEMIC_SUMMARY', 'ATTENDANCE_SUMMARY', 'FINANCE_SUMMARY', 'ENROLLMENT_TRENDS', 'SUBJECT_PERFORMANCE', 'COHORT_ANALYSIS');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('DATA_PROCESSING', 'MARKETING_COMMUNICATIONS', 'PHOTO_VIDEO', 'THIRD_PARTY_SHARING', 'ANALYTICS_TRACKING');

-- CreateEnum
CREATE TYPE "ExportRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SCHEDULED', 'EXECUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportTemplateType" AS ENUM ('TERMINAL', 'ANNUAL', 'TRANSCRIPT', 'PROGRESS');

-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BorrowerType" AS ENUM ('STUDENT', 'STAFF');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('ISSUED', 'RETURNED', 'OVERDUE', 'LOST');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('DOCUMENT', 'VIDEO', 'AUDIO', 'EBOOK', 'LINK');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LessonContentType" AS ENUM ('TEXT', 'VIDEO', 'PDF', 'LINK', 'MIXED');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('WRITTEN', 'QUIZ', 'FILE_UPLOAD', 'PROJECT');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'GRADED', 'RETURNED');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('BUS', 'MINIBUS', 'VAN', 'CAR');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "AssessmentType" ADD COLUMN     "entryDeadline" TIMESTAMP(3),
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "submissionDeadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SubjectResult" ADD COLUMN     "caBreakdown" JSONB;

-- CreateTable
CREATE TABLE "StudentSubjectSelection" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "status" "SelectionStatus" NOT NULL DEFAULT 'PENDING',
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "StudentSubjectSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentConduct" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classArmId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "punctuality" "ConductRating" NOT NULL DEFAULT 'GOOD',
    "attendance" "ConductRating" NOT NULL DEFAULT 'GOOD',
    "attentiveness" "ConductRating" NOT NULL DEFAULT 'GOOD',
    "neatness" "ConductRating" NOT NULL DEFAULT 'GOOD',
    "politeness" "ConductRating" NOT NULL DEFAULT 'GOOD',
    "honesty" "ConductRating" NOT NULL DEFAULT 'GOOD',
    "selfControl" "ConductRating" NOT NULL DEFAULT 'GOOD',
    "relationship" "ConductRating" NOT NULL DEFAULT 'GOOD',
    "initiative" "ConductRating" NOT NULL DEFAULT 'GOOD',
    "sports" "ConductRating",
    "handwriting" "ConductRating",
    "verbalFluency" "ConductRating",
    "otherTraits" JSONB,
    "remarks" TEXT,
    "ratedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentConduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkAuditLog" (
    "id" TEXT NOT NULL,
    "markId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "assessmentTypeId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "previousScore" DOUBLE PRECISION,
    "newScore" DOUBLE PRECISION,
    "previousStatus" "MarkStatus",
    "newStatus" "MarkStatus",
    "changedBy" TEXT NOT NULL,
    "changeReason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarkAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "termId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "type" "AcademicEventType" NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicIntervention" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "type" "InterventionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetArea" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "InterventionStatus" NOT NULL DEFAULT 'ACTIVE',
    "outcome" TEXT,
    "assignedTo" TEXT,
    "createdBy" TEXT NOT NULL,
    "notes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoCurricularActivity" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "description" TEXT,
    "supervisorId" TEXT,
    "maxParticipants" INTEGER,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoCurricularActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentActivity" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "role" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "achievements" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "StudentActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicAward" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT,
    "type" "AwardType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subjectId" TEXT,
    "awardedBy" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSeatingArrangement" (
    "id" TEXT NOT NULL,
    "examScheduleId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "seatNumber" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamSeatingArrangement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkStandardLink" (
    "id" TEXT NOT NULL,
    "markId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "proficiency" "StandardProficiency" NOT NULL DEFAULT 'DEVELOPING',

    CONSTRAINT "MarkStandardLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentStandardMastery" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "proficiency" "StandardProficiency" NOT NULL,
    "evidence" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentStandardMastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PTCSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotDuration" INTEGER NOT NULL DEFAULT 15,
    "location" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PTCSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PTCBooking" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PTCBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Homework" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classArmId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "maxScore" DOUBLE PRECISION,
    "status" "HomeworkStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkSubmission" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT,
    "fileUrl" TEXT,
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "gradedBy" TEXT,
    "gradedAt" TIMESTAMP(3),
    "status" "HomeworkSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnualResult" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classArmId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "totalScore" DOUBLE PRECISION,
    "averageScore" DOUBLE PRECISION,
    "classPosition" INTEGER,
    "overallGrade" TEXT,
    "subjectCount" INTEGER,
    "promotionStatus" "PromotionStatus",
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnualResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectAnnualResult" (
    "id" TEXT NOT NULL,
    "annualResultId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "term1Score" DOUBLE PRECISION,
    "term2Score" DOUBLE PRECISION,
    "term3Score" DOUBLE PRECISION,
    "averageScore" DOUBLE PRECISION,
    "grade" TEXT,
    "interpretation" TEXT,
    "position" INTEGER,

    CONSTRAINT "SubjectAnnualResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentRiskProfile" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "factors" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "performanceTrend" TEXT,
    "predictedAverage" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentRiskProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "type" "SnapshotType" NOT NULL,
    "data" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSchool" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSchool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "permissions" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataExportRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "ExportRequestStatus" NOT NULL DEFAULT 'PENDING',
    "format" TEXT NOT NULL DEFAULT 'json',
    "fileUrl" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "DataExportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataDeletionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRetentionPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumFramework" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "country" TEXT,
    "organization" TEXT,
    "gradeLevels" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumFramework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumStandard" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "gradeLevel" TEXT NOT NULL,
    "strand" TEXT,
    "subStrand" TEXT,
    "description" TEXT NOT NULL,
    "learningOutcome" TEXT,

    CONSTRAINT "CurriculumStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolCurriculum" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "customConfig" JSONB,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolCurriculum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingTemplate" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assessmentWeights" JSONB NOT NULL,
    "gradeScale" JSONB NOT NULL,
    "passThreshold" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ReportTemplateType" NOT NULL DEFAULT 'TERMINAL',
    "layout" JSONB NOT NULL,
    "sections" JSONB NOT NULL,
    "headerConfig" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "isbn" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "publisher" TEXT,
    "publicationYear" INTEGER,
    "category" TEXT,
    "shelfLocation" TEXT,
    "totalCopies" INTEGER NOT NULL DEFAULT 1,
    "availableCopies" INTEGER NOT NULL DEFAULT 1,
    "coverImageUrl" TEXT,
    "status" "BookStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookIssue" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "borrowerType" "BorrowerType" NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "returnedTo" TEXT,
    "status" "IssueStatus" NOT NULL DEFAULT 'ISSUED',
    "fineAmount" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "BookIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalResource" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ResourceType" NOT NULL DEFAULT 'DOCUMENT',
    "fileUrl" TEXT NOT NULL,
    "category" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "accessLevel" TEXT NOT NULL DEFAULT 'ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT,
    "classArmId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "teacherId" TEXT NOT NULL,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "contentType" "LessonContentType" NOT NULL DEFAULT 'TEXT',
    "resourceUrl" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "duration" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsAssignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssignmentType" NOT NULL DEFAULT 'WRITTEN',
    "dueDate" TIMESTAMP(3),
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    "options" JSONB,
    "correctAnswer" TEXT,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEnrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT,
    "answers" JSONB,
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),
    "gradedBy" TEXT,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "insuranceExpiry" TIMESTAMP(3),
    "lastServiceDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "vehicleId" TEXT,
    "startPoint" TEXT,
    "endPoint" TEXT,
    "distance" DOUBLE PRECISION,
    "estimatedDuration" INTEGER,
    "fee" DOUBLE PRECISION,
    "status" "RouteStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "pickupTime" TEXT,
    "dropoffTime" TEXT,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentTransport" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT,
    "academicYearId" TEXT NOT NULL,
    "pickupPoint" TEXT,
    "dropoffPoint" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentTransport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentSubjectSelection_studentId_idx" ON "StudentSubjectSelection"("studentId");

-- CreateIndex
CREATE INDEX "StudentSubjectSelection_subjectId_idx" ON "StudentSubjectSelection"("subjectId");

-- CreateIndex
CREATE INDEX "StudentSubjectSelection_academicYearId_idx" ON "StudentSubjectSelection"("academicYearId");

-- CreateIndex
CREATE INDEX "StudentSubjectSelection_status_idx" ON "StudentSubjectSelection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSubjectSelection_studentId_subjectId_academicYearId_key" ON "StudentSubjectSelection"("studentId", "subjectId", "academicYearId");

-- CreateIndex
CREATE INDEX "StudentConduct_classArmId_idx" ON "StudentConduct"("classArmId");

-- CreateIndex
CREATE INDEX "StudentConduct_termId_idx" ON "StudentConduct"("termId");

-- CreateIndex
CREATE INDEX "StudentConduct_studentId_idx" ON "StudentConduct"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentConduct_studentId_termId_academicYearId_key" ON "StudentConduct"("studentId", "termId", "academicYearId");

-- CreateIndex
CREATE INDEX "MarkAuditLog_markId_idx" ON "MarkAuditLog"("markId");

-- CreateIndex
CREATE INDEX "MarkAuditLog_studentId_idx" ON "MarkAuditLog"("studentId");

-- CreateIndex
CREATE INDEX "MarkAuditLog_changedBy_idx" ON "MarkAuditLog"("changedBy");

-- CreateIndex
CREATE INDEX "MarkAuditLog_changedAt_idx" ON "MarkAuditLog"("changedAt");

-- CreateIndex
CREATE INDEX "MarkAuditLog_subjectId_termId_idx" ON "MarkAuditLog"("subjectId", "termId");

-- CreateIndex
CREATE INDEX "AcademicEvent_schoolId_idx" ON "AcademicEvent"("schoolId");

-- CreateIndex
CREATE INDEX "AcademicEvent_academicYearId_idx" ON "AcademicEvent"("academicYearId");

-- CreateIndex
CREATE INDEX "AcademicEvent_startDate_idx" ON "AcademicEvent"("startDate");

-- CreateIndex
CREATE INDEX "AcademicEvent_schoolId_startDate_idx" ON "AcademicEvent"("schoolId", "startDate");

-- CreateIndex
CREATE INDEX "AcademicIntervention_studentId_idx" ON "AcademicIntervention"("studentId");

-- CreateIndex
CREATE INDEX "AcademicIntervention_schoolId_idx" ON "AcademicIntervention"("schoolId");

-- CreateIndex
CREATE INDEX "AcademicIntervention_status_idx" ON "AcademicIntervention"("status");

-- CreateIndex
CREATE INDEX "AcademicIntervention_assignedTo_idx" ON "AcademicIntervention"("assignedTo");

-- CreateIndex
CREATE INDEX "CoCurricularActivity_schoolId_idx" ON "CoCurricularActivity"("schoolId");

-- CreateIndex
CREATE INDEX "CoCurricularActivity_type_idx" ON "CoCurricularActivity"("type");

-- CreateIndex
CREATE UNIQUE INDEX "CoCurricularActivity_schoolId_name_key" ON "CoCurricularActivity"("schoolId", "name");

-- CreateIndex
CREATE INDEX "StudentActivity_activityId_idx" ON "StudentActivity"("activityId");

-- CreateIndex
CREATE INDEX "StudentActivity_studentId_idx" ON "StudentActivity"("studentId");

-- CreateIndex
CREATE INDEX "StudentActivity_academicYearId_idx" ON "StudentActivity"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentActivity_activityId_studentId_academicYearId_key" ON "StudentActivity"("activityId", "studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "AcademicAward_studentId_idx" ON "AcademicAward"("studentId");

-- CreateIndex
CREATE INDEX "AcademicAward_schoolId_idx" ON "AcademicAward"("schoolId");

-- CreateIndex
CREATE INDEX "AcademicAward_academicYearId_idx" ON "AcademicAward"("academicYearId");

-- CreateIndex
CREATE INDEX "AcademicAward_type_idx" ON "AcademicAward"("type");

-- CreateIndex
CREATE INDEX "ExamSeatingArrangement_examScheduleId_idx" ON "ExamSeatingArrangement"("examScheduleId");

-- CreateIndex
CREATE INDEX "ExamSeatingArrangement_studentId_idx" ON "ExamSeatingArrangement"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSeatingArrangement_examScheduleId_studentId_key" ON "ExamSeatingArrangement"("examScheduleId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSeatingArrangement_examScheduleId_roomId_seatNumber_key" ON "ExamSeatingArrangement"("examScheduleId", "roomId", "seatNumber");

-- CreateIndex
CREATE INDEX "MarkStandardLink_markId_idx" ON "MarkStandardLink"("markId");

-- CreateIndex
CREATE INDEX "MarkStandardLink_standardId_idx" ON "MarkStandardLink"("standardId");

-- CreateIndex
CREATE UNIQUE INDEX "MarkStandardLink_markId_standardId_key" ON "MarkStandardLink"("markId", "standardId");

-- CreateIndex
CREATE INDEX "StudentStandardMastery_studentId_idx" ON "StudentStandardMastery"("studentId");

-- CreateIndex
CREATE INDEX "StudentStandardMastery_standardId_idx" ON "StudentStandardMastery"("standardId");

-- CreateIndex
CREATE INDEX "StudentStandardMastery_studentId_academicYearId_idx" ON "StudentStandardMastery"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentStandardMastery_studentId_standardId_termId_key" ON "StudentStandardMastery"("studentId", "standardId", "termId");

-- CreateIndex
CREATE INDEX "PTCSession_schoolId_idx" ON "PTCSession"("schoolId");

-- CreateIndex
CREATE INDEX "PTCSession_date_idx" ON "PTCSession"("date");

-- CreateIndex
CREATE INDEX "PTCBooking_sessionId_idx" ON "PTCBooking"("sessionId");

-- CreateIndex
CREATE INDEX "PTCBooking_teacherId_idx" ON "PTCBooking"("teacherId");

-- CreateIndex
CREATE INDEX "PTCBooking_parentId_idx" ON "PTCBooking"("parentId");

-- CreateIndex
CREATE INDEX "PTCBooking_studentId_idx" ON "PTCBooking"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PTCBooking_sessionId_teacherId_timeSlot_key" ON "PTCBooking"("sessionId", "teacherId", "timeSlot");

-- CreateIndex
CREATE INDEX "Homework_classArmId_idx" ON "Homework"("classArmId");

-- CreateIndex
CREATE INDEX "Homework_subjectId_idx" ON "Homework"("subjectId");

-- CreateIndex
CREATE INDEX "Homework_termId_idx" ON "Homework"("termId");

-- CreateIndex
CREATE INDEX "Homework_dueDate_idx" ON "Homework"("dueDate");

-- CreateIndex
CREATE INDEX "Homework_assignedBy_idx" ON "Homework"("assignedBy");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_homeworkId_idx" ON "HomeworkSubmission"("homeworkId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_studentId_idx" ON "HomeworkSubmission"("studentId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_status_idx" ON "HomeworkSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmission_homeworkId_studentId_key" ON "HomeworkSubmission"("homeworkId", "studentId");

-- CreateIndex
CREATE INDEX "AnnualResult_classArmId_idx" ON "AnnualResult"("classArmId");

-- CreateIndex
CREATE INDEX "AnnualResult_academicYearId_idx" ON "AnnualResult"("academicYearId");

-- CreateIndex
CREATE INDEX "AnnualResult_classArmId_academicYearId_idx" ON "AnnualResult"("classArmId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnualResult_studentId_academicYearId_key" ON "AnnualResult"("studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "SubjectAnnualResult_annualResultId_idx" ON "SubjectAnnualResult"("annualResultId");

-- CreateIndex
CREATE INDEX "SubjectAnnualResult_subjectId_idx" ON "SubjectAnnualResult"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectAnnualResult_annualResultId_subjectId_key" ON "SubjectAnnualResult"("annualResultId", "subjectId");

-- CreateIndex
CREATE INDEX "StudentRiskProfile_schoolId_idx" ON "StudentRiskProfile"("schoolId");

-- CreateIndex
CREATE INDEX "StudentRiskProfile_studentId_idx" ON "StudentRiskProfile"("studentId");

-- CreateIndex
CREATE INDEX "StudentRiskProfile_riskLevel_idx" ON "StudentRiskProfile"("riskLevel");

-- CreateIndex
CREATE INDEX "StudentRiskProfile_schoolId_riskLevel_idx" ON "StudentRiskProfile"("schoolId", "riskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "StudentRiskProfile_studentId_academicYearId_termId_key" ON "StudentRiskProfile"("studentId", "academicYearId", "termId");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_schoolId_idx" ON "AnalyticsSnapshot"("schoolId");

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_type_idx" ON "AnalyticsSnapshot"("type");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsSnapshot_schoolId_academicYearId_termId_type_key" ON "AnalyticsSnapshot"("schoolId", "academicYearId", "termId", "type");

-- CreateIndex
CREATE INDEX "UserSchool_userId_idx" ON "UserSchool"("userId");

-- CreateIndex
CREATE INDEX "UserSchool_schoolId_idx" ON "UserSchool"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSchool_userId_schoolId_key" ON "UserSchool"("userId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_prefix_idx" ON "ApiKey"("prefix");

-- CreateIndex
CREATE INDEX "ApiKey_schoolId_idx" ON "ApiKey"("schoolId");

-- CreateIndex
CREATE INDEX "ApiKey_isActive_idx" ON "ApiKey"("isActive");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

-- CreateIndex
CREATE INDEX "ConsentRecord_schoolId_idx" ON "ConsentRecord"("schoolId");

-- CreateIndex
CREATE INDEX "ConsentRecord_consentType_idx" ON "ConsentRecord"("consentType");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_userId_schoolId_consentType_key" ON "ConsentRecord"("userId", "schoolId", "consentType");

-- CreateIndex
CREATE INDEX "DataExportRequest_userId_idx" ON "DataExportRequest"("userId");

-- CreateIndex
CREATE INDEX "DataExportRequest_schoolId_idx" ON "DataExportRequest"("schoolId");

-- CreateIndex
CREATE INDEX "DataExportRequest_status_idx" ON "DataExportRequest"("status");

-- CreateIndex
CREATE INDEX "DataDeletionRequest_userId_idx" ON "DataDeletionRequest"("userId");

-- CreateIndex
CREATE INDEX "DataDeletionRequest_schoolId_idx" ON "DataDeletionRequest"("schoolId");

-- CreateIndex
CREATE INDEX "DataDeletionRequest_status_idx" ON "DataDeletionRequest"("status");

-- CreateIndex
CREATE INDEX "DataDeletionRequest_entityType_entityId_idx" ON "DataDeletionRequest"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "PrivacyPolicy_schoolId_idx" ON "PrivacyPolicy"("schoolId");

-- CreateIndex
CREATE INDEX "PrivacyPolicy_isActive_idx" ON "PrivacyPolicy"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyPolicy_schoolId_version_key" ON "PrivacyPolicy"("schoolId", "version");

-- CreateIndex
CREATE INDEX "DataRetentionPolicy_schoolId_idx" ON "DataRetentionPolicy"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "DataRetentionPolicy_schoolId_entityType_key" ON "DataRetentionPolicy"("schoolId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumFramework_code_key" ON "CurriculumFramework"("code");

-- CreateIndex
CREATE INDEX "CurriculumFramework_code_idx" ON "CurriculumFramework"("code");

-- CreateIndex
CREATE INDEX "CurriculumFramework_isActive_idx" ON "CurriculumFramework"("isActive");

-- CreateIndex
CREATE INDEX "CurriculumStandard_frameworkId_idx" ON "CurriculumStandard"("frameworkId");

-- CreateIndex
CREATE INDEX "CurriculumStandard_subject_idx" ON "CurriculumStandard"("subject");

-- CreateIndex
CREATE INDEX "CurriculumStandard_gradeLevel_idx" ON "CurriculumStandard"("gradeLevel");

-- CreateIndex
CREATE INDEX "CurriculumStandard_frameworkId_subject_gradeLevel_idx" ON "CurriculumStandard"("frameworkId", "subject", "gradeLevel");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumStandard_frameworkId_code_key" ON "CurriculumStandard"("frameworkId", "code");

-- CreateIndex
CREATE INDEX "SchoolCurriculum_schoolId_idx" ON "SchoolCurriculum"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolCurriculum_frameworkId_idx" ON "SchoolCurriculum"("frameworkId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCurriculum_schoolId_frameworkId_key" ON "SchoolCurriculum"("schoolId", "frameworkId");

-- CreateIndex
CREATE INDEX "GradingTemplate_frameworkId_idx" ON "GradingTemplate"("frameworkId");

-- CreateIndex
CREATE INDEX "ReportTemplate_frameworkId_idx" ON "ReportTemplate"("frameworkId");

-- CreateIndex
CREATE INDEX "ReportTemplate_type_idx" ON "ReportTemplate"("type");

-- CreateIndex
CREATE INDEX "Book_schoolId_idx" ON "Book"("schoolId");

-- CreateIndex
CREATE INDEX "Book_isbn_idx" ON "Book"("isbn");

-- CreateIndex
CREATE INDEX "Book_title_idx" ON "Book"("title");

-- CreateIndex
CREATE INDEX "Book_author_idx" ON "Book"("author");

-- CreateIndex
CREATE INDEX "Book_category_idx" ON "Book"("category");

-- CreateIndex
CREATE INDEX "Book_status_idx" ON "Book"("status");

-- CreateIndex
CREATE INDEX "BookIssue_bookId_idx" ON "BookIssue"("bookId");

-- CreateIndex
CREATE INDEX "BookIssue_borrowerId_idx" ON "BookIssue"("borrowerId");

-- CreateIndex
CREATE INDEX "BookIssue_status_idx" ON "BookIssue"("status");

-- CreateIndex
CREATE INDEX "BookIssue_dueDate_idx" ON "BookIssue"("dueDate");

-- CreateIndex
CREATE INDEX "BookIssue_borrowerId_status_idx" ON "BookIssue"("borrowerId", "status");

-- CreateIndex
CREATE INDEX "DigitalResource_schoolId_idx" ON "DigitalResource"("schoolId");

-- CreateIndex
CREATE INDEX "DigitalResource_category_idx" ON "DigitalResource"("category");

-- CreateIndex
CREATE INDEX "DigitalResource_type_idx" ON "DigitalResource"("type");

-- CreateIndex
CREATE INDEX "Course_schoolId_idx" ON "Course"("schoolId");

-- CreateIndex
CREATE INDEX "Course_teacherId_idx" ON "Course"("teacherId");

-- CreateIndex
CREATE INDEX "Course_classArmId_idx" ON "Course"("classArmId");

-- CreateIndex
CREATE INDEX "Course_status_idx" ON "Course"("status");

-- CreateIndex
CREATE INDEX "Lesson_courseId_idx" ON "Lesson"("courseId");

-- CreateIndex
CREATE INDEX "Lesson_courseId_orderIndex_idx" ON "Lesson"("courseId", "orderIndex");

-- CreateIndex
CREATE INDEX "LmsAssignment_courseId_idx" ON "LmsAssignment"("courseId");

-- CreateIndex
CREATE INDEX "LmsAssignment_dueDate_idx" ON "LmsAssignment"("dueDate");

-- CreateIndex
CREATE INDEX "QuizQuestion_assignmentId_idx" ON "QuizQuestion"("assignmentId");

-- CreateIndex
CREATE INDEX "CourseEnrollment_courseId_idx" ON "CourseEnrollment"("courseId");

-- CreateIndex
CREATE INDEX "CourseEnrollment_studentId_idx" ON "CourseEnrollment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_courseId_studentId_key" ON "CourseEnrollment"("courseId", "studentId");

-- CreateIndex
CREATE INDEX "LessonProgress_studentId_idx" ON "LessonProgress"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_lessonId_studentId_key" ON "LessonProgress"("lessonId", "studentId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_assignmentId_idx" ON "AssignmentSubmission"("assignmentId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_studentId_idx" ON "AssignmentSubmission"("studentId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_status_idx" ON "AssignmentSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_studentId_key" ON "AssignmentSubmission"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "Vehicle_schoolId_idx" ON "Vehicle"("schoolId");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_schoolId_registrationNumber_key" ON "Vehicle"("schoolId", "registrationNumber");

-- CreateIndex
CREATE INDEX "Route_schoolId_idx" ON "Route"("schoolId");

-- CreateIndex
CREATE INDEX "Route_vehicleId_idx" ON "Route"("vehicleId");

-- CreateIndex
CREATE INDEX "Route_status_idx" ON "Route"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Route_schoolId_name_key" ON "Route"("schoolId", "name");

-- CreateIndex
CREATE INDEX "RouteStop_routeId_idx" ON "RouteStop"("routeId");

-- CreateIndex
CREATE INDEX "RouteStop_routeId_orderIndex_idx" ON "RouteStop"("routeId", "orderIndex");

-- CreateIndex
CREATE INDEX "StudentTransport_routeId_idx" ON "StudentTransport"("routeId");

-- CreateIndex
CREATE INDEX "StudentTransport_studentId_idx" ON "StudentTransport"("studentId");

-- CreateIndex
CREATE INDEX "StudentTransport_academicYearId_idx" ON "StudentTransport"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentTransport_studentId_academicYearId_key" ON "StudentTransport"("studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "Student_schoolId_status_idx" ON "Student"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Student_schoolId_gender_status_idx" ON "Student"("schoolId", "gender", "status");

-- CreateIndex
CREATE INDEX "Student_schoolId_boardingStatus_status_idx" ON "Student"("schoolId", "boardingStatus", "status");

-- CreateIndex
CREATE INDEX "StudentBill_studentId_status_idx" ON "StudentBill"("studentId", "status");

-- CreateIndex
CREATE INDEX "StudentBill_termId_status_idx" ON "StudentBill"("termId", "status");

-- AddForeignKey
ALTER TABLE "StudentSubjectSelection" ADD CONSTRAINT "StudentSubjectSelection_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicEvent" ADD CONSTRAINT "AcademicEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentActivity" ADD CONSTRAINT "StudentActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CoCurricularActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAward" ADD CONSTRAINT "AcademicAward_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeatingArrangement" ADD CONSTRAINT "ExamSeatingArrangement_examScheduleId_fkey" FOREIGN KEY ("examScheduleId") REFERENCES "ExamSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeatingArrangement" ADD CONSTRAINT "ExamSeatingArrangement_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTCBooking" ADD CONSTRAINT "PTCBooking_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PTCSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectAnnualResult" ADD CONSTRAINT "SubjectAnnualResult_annualResultId_fkey" FOREIGN KEY ("annualResultId") REFERENCES "AnnualResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectAnnualResult" ADD CONSTRAINT "SubjectAnnualResult_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSchool" ADD CONSTRAINT "UserSchool_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSchool" ADD CONSTRAINT "UserSchool_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumStandard" ADD CONSTRAINT "CurriculumStandard_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "CurriculumFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCurriculum" ADD CONSTRAINT "SchoolCurriculum_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "CurriculumFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookIssue" ADD CONSTRAINT "BookIssue_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsAssignment" ADD CONSTRAINT "LmsAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "LmsAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "LmsAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTransport" ADD CONSTRAINT "StudentTransport_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
