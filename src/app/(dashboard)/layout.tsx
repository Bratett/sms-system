import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Providers } from "@/components/providers";
import { DashboardShell } from "./dashboard-shell";
import { OfflineIndicator } from "@/components/shared/offline-indicator";
import { getLocale, getMessages } from "next-intl/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <Providers locale={locale} messages={messages as Record<string, unknown>}>
      {/* Skip navigation link for accessibility */}
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[100] -translate-y-16 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      <DashboardShell>{children}</DashboardShell>
      <OfflineIndicator />
    </Providers>
  );
}
