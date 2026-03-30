import { db } from "@/lib/db";

export interface RiskFactor {
  factor: string;
  weight: number;
  detail: string;
}

export interface StudentRiskAssessment {
  studentId: string;
  riskScore: number;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  factors: RiskFactor[];
  recommendations: string[];
  performanceTrend: "IMPROVING" | "STABLE" | "DECLINING";
  predictedAverage: number | null;
}

/**
 * Compute risk profiles for all students in a class arm for a given term.
 */
export async function computeStudentRiskProfiles(
  schoolId: string,
  academicYearId: string,
  termId: string,
  classArmId?: string,
): Promise<StudentRiskAssessment[]> {
  // Get all active enrollments
  const enrollmentWhere: Record<string, unknown> = {
    academicYearId,
    status: "ACTIVE",
  };
  if (classArmId) enrollmentWhere.classArmId = classArmId;

  const enrollments = await db.enrollment.findMany({
    where: enrollmentWhere,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, schoolId: true } },
    },
  });

  const studentIds = enrollments
    .filter((e) => e.student.schoolId === schoolId)
    .map((e) => e.studentId);

  if (studentIds.length === 0) return [];

  // Fetch current term results
  const currentResults = await db.terminalResult.findMany({
    where: { studentId: { in: studentIds }, termId },
    include: { subjectResults: true },
  });

  // Fetch previous term results for trend analysis
  const term = await db.term.findUnique({
    where: { id: termId },
    include: { academicYear: { include: { terms: { orderBy: { termNumber: "asc" } } } } },
  });

  const currentTermIndex = term?.academicYear.terms.findIndex((t) => t.id === termId) ?? -1;
  const previousTermId = currentTermIndex > 0
    ? term?.academicYear.terms[currentTermIndex - 1]?.id
    : null;

  const previousResults = previousTermId
    ? await db.terminalResult.findMany({
        where: { studentId: { in: studentIds }, termId: previousTermId },
      })
    : [];

  const previousResultMap = new Map(previousResults.map((r) => [r.studentId, r]));

  // Fetch attendance data
  const attendanceRecords = await db.attendanceRecord.findMany({
    where: {
      studentId: { in: studentIds },
      register: { date: { gte: term?.startDate, lte: term?.endDate } },
    },
  });

  const attendanceByStudent = new Map<string, { total: number; present: number; absent: number }>();
  for (const record of attendanceRecords) {
    const existing = attendanceByStudent.get(record.studentId) ?? { total: 0, present: 0, absent: 0 };
    existing.total++;
    if (record.status === "PRESENT" || record.status === "LATE") existing.present++;
    if (record.status === "ABSENT") existing.absent++;
    attendanceByStudent.set(record.studentId, existing);
  }

  // Fetch unpaid fees
  const bills = await db.studentBill.findMany({
    where: { studentId: { in: studentIds }, termId, status: { in: ["UNPAID", "PARTIAL"] } },
    select: { studentId: true, balanceAmount: true },
  });

  const unpaidByStudent = new Map<string, number>();
  for (const bill of bills) {
    unpaidByStudent.set(bill.studentId, (unpaidByStudent.get(bill.studentId) ?? 0) + bill.balanceAmount);
  }

  // Compute risk for each student
  const assessments: StudentRiskAssessment[] = [];

  for (const studentId of studentIds) {
    const currentResult = currentResults.find((r) => r.studentId === studentId);
    const previousResult = previousResultMap.get(studentId);
    const attendance = attendanceByStudent.get(studentId);
    const unpaidFees = unpaidByStudent.get(studentId) ?? 0;

    const factors: RiskFactor[] = [];
    let riskScore = 0;

    // Factor 1: Current academic performance (weight: 35)
    if (currentResult?.averageScore != null) {
      if (currentResult.averageScore < 40) {
        riskScore += 35;
        factors.push({ factor: "Very low average score", weight: 35, detail: `Average: ${currentResult.averageScore.toFixed(1)}%` });
      } else if (currentResult.averageScore < 50) {
        riskScore += 25;
        factors.push({ factor: "Below pass threshold", weight: 25, detail: `Average: ${currentResult.averageScore.toFixed(1)}%` });
      } else if (currentResult.averageScore < 60) {
        riskScore += 10;
        factors.push({ factor: "Average performance", weight: 10, detail: `Average: ${currentResult.averageScore.toFixed(1)}%` });
      }
    } else {
      riskScore += 20;
      factors.push({ factor: "No results computed", weight: 20, detail: "Missing terminal results" });
    }

    // Factor 2: Subject failures (weight: 25)
    if (currentResult?.subjectResults) {
      const failingSubjects = currentResult.subjectResults.filter(
        (sr) => sr.totalScore != null && sr.totalScore < 50,
      ).length;
      const totalSubjects = currentResult.subjectResults.length;

      if (failingSubjects > 3) {
        riskScore += 25;
        factors.push({ factor: "Multiple subject failures", weight: 25, detail: `Failing ${failingSubjects}/${totalSubjects} subjects` });
      } else if (failingSubjects > 1) {
        riskScore += 15;
        factors.push({ factor: "Some subject failures", weight: 15, detail: `Failing ${failingSubjects}/${totalSubjects} subjects` });
      } else if (failingSubjects === 1) {
        riskScore += 5;
        factors.push({ factor: "One subject failure", weight: 5, detail: `Failing 1/${totalSubjects} subjects` });
      }
    }

    // Factor 3: Performance trend (weight: 20)
    let trend: "IMPROVING" | "STABLE" | "DECLINING" = "STABLE";
    if (currentResult?.averageScore != null && previousResult?.averageScore != null) {
      const diff = currentResult.averageScore - previousResult.averageScore;
      if (diff < -10) {
        riskScore += 20;
        trend = "DECLINING";
        factors.push({ factor: "Significant grade decline", weight: 20, detail: `Dropped ${Math.abs(diff).toFixed(1)} points from last term` });
      } else if (diff < -5) {
        riskScore += 10;
        trend = "DECLINING";
        factors.push({ factor: "Grade decline", weight: 10, detail: `Dropped ${Math.abs(diff).toFixed(1)} points from last term` });
      } else if (diff > 5) {
        trend = "IMPROVING";
        // Improving reduces risk
        riskScore = Math.max(0, riskScore - 5);
      }
    }

    // Factor 4: Attendance (weight: 15)
    if (attendance && attendance.total > 0) {
      const rate = (attendance.present / attendance.total) * 100;
      if (rate < 60) {
        riskScore += 15;
        factors.push({ factor: "Very poor attendance", weight: 15, detail: `${rate.toFixed(0)}% attendance rate` });
      } else if (rate < 75) {
        riskScore += 10;
        factors.push({ factor: "Poor attendance", weight: 10, detail: `${rate.toFixed(0)}% attendance rate` });
      } else if (rate < 85) {
        riskScore += 5;
        factors.push({ factor: "Below-average attendance", weight: 5, detail: `${rate.toFixed(0)}% attendance rate` });
      }
    }

    // Factor 5: Unpaid fees (weight: 5)
    if (unpaidFees > 0) {
      riskScore += 5;
      factors.push({ factor: "Outstanding fees", weight: 5, detail: `Unpaid balance: ${unpaidFees.toFixed(2)}` });
    }

    // Clamp score 0-100
    riskScore = Math.min(100, Math.max(0, riskScore));

    // Determine risk level
    let riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
    if (riskScore >= 70) riskLevel = "CRITICAL";
    else if (riskScore >= 50) riskLevel = "HIGH";
    else if (riskScore >= 25) riskLevel = "MODERATE";
    else riskLevel = "LOW";

    // Generate recommendations
    const recommendations: string[] = [];
    if (factors.some((f) => f.factor.includes("attendance"))) {
      recommendations.push("Schedule a meeting with parents/guardians to discuss attendance");
    }
    if (factors.some((f) => f.factor.includes("subject failure"))) {
      recommendations.push("Arrange supplementary tutoring for failing subjects");
    }
    if (factors.some((f) => f.factor.includes("decline"))) {
      recommendations.push("Monitor closely and provide academic counseling");
    }
    if (factors.some((f) => f.factor.includes("fees"))) {
      recommendations.push("Contact guardian regarding outstanding fee balance");
    }
    if (riskLevel === "CRITICAL") {
      recommendations.push("Immediate intervention required - assign academic mentor");
    }
    if (recommendations.length === 0) {
      recommendations.push("Continue monitoring and encourage consistent performance");
    }

    // Predict next-term average (simple linear projection)
    let predictedAverage: number | null = null;
    if (currentResult?.averageScore != null && previousResult?.averageScore != null) {
      const momentum = currentResult.averageScore - previousResult.averageScore;
      predictedAverage = Math.min(100, Math.max(0, currentResult.averageScore + momentum * 0.5));
    }

    assessments.push({
      studentId,
      riskScore,
      riskLevel,
      factors,
      recommendations,
      performanceTrend: trend,
      predictedAverage,
    });
  }

  return assessments;
}

