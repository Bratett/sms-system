import {
  listPromotionRunsAction,
  getEligibleSourceArmsAction,
} from "@/modules/student/actions/promotion.action";
import { PromotionEntryClient } from "./promotion-entry-client";

export default async function PromotionEntryPage() {
  const [runsRes, armsRes] = await Promise.all([
    listPromotionRunsAction(),
    getEligibleSourceArmsAction(),
  ]);

  const runs = "data" in runsRes ? runsRes.data : [];
  const arms = "data" in armsRes ? armsRes.data : [];
  const error =
    "error" in runsRes ? runsRes.error : "error" in armsRes ? armsRes.error : null;

  return <PromotionEntryClient runs={runs} arms={arms} error={error} />;
}
