import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getParentCircularsAction } from "@/modules/portal/actions/parent.action";
import { CircularsClient } from "./circulars-client";

export default async function ParentCircularsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [pending, history] = await Promise.all([
    getParentCircularsAction({ tab: "pending" }),
    getParentCircularsAction({ tab: "history" }),
  ]);

  if ("error" in pending) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {pending.error}
        </div>
      </div>
    );
  }
  if ("error" in history) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {history.error}
        </div>
      </div>
    );
  }

  return <CircularsClient pending={pending.data as never} history={history.data as never} />;
}
