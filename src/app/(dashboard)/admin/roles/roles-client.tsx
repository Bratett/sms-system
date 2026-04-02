"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RoleForm } from "./role-form";
import { deleteRoleAction } from "@/modules/auth/actions/role.action";

interface RoleRow {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
  userCount: number;
  permissionIds: string[];
  createdAt: Date;
}

interface Permission {
  id: string;
  code: string;
  module: string;
  action: string;
  description: string | null;
}

export function RolesClient({
  roles,
  permissions,
}: {
  roles: RoleRow[];
  permissions: Permission[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);

  function handleEdit(role: RoleRow) {
    setEditingRole(role);
    setShowForm(true);
  }

  function handleCreate() {
    setEditingRole(null);
    setShowForm(true);
  }

  function handleClose() {
    setShowForm(false);
    setEditingRole(null);
  }

  function handleDelete(role: RoleRow) {
    if (role.isSystem) {
      alert("System roles cannot be deleted.");
      return;
    }
    if (!confirm(`Are you sure you want to delete role "${role.displayName}"?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteRoleAction(role.id);
      if ("error" in result) {
        alert(result.error);
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={handleCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Role
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">System Name</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-center font-medium">Permissions</th>
                <th className="px-4 py-3 text-center font-medium">Users</th>
                <th className="px-4 py-3 text-center font-medium">System</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No roles found.
                  </td>
                </tr>
              ) : (
                roles.map((role) => (
                  <tr key={role.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{role.displayName}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{role.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{role.description || "---"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-medium">
                        {role.permissionCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-800 px-2 py-0.5 text-xs font-medium">
                        {role.userCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {role.isSystem ? (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 px-2 py-0.5 text-xs font-medium">
                          Yes
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => handleEdit(role)}
                        >
                          Edit
                        </button>
                        {!role.isSystem && (
                          <button
                            className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            onClick={() => handleDelete(role)}
                            disabled={isPending}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <RoleForm
          permissions={permissions}
          role={
            editingRole
              ? {
                  id: editingRole.id,
                  name: editingRole.name,
                  displayName: editingRole.displayName,
                  description: editingRole.description,
                  isSystem: editingRole.isSystem,
                  permissionIds: editingRole.permissionIds,
                }
              : undefined
          }
          onClose={handleClose}
        />
      )}
    </>
  );
}
