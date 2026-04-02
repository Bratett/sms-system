import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getRolesAction, getPermissionsAction } from "@/modules/auth/actions/role.action";
import { RolesClient } from "./roles-client";

export default async function RolesPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const [rolesResult, permissionsResult] = await Promise.all([
    getRolesAction(),
    getPermissionsAction(),
  ]);

  const roles = "data" in rolesResult ? rolesResult.data : [];
  const permissions = "data" in permissionsResult ? permissionsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Manage roles and their associated permissions."
      />
      <RolesClient roles={roles} permissions={permissions} />
    </div>
  );
}
