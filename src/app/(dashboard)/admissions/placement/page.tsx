import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getApplicationsAction } from "@/modules/admissions/actions/admission.action";
import { PlacementClient } from "./placement-client";

export default async function PlacementPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const params = await searchParams;
  const result = await getApplicationsAction({
    status: "APPROVED",
    page: params.page ? parseInt(params.page) : 1,
    pageSize: 25,
  });

  const apps = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Placement"
        description="Assign approved students to class arms for enrollment."
      />
      <PlacementClient
        applications={apps?.applications ?? []}
        total={apps?.total ?? 0}
        page={apps?.page ?? 1}
        pageSize={apps?.pageSize ?? 25}
      />
    </div>
  );
}
