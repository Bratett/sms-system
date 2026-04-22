import { notFound } from "next/navigation";
import { getPromotionRunAction } from "@/modules/student/actions/promotion.action";
import { WizardClient } from "./wizard-client";
import { RunDetailClient } from "./run-detail-client";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { runId } = await params;
  const { step } = await searchParams;

  const res = await getPromotionRunAction(runId);
  if ("error" in res) return notFound();

  const run = res.data;
  const stepNum = Math.min(Math.max(parseInt(step ?? "1", 10) || 1, 1), 4);

  if (run.status === "DRAFT") {
    return <WizardClient run={run} step={stepNum} />;
  }
  return <RunDetailClient run={run} />;
}