/**
 * Generate a text narrative summary for a class arm's performance.
 */
export function generatePerformanceNarrative(data: {
  className: string;
  termName: string;
  totalStudents: number;
  averageScore: number;
  passRate: number;
  topSubject: { name: string; average: number } | null;
  weakestSubject: { name: string; average: number } | null;
  criticalCount: number;
  highRiskCount: number;
}): string {
  const lines: string[] = [];

  lines.push(`Performance Summary for ${data.className} - ${data.termName}`);
  lines.push(`\nClass of ${data.totalStudents} students achieved an overall average of ${data.averageScore.toFixed(1)}% with a ${data.passRate.toFixed(0)}% pass rate.`);

  if (data.averageScore >= 70) {
    lines.push("This represents excellent class performance.");
  } else if (data.averageScore >= 60) {
    lines.push("This represents good class performance with room for improvement.");
  } else if (data.averageScore >= 50) {
    lines.push("This represents satisfactory performance. Targeted interventions are recommended.");
  } else {
    lines.push("This is below expectations. Comprehensive academic support is urgently needed.");
  }

  if (data.topSubject) {
    lines.push(`\nStrongest subject: ${data.topSubject.name} (${data.topSubject.average.toFixed(1)}% average)`);
  }
  if (data.weakestSubject) {
    lines.push(`Area for improvement: ${data.weakestSubject.name} (${data.weakestSubject.average.toFixed(1)}% average)`);
  }

  if (data.criticalCount > 0 || data.highRiskCount > 0) {
    lines.push(`\nAlert: ${data.criticalCount} students are at critical risk and ${data.highRiskCount} are at high risk of academic failure.`);
  }

  return lines.join("\n");
}

