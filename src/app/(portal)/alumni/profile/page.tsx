import { getMyAlumniProfileAction } from "@/modules/alumni/actions/alumni-self.action";
import { ProfileClient } from "./profile-client";

export default async function AlumniProfilePage() {
  const result = await getMyAlumniProfileAction();
  if ("error" in result) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-xl">
        <p className="text-sm text-gray-500">{result.error}</p>
      </div>
    );
  }
  return <ProfileClient profile={result.data} />;
}
