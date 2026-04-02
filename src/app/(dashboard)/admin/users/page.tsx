import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getUsersAction } from "@/modules/auth/actions/user.action";
import { UserTable } from "./user-table";
import Link from "next/link";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const result = await getUsersAction();
  const users = "data" in result ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage user accounts and their role assignments."
        actions={
          <Link
            href="/admin/users/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add User
          </Link>
        }
      />
      <UserTable users={users} />
    </div>
  );
}
