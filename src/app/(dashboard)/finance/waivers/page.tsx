import { auth } from "@/lib/auth";
import { getWaiversAction } from "@/modules/finance/actions/fee-waiver.action";
import { WaiversClient } from "./waivers-client";

export default async function WaiversPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const waiversResult = await getWaiversAction();
  const waivers = waiversResult.data ?? [];

  return <WaiversClient waivers={waivers} />;
}