/**
 * Detect anomalies in attendance patterns.
 */
export async function detectAttendanceAnomalies(
  schoolId: string,
  termId: string,
): Promise<Array<{ studentId: string; type: string; detail: string }>> {
  const term = await db.term.findUnique({
    where: { id: termId },
    select: { startDate: true, endDate: true },
  });

  if (!term) return [];

  // Get all attendance records for the term
  const records = await db.attendanceRecord.findMany({
    where: {
      register: {
        date: { gte: term.startDate, lte: term.endDate },
      },
    },
    include: {
      register: { select: { date: true, classArmId: true } },
    },
  });

  // Group by student
  const byStudent = new Map<string, typeof records>();
  for (const record of records) {
    const existing = byStudent.get(record.studentId) ?? [];
    existing.push(record);
    byStudent.set(record.studentId, existing);
  }

  const anomalies: Array<{ studentId: string; type: string; detail: string }> = [];

  for (const [studentId, studentRecords] of byStudent) {
    // Detect consecutive absences (3+ days)
    const sortedRecords = studentRecords
      .filter((r) => r.status === "ABSENT")
      .sort((a, b) => a.register.date.getTime() - b.register.date.getTime());

    let consecutiveAbsent = 0;
    let lastDate: Date | null = null;

    for (const record of sortedRecords) {
      if (lastDate) {
        const dayDiff = (record.register.date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        if (dayDiff <= 2) { // Allow for weekends
          consecutiveAbsent++;
        } else {
          consecutiveAbsent = 1;
        }
      } else {
        consecutiveAbsent = 1;
      }
      lastDate = record.register.date;

      if (consecutiveAbsent >= 3) {
        anomalies.push({
          studentId,
          type: "CONSECUTIVE_ABSENCE",
          detail: `${consecutiveAbsent} consecutive days absent`,
        });
        break;
      }
    }

    // Detect sudden attendance drop (if previously good)
    const totalRecords = studentRecords.length;
    const absentRecords = studentRecords.filter((r) => r.status === "ABSENT").length;
    if (totalRecords >= 10 && absentRecords / totalRecords > 0.4) {
      anomalies.push({
        studentId,
        type: "HIGH_ABSENCE_RATE",
        detail: `${((absentRecords / totalRecords) * 100).toFixed(0)}% absence rate`,
      });
    }
  }

  return anomalies;
}
