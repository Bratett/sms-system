import { auth } from "@/lib/auth";
import { getMyResultsAction } from "@/modules/portal/actions/student-portal.action";
import { MyResultsClient } from "./my-results-client";

export default async function StudentResultsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getMyResultsAction();
  const data = "data" in result ? result.data : null;
  const error = "error" in result ? result.error : null;

  return <MyResultsClient initialData={data} error={error} />;
}
