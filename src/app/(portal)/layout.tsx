import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Providers } from "@/components/providers";
import { PortalNav } from "./portal-nav";
import { db } from "@/lib/db";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Get school name for the topbar
  const school = await db.school.findFirst({
    select: { name: true, logoUrl: true },
  });

  const roles = (session.user as Record<string, unknown>).roles as string[] | undefined;
  const userRole = roles?.includes("parent")
    ? "parent"
    : roles?.includes("student")
      ? "student"
      : "unknown";

  return (
    <Providers>
      <div className="min-h-screen bg-gray-50">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 border-b border-teal-100 bg-white shadow-sm">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              {school?.logoUrl && (
                <img
                  src={school.logoUrl}
                  alt="School logo"
                  className="h-8 w-8 rounded-full object-cover"
                />
              )}
              <div>
                <h1 className="text-sm font-semibold text-gray-900">
                  {school?.name ?? "School Portal"}
                </h1>
                <p className="text-xs capitalize text-teal-600">{userRole} Portal</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
                <p className="text-xs capitalize text-gray-500">{userRole}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-sm font-medium text-white">
                {session.user.name?.charAt(0) ?? "U"}
              </div>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <PortalNav role={userRole} userName={session.user.name ?? "User"} />

        {/* Main Content */}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </Providers>
  );
}
