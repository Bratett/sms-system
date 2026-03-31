import { db } from "@/lib/db";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const school = await db.school.findFirst({ select: { name: true } });

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {school?.name ?? "School"} Admissions
            </h1>
          </div>
          <a
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Staff Login
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      <footer className="border-t border-border bg-card mt-auto">
        <div className="mx-auto max-w-4xl px-4 py-4 text-center text-xs text-muted-foreground">
          {school?.name ?? "School"} &middot; Online Admissions Portal
        </div>
      </footer>
    </div>
  );
}
