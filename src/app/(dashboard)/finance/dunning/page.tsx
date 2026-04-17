import { auth } from "@/lib/auth";
import {
  listDunningPoliciesAction,
  listDunningRunsAction,
  listDunningCasesAction,
} from "@/modules/finance/actions/dunning.action";
import { DunningClient } from "./dunning-client";

export default async function DunningPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [policies, runs, cases] = await Promise.all([
    listDunningPoliciesAction(),
    listDunningRunsAction(undefined, 1, 20),
    listDunningCasesAction({ status: "OPEN", pageSize: 50 }),
  ]);

  return (
    <DunningClient
      initialPolicies={"data" in policies ? policies.data : []}
      initialRuns={"data" in runs ? runs.data.runs : []}
      initialCases={"data" in cases ? cases.data.cases : []}
    />
  );
}
