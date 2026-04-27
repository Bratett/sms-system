import { getAlumniDirectoryAction } from "@/modules/alumni/actions/alumni-self.action";
import { DirectoryClient } from "./directory-client";

export default async function AlumniDirectoryPage() {
  const dir = await getAlumniDirectoryAction({ page: 1, pageSize: 20 });
  if ("error" in dir) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-xl">
        <p className="text-sm text-gray-500">{dir.error}</p>
      </div>
    );
  }
  // Derive year filter options from current page data.
  const years = Array.from(new Set(dir.data.map((r) => r.graduationYear))).sort(
    (a, b) => b - a,
  );
  return (
    <DirectoryClient
      initialData={dir.data}
      initialPagination={dir.pagination}
      initialYears={years}
    />
  );
}
