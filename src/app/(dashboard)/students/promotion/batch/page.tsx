import { getEligibleSourceArmsAction } from "@/modules/student/actions/promotion.action";
import { BatchClient } from "./batch-client";

export default async function BatchPromotionPage() {
  const armsRes = await getEligibleSourceArmsAction();
  const arms = "data" in armsRes ? armsRes.data : [];
  const error = "error" in armsRes ? (armsRes.error ?? null) : null;

  return <BatchClient arms={arms} error={error} />;
}
