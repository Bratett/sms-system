"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState } from "react";
import {
  createRoleSchema,
  type CreateRoleInput,
} from "@/modules/auth/schemas/role.schema";
import {
  createRoleAction,
  updateRoleAction,
} from "@/modules/auth/actions/role.action";
import { useRouter } from "next/navigation";

interface Permission {
  id: string;
  code: string;
  module: string;
  action: string;
  description: string | null;
}

interface RoleFormProps {
  permissions: Permission[];
  role?: {
    id: string;
    name: string;
    displayName: string;
    description: string | null;
    isSystem: boolean;
    permissionIds: string[];
  };
  onClose: () => void;
}

export function RoleForm({ permissions, role, onClose }: RoleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: role?.name ?? "",
      displayName: role?.displayName ?? "",
      description: role?.description ?? "",
      permissionIds: role?.permissionIds ?? [],
    },
  });

  const selectedPermissionIds = watch("permissionIds");

  // Group permissions by module
  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {});

  function togglePermission(permId: string) {
    const current = selectedPermissionIds || [];
    if (current.includes(permId)) {
      setValue(
        "permissionIds",
        current.filter((id) => id !== permId),
        { shouldValidate: true },
      );
    } else {
      setValue("permissionIds", [...current, permId], { shouldValidate: true });
    }
  }

  function toggleModule(modulePerms: Permission[]) {
    const current = selectedPermissionIds || [];
    const moduleIds = modulePerms.map((p) => p.id);
    const allSelected = moduleIds.every((id) => current.includes(id));

    if (allSelected) {
      setValue(
        "permissionIds",
        current.filter((id) => !moduleIds.includes(id)),
        { shouldValidate: true },
      );
    } else {
      const newIds = [...new Set([...current, ...moduleIds])];
      setValue("permissionIds", newIds, { shouldValidate: true });
    }
  }

  function onSubmit(data: CreateRoleInput) {
    setMessage(null);
    startTransition(async () => {
      const result = role
        ? await updateRoleAction(role.id, data)
        : await createRoleAction(data);

      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  const isEditing = !!role;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-lg my-8">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">
            {isEditing ? `Edit Role: ${role.displayName}` : "Create New Role"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {message && (
            <div
              className={`rounded-md p-3 text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Role Name *</label>
              <input
                {...register("name")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. department_head"
                disabled={role?.isSystem}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Display Name *</label>
              <input
                {...register("displayName")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. Department Head"
              />
              {errors.displayName && (
                <p className="mt-1 text-xs text-red-500">{errors.displayName.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              {...register("description")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Brief description of this role"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Permissions ({selectedPermissionIds?.length ?? 0} selected)
            </label>
            <div className="max-h-80 overflow-y-auto rounded-md border border-input p-3 space-y-4">
              {Object.entries(grouped).map(([module, modulePerms]) => {
                const moduleIds = modulePerms.map((p) => p.id);
                const selectedCount = moduleIds.filter((id) =>
                  (selectedPermissionIds || []).includes(id),
                ).length;
                const allSelected = selectedCount === moduleIds.length;

                return (
                  <div key={module}>
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => toggleModule(modulePerms)}
                        className="rounded border-input"
                      />
                      <span className="text-sm font-medium capitalize">
                        {module.replace(/[:-]/g, " ")} ({selectedCount}/{moduleIds.length})
                      </span>
                    </div>
                    <div className="ml-6 grid gap-1">
                      {modulePerms.map((perm) => (
                        <label key={perm.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={(selectedPermissionIds || []).includes(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                            className="rounded border-input"
                          />
                          <span className="text-muted-foreground">{perm.description || perm.code}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Saving..." : isEditing ? "Update Role" : "Create Role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
