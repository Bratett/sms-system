import { auth } from "@/lib/auth";
import { getApplicationsAction } from "@/modules/admissions/actions/admission.action";
import { getAdmissionStatsAction } from "@/modules/admissions/actions/admission.action";
import { ApplicationsClient } from "./applications-client";

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [applicationsResult, statsResult] = await Promise.all([
    getApplicationsAction({ page: 1, pageSize: 25 }),
    getAdmissionStatsAction(),
  ]);

  const applicationsData = "data" in applicationsResult ? applicationsResult.data : null;
  const applications = applicationsData?.applications ?? [];
  const total = applicationsData?.total ?? 0;
  const stats = ("data" in statsResult ? statsResult.data : null) ?? {
    total: 0,
    submitted: 0,
    underReview: 0,
    shortlisted: 0,
    accepted: 0,
    rejected: 0,
    enrolled: 0,
    draft: 0,
  };

  return (
    <ApplicationsClient
      initialApplications={applications}
      initialTotal={total}
      stats={stats}
    />
  );
}
