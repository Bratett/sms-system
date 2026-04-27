import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AlumniLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = (session.user as Record<string, unknown>).roles as string[] | undefined ?? [];
  if (!roles.includes("alumni")) {
    if (roles.includes("parent")) redirect("/parent");
    if (roles.includes("student")) redirect("/student");
    if (roles.includes("teacher") || roles.includes("Teacher")) redirect("/staff");
    redirect("/dashboard");
  }

  return <>{children}</>;
}
