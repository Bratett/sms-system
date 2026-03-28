import { auth } from "@/lib/auth";
import { getArrearsAction, getArrearsReportAction } from "@/modules/finance/actions/arrears.action";
import { getTermsAction } from "@/modules/school/actions/term.action";
import { ArrearsClient } from "./arrears-client";

export default async function ArrearsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [termsResult, arrearsResult, reportResult] = await Promise.all([
    getTermsAction(),
    getArrearsAction(),
    getArrearsReportAction(),
  ]);

  const terms = termsResult.data ?? [];
  const arrears = arrearsResult.data ?? [];
  const report = reportResult.data ?? null;

  return (
    <ArrearsClient
      terms={terms}
      initialArrears={arrears}
      initialReport={report}
    />
  );
}
