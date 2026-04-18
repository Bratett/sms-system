"use server";

/**
 * Admissions reporting endpoints.
 * All actions are read-only, gated on `ADMISSIONS_READ`, and return JSON-
 * serialisable shapes so they can feed dashboards, CSV exports, or scheduled
 * email digests once a scheduler is wired in.
 */

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";

// ─── Funnel + SLA report ──────────────────────────────────────────

interface FunnelRow {
  stage: string;
  count: number;
}

interface SlaMetric {
  label: string;
  avgHours: number | null;
  p50Hours: number | null;
  p90Hours: number | null;
  samples: number;
}

function hours(ms: number): number {
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

export async function getAdmissionsFunnelReportAction(opts?: {
  academicYearId?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_READ);
  if (denied) return denied;

  const baseWhere: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (opts?.academicYearId) baseWhere.academicYearId = opts.academicYearId;

  const stages = [
    "DRAFT",
    "SUBMITTED",
    "PAYMENT_PENDING",
    "DOCUMENTS_PENDING",
    "UNDER_REVIEW",
    "INTERVIEW_SCHEDULED",
    "AWAITING_DECISION",
    "ACCEPTED",
    "CONDITIONAL_ACCEPT",
    "WAITLISTED",
    "REJECTED",
    "OFFER_EXPIRED",
    "WITHDRAWN",
    "ENROLLED",
    "CANCELLED",
  ] as const;

  const counts = await Promise.all(
    stages.map((s) =>
      db.admissionApplication.count({ where: { ...baseWhere, status: s } }),
    ),
  );

  const funnel: FunnelRow[] = stages.map((stage, i) => ({
    stage,
    count: counts[i],
  }));

  const total = funnel.reduce((sum, f) => sum + f.count, 0);
  const submitted = funnel.find((f) => f.stage === "SUBMITTED")?.count ?? 0;
  const accepted = funnel.find((f) => f.stage === "ACCEPTED")?.count ?? 0;
  const enrolled = funnel.find((f) => f.stage === "ENROLLED")?.count ?? 0;

  // Conversion rates (percentage points).
  const conversion = {
    submitToDecision:
      submitted + accepted > 0
        ? Math.round((accepted / (submitted + accepted)) * 100)
        : null,
    acceptToEnroll: accepted + enrolled > 0 ? Math.round((enrolled / (accepted + enrolled)) * 100) : null,
  };

  // SLA metrics: compute from workflow transition timestamps when available;
  // fall back to application-level timestamps for older rows.
  const apps = await db.admissionApplication.findMany({
    where: baseWhere,
    select: {
      submittedAt: true,
      reviewedAt: true,
      offerAcceptedAt: true,
      status: true,
    },
  });

  const submitToReview: number[] = [];
  const reviewToOfferAccept: number[] = [];
  for (const a of apps) {
    if (a.submittedAt && a.reviewedAt) {
      submitToReview.push(a.reviewedAt.getTime() - a.submittedAt.getTime());
    }
    if (a.reviewedAt && a.offerAcceptedAt) {
      reviewToOfferAccept.push(
        a.offerAcceptedAt.getTime() - a.reviewedAt.getTime(),
      );
    }
  }
  submitToReview.sort((a, b) => a - b);
  reviewToOfferAccept.sort((a, b) => a - b);

  const slaSubmitToReview: SlaMetric = {
    label: "Submit → first review",
    avgHours:
      submitToReview.length > 0
        ? hours(submitToReview.reduce((s, v) => s + v, 0) / submitToReview.length)
        : null,
    p50Hours: submitToReview.length > 0 ? hours(percentile(submitToReview, 0.5)!) : null,
    p90Hours: submitToReview.length > 0 ? hours(percentile(submitToReview, 0.9)!) : null,
    samples: submitToReview.length,
  };

  const slaReviewToOffer: SlaMetric = {
    label: "Review → offer accepted",
    avgHours:
      reviewToOfferAccept.length > 0
        ? hours(
            reviewToOfferAccept.reduce((s, v) => s + v, 0) / reviewToOfferAccept.length,
          )
        : null,
    p50Hours:
      reviewToOfferAccept.length > 0 ? hours(percentile(reviewToOfferAccept, 0.5)!) : null,
    p90Hours:
      reviewToOfferAccept.length > 0 ? hours(percentile(reviewToOfferAccept, 0.9)!) : null,
    samples: reviewToOfferAccept.length,
  };

  return {
    data: {
      total,
      funnel,
      conversion,
      sla: [slaSubmitToReview, slaReviewToOffer],
    },
  };
}

// ─── Placement student summary ────────────────────────────────────

export async function getPlacementSummaryReportAction(opts?: {
  academicYearId?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_READ);
  if (denied) return denied;

  const baseWhere: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    applicationType: "PLACEMENT",
  };
  if (opts?.academicYearId) baseWhere.academicYearId = opts.academicYearId;

  const [total, verified, boarders, dayStudents] = await Promise.all([
    db.admissionApplication.count({ where: baseWhere }),
    db.admissionApplication.count({
      where: { ...baseWhere, placementVerified: true },
    }),
    db.admissionApplication.count({
      where: { ...baseWhere, boardingStatus: "BOARDING" },
    }),
    db.admissionApplication.count({
      where: { ...baseWhere, boardingStatus: "DAY" },
    }),
  ]);

  // BECE aggregate distribution, banded.
  const apps = await db.admissionApplication.findMany({
    where: baseWhere,
    select: { jhsAggregate: true, programPlaced: true },
  });

  const bands = [
    { label: "6–10 (auto-admit)", min: 6, max: 10 },
    { label: "11–15", min: 11, max: 15 },
    { label: "16–20", min: 16, max: 20 },
    { label: "21–30", min: 21, max: 30 },
    { label: "31–54", min: 31, max: 54 },
  ];
  const beceDistribution = bands.map((b) => ({
    band: b.label,
    count: apps.filter(
      (a) =>
        typeof a.jhsAggregate === "number" &&
        a.jhsAggregate >= b.min &&
        a.jhsAggregate <= b.max,
    ).length,
  }));

  const unknownAggregate = apps.filter((a) => a.jhsAggregate == null).length;

  // Programme placement split.
  const programmeCounts = new Map<string, number>();
  for (const a of apps) {
    const key = a.programPlaced ?? "Unspecified";
    programmeCounts.set(key, (programmeCounts.get(key) ?? 0) + 1);
  }
  const programmes = Array.from(programmeCounts, ([program, count]) => ({
    program,
    count,
  })).sort((a, b) => b.count - a.count);

  return {
    data: {
      total,
      verified,
      unverified: total - verified,
      boarders,
      dayStudents,
      beceDistribution,
      unknownAggregate,
      programmes,
    },
  };
}

// ─── Interview schedule (next N days) ─────────────────────────────

export async function getInterviewScheduleReportAction(opts?: {
  daysAhead?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ADMISSIONS_READ);
  if (denied) return denied;

  const daysAhead = opts?.daysAhead ?? 14;
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + daysAhead);

  const interviews = await db.admissionInterview.findMany({
    where: {
      schoolId: ctx.schoolId,
      scheduledAt: { gte: start, lte: end },
      recordedAt: null, // only upcoming/unrecorded
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      application: {
        select: {
          applicationNumber: true,
          firstName: true,
          lastName: true,
          status: true,
          applicationType: true,
        },
      },
    },
  });

  return {
    data: interviews.map((i) => ({
      interviewId: i.id,
      scheduledAt: i.scheduledAt,
      location: i.location,
      panelSize: i.panelMemberIds.length,
      applicationNumber: i.application.applicationNumber,
      applicantName: `${i.application.firstName} ${i.application.lastName}`,
      applicationType: i.application.applicationType,
      status: i.application.status,
    })),
  };
}
